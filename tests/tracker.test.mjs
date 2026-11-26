import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTracker, VERBS } from '../scripts/lib/tracker/index.mjs';

const issue = JSON.parse(readFileSync(new URL('./fixtures/rest/issue.json', import.meta.url), 'utf8'));
const recorder = (answer = '{}') => {
  const calls = [];
  const gh = (args, input) => { calls.push({ args, input }); return typeof answer === 'function' ? answer(args) : answer; };
  return { gh, calls };
};

test('the github backend has every verb', () => {
  const t = createTracker({ tracker: 'github' }, { gh: () => '{}' });
  VERBS.forEach((v) => assert.equal(typeof t[v], 'function', v));
});

test('issueGet asks gh for the fields the rules read and returns what it answers', () => {
  const { gh, calls } = recorder(JSON.stringify({ number: issue.number, title: issue.title, body: issue.body, labels: [], state: 'OPEN' }));
  const got = createTracker({}, { gh, repo: 'o/r' }).issueGet(issue.number);
  assert.deepEqual(calls[0].args.slice(0, 5), ['issue', 'view', String(issue.number), '--json', 'number,title,body,state,labels,comments,assignees,milestone']);
  assert.deepEqual(calls[0].args.slice(-2), ['--repo', 'o/r']);
  assert.equal(got.title, issue.title);
});

test('the body of an issue travels on stdin, never as an argument', () => {
  const { gh, calls } = recorder('https://github.com/o/r/issues/9\n');
  const t = createTracker({}, { gh });
  assert.equal(t.issueCreate({ title: 'T', body: '--add-label x', milestone: 'M', assignee: 'a' }), 'https://github.com/o/r/issues/9');
  assert.equal(calls[0].input, '--add-label x');
  assert.ok(!calls[0].args.includes('--add-label x'));
  t.commentAdd(9, 'hello');
  t.issueEditBody(9, 'new');
  assert.deepEqual(calls.slice(1).map((c) => c.input), ['hello', 'new']);
});

test('stateSet swaps labels in one call and does nothing when there is nothing to change', () => {
  const { gh, calls } = recorder();
  const t = createTracker({}, { gh });
  t.stateSet(5, { add: ['relevo:building'], remove: ['relevo:ready'] });
  t.stateSet(5, {});
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['issue', 'edit', '5', '--add-label', 'relevo:building', '--remove-label', 'relevo:ready']);
});

test('commentsList, issueClose and the delivery verbs use the matching gh subcommands', () => {
  const { gh, calls } = recorder(JSON.stringify({ comments: [{ body: 'x' }] }));
  const t = createTracker({}, { gh });
  assert.deepEqual(t.commentsList(3), [{ body: 'x' }]);
  t.issueClose(3);
  t.deliveryOpen({ branch: 'b', base: 'dev', title: 'T', body: 'B' });
  assert.deepEqual(calls[1].args, ['issue', 'close', '3', '--reason', 'completed']);
  assert.deepEqual(calls[2].args.slice(0, 7), ['pr', 'create', '--head', 'b', '--base', 'dev', '--title']);
});

test('deliveryGet answers null when the branch has no pull request and rethrows other failures', () => {
  const none = createTracker({}, { gh: () => { throw Object.assign(new Error('x'), { stderr: 'no pull requests found for branch "b"' }); } });
  assert.equal(none.deliveryGet('b'), null);
  const broken = createTracker({}, { gh: () => { throw Object.assign(new Error('x'), { stderr: 'network down' }); } });
  assert.throws(() => broken.deliveryGet('b'), /x/);
});

test('an unknown tracker, or a files tracker without its backend, fails with a reason', () => {
  assert.throws(() => createTracker({ tracker: 'jira' }, {}), /unknown tracker/);
  assert.throws(() => createTracker({ tracker: 'files' }, {}), /not available/);
  assert.throws(() => createTracker({ tracker: 'github' }, {}), /gh client/);
});

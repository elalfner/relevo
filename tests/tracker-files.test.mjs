import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filesBackend, parseIssueFile, renderIssueFile } from '../scripts/lib/tracker/files.mjs';
import { createTracker } from '../scripts/lib/tracker/index.mjs';
import { canEditIssue } from '../scripts/lib/can-edit-issue.mjs';
import { checkIssueDraft } from '../scripts/lib/issue-check.mjs';
import { checkIssueHash, issueHash } from '../scripts/lib/issue-hash.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-files-')));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  writeFileSync(join(dir, 'README.md'), 'x\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}
const GOOD = `## Summary

A counter.

## Scenarios

- **WHEN** the user taps the button
- **THEN** the counter goes up by one

## Edge cases

- counter at 99: it shows 100

## Out of scope

- saving the counter
`;
const make = (t, title = 'Counter', body = GOOD) => t.issueCreate({ title, body });
const number = (path) => Number(/(\d+)\.md$/.exec(path)[1]);

test('Scenario: an issue is a file and the text read back equals the text written', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  const path = make(t);
  assert.equal(path, '.relevo/issues/1.md');
  assert.equal(readFileSync(join(dir, path), 'utf8').startsWith('# Counter\n'), true);
  const got = t.issueGet(1);
  assert.equal(got.title, 'Counter');
  assert.equal(got.body, GOOD.trim());
  assert.deepEqual(parseIssueFile(renderIssueFile({ title: 'A', body: 'b' })), { title: 'A', body: 'b' });
  rmSync(dir, { recursive: true });
});

test('Scenario: numbers are sequential and never reused, even after a shipped issue leaves the tree', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  [1, 2, 3].forEach(() => make(t));
  t.issueClose(3);
  unlinkSync(join(dir, '.relevo/issues/3.md'));
  assert.equal(number(make(t)), 4);
  unlinkSync(join(dir, '.relevo/issues/2.md'));
  unlinkSync(join(dir, '.relevo/issues/4.md'));
  rmSync(join(dir, '.git/relevo/issues/2.json'));
  assert.equal(number(make(t)), 5, 'the record of 4 keeps it taken even with its file gone');
  rmSync(dir, { recursive: true });
});

test('Scenario: the state is outside the tracked files, changes no tracked file and is shared by a worktree', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  make(t);
  git(dir, 'add', '.relevo');
  git(dir, 'commit', '-q', '-m', 'issue 1');
  assert.equal(git(dir, 'status', '--porcelain'), '');
  t.stateSet(1, { add: ['relevo:ready'] });
  t.stateSet(1, { add: ['relevo:building'], remove: ['relevo:ready'] });
  t.commentAdd(1, 'hello');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'a change of state touches nothing the repository tracks');
  const wt = join(dir, '..', `${dir.split('/').pop()}-wt`);
  git(dir, 'worktree', 'add', '-q', '-b', 'relevo/1', wt);
  const inWt = filesBackend({ repoRoot: wt });
  assert.deepEqual(inWt.issueGet(1).labels, [{ name: 'relevo:building' }]);
  inWt.stateSet(1, { add: ['relevo:built'], remove: ['relevo:building'] });
  assert.deepEqual(t.issueGet(1).labels, [{ name: 'relevo:built' }]);
  assert.equal(inWt.commentsList(1)[0].body, 'hello');
  assert.equal(git(wt, 'status', '--porcelain'), '');
  assert.equal(git(dir, 'status', '--porcelain'), '');
  git(dir, 'worktree', 'remove', '--force', wt);
  rmSync(dir, { recursive: true });
});

test('Scenario: the answers have the shape the rules take unchanged', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  make(t);
  const issue = t.issueGet(1);
  assert.deepEqual(canEditIssue(issue), { editable: true });
  t.stateSet(1, { add: ['relevo:ready'] });
  assert.equal(canEditIssue(t.issueGet(1)).withdrawable, true);
  t.stateSet(1, { add: ['relevo:building'], remove: ['relevo:ready'] });
  assert.equal(canEditIssue(t.issueGet(1)).editable, false);
  assert.equal(checkIssueDraft({ title: issue.title, body: issue.body }).ok, true);
  const bad = filesBackend({ repoRoot: dir });
  bad.issueCreate({ title: 'Bad', body: '## Scenarios\n\n- **WHEN** x\n' });
  const result = checkIssueDraft({ title: bad.issueGet(2).title, body: bad.issueGet(2).body });
  assert.equal(result.ok, false, 'a WHEN with no THEN fails, as for a github issue');
  assert.equal(checkIssueHash({ expected: issueHash(issue), ...issue }).ok, true);
  assert.deepEqual(Object.keys(t.issueGet(1, 'title,body')), ['title', 'body']);
  rmSync(dir, { recursive: true });
});

test('Scenario: the hash is stored when ready is applied and an edit afterwards is caught', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  make(t);
  assert.equal(t.approvalCheck(1).ok, false, 'never approved');
  t.stateSet(1, { add: ['relevo:ready'] });
  assert.equal(t.approvalCheck(1).ok, true);
  t.issueEditBody(1, `${GOOD}\n- one more line\n`);
  assert.equal(t.approvalCheck(1).ok, false, 'edited after approval');
  t.stateSet(1, { remove: ['relevo:ready'] });
  assert.equal(t.approvalCheck(1).expected, null, 'withdrawing the approval forgets the hash');
  t.stateSet(1, { add: ['relevo:ready'] });
  assert.equal(t.approvalCheck(1).ok, true, 'approving again takes the new text');
  rmSync(dir, { recursive: true });
});

test('Scenario: dependencies are other issue files that must be shipped', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  make(t, 'Four');
  make(t, 'Five', `${GOOD}\nDepends-on: #1\n`);
  const waiting = t.dependencyCheck(2);
  assert.equal(waiting.ok, false);
  assert.deepEqual(waiting.waiting, [1]);
  assert.match(waiting.problems[0], /#1/);
  t.stateSet(1, { add: ['relevo:built'] });
  assert.equal(t.dependencyCheck(2).ok, false, 'built is not shipped');
  t.issueClose(1);
  assert.equal(t.dependencyCheck(2).ok, true);
  make(t, 'Six', `${GOOD}\nDepends-on: owner/repo#2\n`);
  const external = t.dependencyCheck(3);
  assert.equal(external.ok, false);
  assert.match(external.problems[0], /cannot depend on another repository/);
  make(t, 'Seven', `${GOOD}\nDepends-on: #99\n`);
  assert.match(t.dependencyCheck(4).problems[0], /no such issue/);
  rmSync(dir, { recursive: true });
});

test('delivery records and issueList and a missing issue', () => {
  const dir = repo();
  const t = filesBackend({ repoRoot: dir });
  make(t);
  make(t, 'Other thing');
  t.issueClose(2);
  assert.deepEqual(t.issueList().map((i) => i.number), [1]);
  assert.deepEqual(t.issueList({ state: 'all' }).map((i) => i.number), [1, 2]);
  assert.deepEqual(t.issueList({ state: 'all', search: 'other' }).map((i) => i.number), [2]);
  t.deliveryOpen({ branch: 'relevo/1', base: 'main', title: 'T', body: 'B' });
  assert.equal(t.deliveryGet('relevo/1').base, 'main');
  assert.equal(t.deliveryGet('relevo/9'), null);
  assert.throws(() => t.issueGet(9), /does not exist/);
  rmSync(dir, { recursive: true });
});

test('createTracker builds the files backend from a factory and the folder is in the git directory', () => {
  const dir = repo();
  const t = createTracker({ tracker: 'files' }, { files: () => filesBackend({ repoRoot: dir }) });
  assert.equal(t.kind, 'files');
  assert.equal(existsSync(t.stateFolder), false, 'nothing is created before the first write');
  make(t);
  assert.equal(t.stateFolder, join(dir, '.git', 'relevo'));
  rmSync(dir, { recursive: true });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';
import { shipDecision } from '../scripts/lib/ship.mjs';
import { baselineChecks, changedOnlySpecs, commitRollup, planRefusal, requiredChecks } from '../scripts/lib/ship-github.mjs';

const config = loadConfig('limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n').config;
const GOOD = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const BAD = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' }];
const pr = (over = {}) => ({
  number: 40, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', title: 'Summary screen (#31)', author: { login: 'persona-b' },
  reviews: [{ author: { login: 'persona-c' }, state: 'APPROVED', submittedAt: '2026-10-14T10:00:00Z', commit: { oid: 'aaa1111' } }],
  statusCheckRollup: [], headRefName: 'feature/31-summary', headRefOid: 'bbb2222', baseRefName: 'dev', ...over,
});

// A fake client that answers by the API path.
const fakeGh = (routes) => {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const key = args[1] === 'graphql' ? 'graphql' : args[1];
    const answer = routes[key];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new Error(`unexpected call ${args.join(' ')}`);
    return JSON.stringify(answer);
  };
  gh.calls = calls;
  return gh;
};
const rollupAnswer = (nodes) => ({ data: { repository: { object: { statusCheckRollup: { contexts: { nodes } } } } } });

test('Scenario: Archive pushed with a token that starts no workflows - the checks of the recorded head count', () => {
  const gh = fakeGh({
    'repos/o/r/compare/aaa1111...bbb2222': { files: [{ filename: 'openspec/specs/x/spec.md' }, { filename: 'openspec/changes/archive/2026-10-23-31-x/tasks.md', previous_filename: 'openspec/changes/31-x/tasks.md' }] },
    graphql: rollupAnswer(GOOD),
  });
  const carried = baselineChecks(gh, 'o/r', 'aaa1111', 'bbb2222');
  assert.deepEqual(carried, { archiveOnly: true, rollup: GOOD });
  const d = shipDecision({ config, pr: pr(), invoker: 'persona-c', baseline: 'aaa1111', baselineChecks: carried });
  assert.equal(d.allowed, true, d.reasons.join('; '));
  assert.equal(d.summary.checks, 'passing');
  assert.equal(d.summary.checksFrom, 'baseline');
  assert.ok(!d.confirm.includes('no-ci'));
});

test('Scenario: Head changed outside openspec - the checks of the recorded head do not count', () => {
  const gh = fakeGh({ 'repos/o/r/compare/aaa1111...bbb2222': { files: [{ filename: 'openspec/specs/x/spec.md' }, { filename: 'lib/main.dart' }] } });
  const carried = baselineChecks(gh, 'o/r', 'aaa1111', 'bbb2222');
  assert.deepEqual(carried, { archiveOnly: false, rollup: [] });
  assert.equal(gh.calls.some((c) => c[1] === 'graphql'), false, 'the rollup is not read when it cannot count');
  const d = shipDecision({ config, pr: pr(), invoker: 'persona-c', baseline: 'aaa1111', baselineChecks: carried });
  assert.equal(d.summary.checks, 'none');
  assert.ok(d.confirm.includes('no-ci'));
});

test('a rename out of openspec/ is a change outside it', () => {
  const gh = fakeGh({ 'repos/o/r/compare/a...b': { files: [{ filename: 'openspec/x.md', previous_filename: 'lib/x.md' }] } });
  assert.equal(changedOnlySpecs(gh, 'o/r', 'a', 'b'), false);
});

test('a folder that only starts like openspec is not the specifications folder', () => {
  const gh = fakeGh({ 'repos/o/r/compare/a...b': { files: [{ filename: 'openspec-tools/run.mjs' }] } });
  assert.equal(changedOnlySpecs(gh, 'o/r', 'a', 'b'), false);
});

test('a comparison with no files or at the API limit is not proof', () => {
  assert.equal(changedOnlySpecs(fakeGh({ 'repos/o/r/compare/a...b': { files: [] } }), 'o/r', 'a', 'b'), false);
  const many = Array.from({ length: 300 }, (_, i) => ({ filename: `openspec/specs/s${i}/spec.md` }));
  assert.equal(changedOnlySpecs(fakeGh({ 'repos/o/r/compare/a...b': { files: many } }), 'o/r', 'a', 'b'), false);
});

test('no baseline, or a head equal to it, reads nothing', () => {
  const gh = fakeGh({});
  assert.equal(baselineChecks(gh, 'o/r', undefined, 'b'), undefined);
  assert.equal(baselineChecks(gh, 'o/r', 'b', 'b'), undefined);
  assert.equal(gh.calls.length, 0);
});

test('Scenario: Checks ran on the archive commit - they are judged, not the recorded head', () => {
  const d = shipDecision({ config, pr: pr({ statusCheckRollup: BAD }), invoker: 'persona-c', baseline: 'aaa1111', baselineChecks: { archiveOnly: true, rollup: GOOD } });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => /checks are failing: test/.test(r)));
  assert.equal(d.summary.checksFrom, 'head');
});

test('a failing check on the recorded head still stops the merge', () => {
  const d = shipDecision({ config, pr: pr(), invoker: 'persona-c', baseline: 'aaa1111', baselineChecks: { archiveOnly: true, rollup: BAD } });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => /checks are failing/.test(r)));
});

test('commitRollup asks GraphQL for the commit and returns its nodes', () => {
  const gh = fakeGh({ graphql: rollupAnswer(GOOD) });
  assert.deepEqual(commitRollup(gh, 'o/r', 'aaa1111'), GOOD);
  const args = gh.calls[0];
  assert.ok(args.includes('owner=o') && args.includes('name=r') && args.includes('oid=aaa1111'));
});

test('required checks: a ruleset, classic protection, or none', () => {
  const ruleset = fakeGh({
    'repos/o/r/rules/branches/dev': [{ type: 'pull_request' }, { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test' }] } }],
    'repos/o/r/branches/dev/protection': new Error('HTTP 404: Branch not protected (Not Found)'),
  });
  assert.deepEqual(requiredChecks(ruleset, 'o/r', 'dev'), { required: true, contexts: ['test'] });

  const classic = fakeGh({
    'repos/o/r/rules/branches/dev': [],
    'repos/o/r/branches/dev/protection': { required_status_checks: { contexts: ['build'], checks: [{ context: 'lint' }] } },
  });
  assert.deepEqual(requiredChecks(classic, 'o/r', 'dev'), { required: true, contexts: ['build', 'lint'] });

  const none = fakeGh({ 'repos/o/r/rules/branches/dev': [{ type: 'pull_request' }], 'repos/o/r/branches/dev/protection': new Error('HTTP 404 Not Found') });
  assert.deepEqual(requiredChecks(none, 'o/r', 'dev'), { required: false, contexts: [] });
});

test('an error reading protection that is not a 404 is not taken for "no checks"', () => {
  const gh = fakeGh({ 'repos/o/r/rules/branches/dev': [], 'repos/o/r/branches/dev/protection': new Error('HTTP 403: Resource not accessible') });
  assert.throws(() => requiredChecks(gh, 'o/r', 'dev'), /403/);
});

const PLAN_403 = () => Object.assign(new Error('Command failed: gh api'), { stderr: 'gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)' });

test('Scenario: Private repository on a free plan - the plan refusal on both endpoints means no required checks', () => {
  const gh = fakeGh({ 'repos/o/r/rules/branches/dev': PLAN_403(), 'repos/o/r/branches/dev/protection': PLAN_403() });
  assert.deepEqual(requiredChecks(gh, 'o/r', 'dev'), { required: false, contexts: [] });
});

test('Scenario: Refusal for permissions - a 403 that is not the plan is not taken for "no checks"', () => {
  const denied = Object.assign(new Error('gh: Resource not accessible by integration (HTTP 403)'), { stderr: 'gh: Resource not accessible by integration (HTTP 403)' });
  assert.throws(() => requiredChecks(fakeGh({ 'repos/o/r/rules/branches/dev': denied }), 'o/r', 'dev'), /403/);
  assert.equal(planRefusal(denied), false);
});

test('Scenario: Server error reading the rules - it is thrown', () => {
  const broken = Object.assign(new Error('gh: Server Error (HTTP 500)'), { stderr: 'gh: Server Error (HTTP 500)' });
  assert.throws(() => requiredChecks(fakeGh({ 'repos/o/r/rules/branches/dev': broken }), 'o/r', 'dev'), /500/);
});

test('a 404 on the rules endpoint is not taken for "no checks" either', () => {
  const missing = Object.assign(new Error('gh: Not Found (HTTP 404)'), { stderr: 'gh: Not Found (HTTP 404)' });
  assert.throws(() => requiredChecks(fakeGh({ 'repos/o/r/rules/branches/dev': missing }), 'o/r', 'dev'), /404/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditApi } from '../scripts/lib/logaudit.mjs';
import { expandLog, readSlice, snapshotLog } from '../scripts/lib/api-log.mjs';

const CLI = new URL('../scripts/review-state.mjs', import.meta.url).pathname;
const SPEC = `## ADDED Requirements
### Requirement: A
#### Scenario: One
- **WHEN** a
- **THEN** b
#### Scenario: Two
- **WHEN** c
- **THEN** d
`;
const ERROR = '[2026-10-29 03:20:50] testing.ERROR: probe boom {"exception":"[object] (RuntimeException(code: 0): probe boom at /app/x.php:9)"}\n#0 /app/x.php(9): run()\n';

// A Laravel project folder with a change, and a review of it with the api adapter.
function review(autopilot = 'off', { log = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-api-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  mkdirSync(join(dir, 'storage', 'logs'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  if (log) writeFileSync(join(dir, 'storage', 'logs', 'laravel.log'), log);
  const state = join(dir, 'evidence', 'review-state.json');
  const run = (...args) => spawnSync('node', [CLI, ...args, '--state', state], { encoding: 'utf8' });
  const init = run('init', join(dir, 'change'), '--adapter', 'api', '--cwd', dir, '--autopilot', autopilot);
  return { dir, run, init, show: () => JSON.parse(readFileSync(state, 'utf8')), logFile: join(dir, 'storage', 'logs', 'laravel.log') };
}

test('Scenario: Entries from before the review - an old exception is not a finding, a new one is', () => {
  const r = review('off', { log: ERROR });
  assert.equal(r.init.status, 0, r.init.stderr);
  assert.match(r.init.stdout, /storage\/logs\/\*\.log is read from now on \(1 file/);
  r.run('ran', '0');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  appendFileSync(r.logFile, ERROR.replaceAll('probe boom', 'new boom'));
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW REJECTED/);
  assert.match(out, /exception: .*new boom/);
  assert.doesNotMatch(out, /probe boom/);
});

test('Scenario: Daily log - a file that appears after the review started is read from its start', () => {
  const r = review();
  r.run('ran', '0');
  writeFileSync(join(r.dir, 'storage', 'logs', 'laravel-2026-10-29.log'), ERROR);
  assert.match(r.run('audit').stdout, /^REVIEW REJECTED/);
});

test('Scenario: Unreadable file - a file of the snapshot that is gone is reported and the verdict is not a pass', () => {
  const r = review('off', { log: ERROR });
  r.run('ran', '0');
  rmSync(r.logFile);
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW INCONCLUSIVE/);
  assert.match(out, /laravel\.log: the file no longer exists/);
  const slice = readSlice({ pattern: 'storage/logs/*.log', offsets: { 'storage/logs/laravel.log': 5 } }, { cwd: r.dir });
  assert.deepEqual(slice.unreadable.map((u) => u.file), ['storage/logs/laravel.log']);
});

test('the log is never truncated or deleted by the review, and a rotated (shorter) file is read from its start', () => {
  const r = review('off', { log: ERROR });
  r.run('ran', '0');
  r.run('audit');
  assert.equal(readFileSync(r.logFile, 'utf8'), ERROR);
  writeFileSync(r.logFile, 'short\n');
  const snap = snapshotLog('storage/logs/*.log', { cwd: r.dir });
  snap.offsets['storage/logs/laravel.log'] = 9999;
  assert.equal(readSlice(snap, { cwd: r.dir }).text, 'short\n');
  assert.deepEqual(expandLog('storage/logs/*.log', { cwd: r.dir }), ['storage/logs/laravel.log']);
  assert.deepEqual(expandLog('storage/nothing/*.log', { cwd: r.dir }), []);
});

test('Scenario: Clean run, empty log - a recorded run that exited 0 passes with an empty log; no run is inconclusive and cannot be waived', () => {
  const r = review();
  const none = r.run('audit').stdout;
  assert.match(none, /^REVIEW INCONCLUSIVE/);
  assert.match(none, /no test run is recorded/);
  const waive = r.run('waive', '1', 'because');
  assert.notEqual(waive.status, 0);
  assert.match(waive.stderr, /inconclusive audit cannot be waived/);
  assert.equal(r.run('ran', '0', '--tests', '12').status, 0);
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
});

test('Scenario: Failing run - the verdict is rejected and names the failing tests; the latest run of a line replaces the one before', () => {
  const r = review();
  r.run('ran', '1', '--failing', 'Tests\\Feature\\A::test_a,Tests\\Feature\\A::test_b');
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW REJECTED/);
  assert.match(out, /test-failure: Tests\\Feature\\A::test_a, Tests\\Feature\\A::test_b \(person\)/);
  r.run('ran', '0');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/, 'the person ran the whole suite again and it passed');
});

test('Scenario: Error in the log - a clean run with an exception in the slice is rejected and the finding can be waived with a reason', () => {
  const r = review();
  r.run('ran', '0');
  appendFileSync(r.logFile, ERROR);
  assert.match(r.run('audit').stdout, /^REVIEW REJECTED/);
  assert.match(r.run('waive', '1', 'known and tracked').stdout, /waived; the verdict is REVIEW PASSED \(with waivers\)/);
});

test('auditApi finds the classes of a Laravel log and ignores the stack trace lines', () => {
  const text = [
    ERROR,
    '[2026-10-29 03:21:00] testing.ERROR: SQLSTATE[HY000]: General error: 1 no such table: posts',
    '[2026-10-29 03:21:01] testing.WARNING: Attempted to lazy load [author] on model [App\\Models\\Post]',
    '[2026-10-29 03:21:02] testing.INFO: all good',
  ].join('\n');
  const a = auditApi({ text, runs: [{ exit: 0, tests: 1 }] });
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.deepEqual(Object.keys(a.counts).sort(), ['database', 'exception', 'lazy-loading']);
  assert.equal(a.findings.some((f) => /^#0/.test(f.excerpt)), false);
});

test('Scenario: Autopilot off - the person records runs; the agent cannot record one, nor prove a line', () => {
  const r = review('off');
  assert.match(r.run('ran', '0', '--tests', '3').stdout, /run by the person, exit 0, 3 test/);
  const agent = r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '1');
  assert.notEqual(agent.status, 0);
  assert.match(agent.stderr, /review\.autopilot is "off"/);
  assert.match(r.run('precheck', '1', 'ok').stderr, /review\.autopilot is "off"/);
});

test('Scenario: A test covers the line / A filter that matches nothing / Precheck - an agent run proves a line only with exit 0 and at least one test', () => {
  const r = review('verify');
  r.run('confirm-env');
  assert.match(r.run('auto', '1', 'test_a').stderr, /line 1 has no test run of the agent/);
  r.run('ran', '1', '--by', 'agent', '--line', '1', '--tests', '0', '--filter', 'test_nothing');
  assert.match(r.run('auto', '1', 'test_nothing').stderr, /exited 1/);
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '0', '--filter', 'test_nothing');
  assert.match(r.run('auto', '1', 'test_nothing').stderr, /ran no test/);
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '1', '--filter', 'test_a');
  assert.equal(r.run('auto', '1', 'test_a passed, exit 0').status, 0);
  assert.equal(r.show().items[0].status, 'ok');
  assert.match(r.run('auto-list').stdout, /1\. .*test_a passed/);
  // precheck: the agent's own result, the person still confirms
  r.run('ran', '0', '--by', 'agent', '--line', '2', '--tests', '1', '--filter', 'test_b');
  assert.equal(r.run('precheck', '2', 'ok', 'test_b').status, 0);
  assert.equal(r.show().items[1].status, 'pending');
  assert.equal(r.run('precheck', '2', 'fail', 'anything').status, 0, 'a failure needs no proof');
});

test('Scenario: No test for the line - the line stays for the person; a line of a device review is unchanged', () => {
  const r = review('precheck');
  r.run('confirm-env');
  assert.match(r.run('precheck', '1', 'ok').stderr, /line 1 has no test run of the agent/);
  assert.equal(r.show().items[0].status, 'pending');
});

test('the pull request says which runs were the person and which the agent', () => {
  const r = review('verify');
  r.run('confirm-env');
  r.run('ran', '0', '--tests', '30');
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '1', '--filter', 'test_a');
  const section = r.run('runs-list').stdout;
  assert.match(section, /## Test runs/);
  assert.match(section, /by the person: exit 0, 30 test/);
  assert.match(section, /by the agent for line 1, filter `test_a`: exit 0, 1 test/);
});

test('sync after a fix clears the runs and takes the log as it is now; reset-log does the same for the log', () => {
  const r = review('off', { log: ERROR });
  r.run('ran', '0');
  appendFileSync(r.logFile, ERROR.replace('probe', 'before the fix'));
  r.run('sync', join(r.dir, 'change'));
  assert.deepEqual(r.show().runs, []);
  r.run('ran', '0');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/, 'the entries from before the fix are not read again');
  appendFileSync(r.logFile, ERROR.replace('probe', 'after'));
  r.run('reset-log');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  assert.equal(spawnSync('node', [CLI, 'reset-log', '--state', join(review().dir, 'none.json')], { encoding: 'utf8' }).status, 2);
});

test('a device review is unchanged: it keeps kind device and has no runs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-dev-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  const state = join(dir, 'evidence', 'review-state.json');
  spawnSync('node', [CLI, 'init', join(dir, 'change'), '--state', state]);
  const s = JSON.parse(readFileSync(state, 'utf8'));
  assert.equal(s.kind, 'device');
  assert.equal(s.runs, undefined);
  assert.match(spawnSync('node', [CLI, 'ran', '0', '--state', state], { encoding: 'utf8' }).stderr, /only in an api review/);
});

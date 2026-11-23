import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  assert.match(r.run('audit').stdout, /^REVIEW INCONCLUSIVE/, 'the run before the reset does not prove the new window');
  r.run('ran', '0');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/, 'a run after the reset does');
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

// ---- a declared adapter (declared-review-adapter): the log of Compose services and the audit of the common signals

test('Scenario: Compose log - the snapshot records the services and the start time, and the slice is read with docker compose logs from the folder of the platform', () => {
  const snap = snapshotLog('compose:postgres,auth', { cwd: '/backend', now: () => new Date('2026-11-18T10:00:00.000Z') });
  assert.deepEqual(snap, { pattern: 'compose:postgres,auth', source: 'compose', services: ['postgres', 'auth'], since: '2026-11-18T10:00:00.000Z' });
  assert.deepEqual(snapshotLog('compose:', { now: () => new Date('2026-11-18T10:00:00.000Z') }).services, [], 'none means every service');
  const calls = [];
  const slice = readSlice(snap, { cwd: '/backend', run: (command, args, opts) => { calls.push([command, args, opts]); return { status: 0, stdout: 'postgres | ok\n', stderr: '' }; } });
  assert.deepEqual(calls, [
    ['docker', ['compose', 'logs', '--no-color', '--since', '2026-11-18T10:00:00.000Z', 'postgres'], { cwd: '/backend' }],
    ['docker', ['compose', 'logs', '--no-color', '--since', '2026-11-18T10:00:00.000Z', 'auth'], { cwd: '/backend' }],
  ], 'one read per service');
  assert.equal(slice.text, 'postgres | ok\npostgres | ok\n');
  assert.deepEqual(slice.unreadable, []);
});

test('Scenario: Every service - the services of the project are listed and each is read since the start', () => {
  const calls = [];
  const slice = readSlice({ ...snapshotLog('compose:', { now: () => new Date('2026-11-18T10:00:00.000Z') }) }, { cwd: '/backend', run: (c, args) => {
    calls.push(args.join(' '));
    return args[1] === 'config' ? { status: 0, stdout: 'postgres\nauth\nhasura\n', stderr: '' } : { status: 0, stdout: `${args.at(-1)} | up\n`, stderr: '' };
  } });
  assert.deepEqual(calls, ['compose config --services', ...['postgres', 'auth', 'hasura'].map((s) => `compose logs --no-color --since 2026-11-18T10:00:00.000Z ${s}`)]);
  assert.equal(slice.text, 'postgres | up\nauth | up\nhasura | up\n');
  const down = readSlice(snapshotLog('compose:', { now: () => new Date() }), { run: () => ({ status: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon\nmore' }) });
  assert.deepEqual(down.unreadable, [{ file: 'compose', reason: 'Cannot connect to the Docker daemon' }]);
});

test('Scenario: One service too large - the others are read, the service is named and the reset-log way out is said', () => {
  const snap = snapshotLog('compose:postgres,auth,hasura', { now: () => new Date() });
  const slice = readSlice(snap, { run: (c, args) => (args.at(-1) === 'postgres' ? { status: 127, stdout: '', stderr: 'spawnSync docker ENOBUFS' } : { status: 0, stdout: `${args.at(-1)} | ok\n`, stderr: '' }) });
  assert.equal(slice.text, 'auth | ok\nhasura | ok\n', 'the other services are still read');
  assert.equal(slice.unreadable.length, 1);
  assert.equal(slice.unreadable[0].file, 'compose:postgres');
  assert.match(slice.unreadable[0].reason, /log of postgres since the review started is larger than the read allows/);
  assert.match(slice.unreadable[0].reason, /reset-log starts the window from now.*runs recorded so far then stop proving it/);
  const audit = auditApi({ text: slice.text, runs: [{ exit: 0, tests: 3 }], unreadable: slice.unreadable, flavor: 'declared' });
  assert.equal(audit.verdict, 'REVIEW INCONCLUSIVE');
  assert.match(audit.reason, /compose:postgres: .*reset-log/);
});

test('Scenario: Unreadable compose log - a failing runner is an unreadable source', () => {
  const snap = snapshotLog('compose:postgres', { now: () => new Date() });
  const slice = readSlice(snap, { run: () => ({ status: 1, stdout: '', stderr: 'no configuration file provided: not found\nmore' }) });
  assert.deepEqual(slice.unreadable, [{ file: 'compose:postgres', reason: 'no configuration file provided: not found' }]);
  assert.equal(slice.text, '');
  const audit = auditApi({ text: slice.text, runs: [{ exit: 0, tests: 3 }], unreadable: slice.unreadable, flavor: 'declared' });
  assert.equal(audit.verdict, 'REVIEW INCONCLUSIVE');
});

// A review of a declared adapter with a stand-in `docker` that answers `compose logs --since` from a fixture, as Compose does.
function declaredReview({ autopilot = 'off', dockerFails = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-decl-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  mkdirSync(join(dir, 'backend'), { recursive: true });
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  const fixture = join(dir, 'compose.log');
  writeFileSync(fixture, '');
  writeFileSync(join(dir, 'bin', 'docker'), `#!${process.execPath}\nconst fs = require('fs');\nfs.appendFileSync(${JSON.stringify(join(dir, 'docker.calls'))}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');\nif (${dockerFails}) { console.error('no configuration file provided: not found'); process.exit(1); }\nconst since = process.argv[process.argv.indexOf('--since') + 1];\nfs.readFileSync(${JSON.stringify(fixture)}, 'utf8').split('\\n').filter(Boolean).forEach((l) => { const [ts, ...rest] = l.split(' '); if (ts >= since) console.log('service | ' + rest.join(' ')); });\n`);
  chmodSync(join(dir, 'bin', 'docker'), 0o755);
  const state = join(dir, 'evidence', 'review-state.json');
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
  const run = (...args) => spawnSync('node', [CLI, ...args, '--state', state], { encoding: 'utf8', env });
  const init = run('init', join(dir, 'change'), '--adapter', 'api', '--stack', 'pocketbase', '--declared', '--log', 'compose:postgres,auth', '--cwd', join(dir, 'backend'), '--autopilot', autopilot);
  return { dir, run, init, show: () => JSON.parse(readFileSync(state, 'utf8')), add: (line) => appendFileSync(fixture, `${line}\n`), calls: () => readFileSync(join(dir, 'docker.calls'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) };
}
const LATER = '2999-01-01T00:00:00.000Z';

test('a declared review records declared in the state, and init describes the services and the start', () => {
  const r = declaredReview();
  assert.equal(r.init.status, 0, r.init.stderr);
  assert.match(r.init.stdout, /the log of the services postgres, auth of the Compose project is read from \d{4}-/);
  const state = r.show();
  assert.deepEqual([state.kind, state.declared, state.stack, state.log.source, state.log.services], ['api', true, 'pocketbase', 'compose', ['postgres', 'auth']]);
  assert.equal(declaredReview().run('init', 'x', '--declared').status, 2, '--declared needs an api review');
});

test('Scenario: Compose log through the command - what the services wrote before the start is not read, and docker runs in the folder of the platform', () => {
  const r = declaredReview();
  r.add('1999-01-01T00:00:00.000Z FATAL: from before the review');
  r.run('ran', '0', '--tests', '5');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  const calls = r.calls().slice(-2);
  calls.forEach((call) => assert.deepEqual(call.args.slice(0, 4), ['compose', 'logs', '--no-color', '--since']));
  assert.deepEqual(calls.map((call) => call.args.at(-1)), ['postgres', 'auth'], 'one read per service');
  calls.forEach((call) => assert.match(call.cwd, /backend$/));
  r.add(`${LATER} FATAL: terminating connection`);
  assert.match(r.run('audit').stdout, /^REVIEW REJECTED/);
});

test('Scenario: Unreadable compose log through the command - inconclusive and it cannot be waived', () => {
  const r = declaredReview({ dockerFails: true });
  r.run('ran', '0', '--tests', '5');
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW INCONCLUSIVE/);
  assert.match(out, /compose:postgres: no configuration file provided/);
  assert.match(out, /compose:auth: no configuration file provided/);
  const waive = r.run('waive', '1', 'because');
  assert.notEqual(waive.status, 0);
  assert.match(waive.stderr, /inconclusive audit cannot be waived/);
});

test('Scenario: Fatal entry - rejected, and the person can waive the finding with a reason', () => {
  const r = declaredReview();
  r.run('ran', '0', '--tests', '5');
  r.add(`${LATER} FATAL: terminating connection due to administrator command`);
  assert.match(r.run('audit').stdout, /^REVIEW REJECTED/);
  assert.match(r.run('waive', '1', 'the test restarts the container').stdout, /REVIEW PASSED \(with waivers\)/);
});

test('Scenario: Expected denial, Server error, Quiet log with a run, Not detected', () => {
  const runs = [{ exit: 0, tests: 5, by: 'person' }];
  const denial = auditApi({ text: 'ERROR:  permission denied for table invoices\nERROR:  duplicate key value violates unique constraint "x"', runs, flavor: 'declared' });
  assert.equal(denial.verdict, 'REVIEW PASSED');
  assert.equal(denial.expected.length, 2);
  assert.equal(auditApi({ text: 'ERROR:  permission denied for table x', runs: [], flavor: 'declared' }).findings[0].class, 'denial', 'a denial with no run to explain it is a finding');
  const server = auditApi({ text: 'POST /graphql HTTP/1.1" 500 12\nresponse 503', runs, flavor: 'declared' });
  assert.equal(server.verdict, 'REVIEW REJECTED');
  assert.equal(server.findings[0].class, 'server-error');
  assert.equal(auditApi({ text: '', runs, flavor: 'declared' }).verdict, 'REVIEW PASSED');
  assert.equal(auditApi({ text: '', runs: [], flavor: 'declared' }).verdict, 'REVIEW INCONCLUSIVE');
  const quiet = auditApi({ text: '{"level":"error","type":"http-log","detail":{"operation":{"error":{"message":"validation-failed"}}}}', runs, flavor: 'declared' });
  assert.equal(quiet.verdict, 'REVIEW PASSED');
  assert.deepEqual(['deadlock detected: ERROR:  deadlock detected', 'out of memory', 'PANIC:  could not write'].map((text) => auditApi({ text, runs, flavor: 'declared' }).findings[0]?.class), ['deadlock', 'out-of-memory', 'fatal']);
  assert.equal(auditApi({ text: 'ERROR:  relation "x" does not exist', runs, flavor: 'declared' }).findings[0].class, 'database-error');
});

test('the report of a declared audit says that the recorded run is the proof and that errors without the signals are not detected', () => {
  const r = declaredReview();
  r.run('ran', '0', '--tests', '5');
  r.add(`${LATER} {"level":"error","message":"rejected request"}`);
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  const report = readFileSync(join(r.dir, 'evidence', 'review-report.md'), 'utf8');
  assert.match(report, /no fatal entry, deadlock, out-of-memory, database error or server error/);
  assert.match(report, /are not detected, and the recorded run is the proof/);
  assert.equal(r.show().audit.scope.flavor, 'declared');
});

test('the Laravel and Supabase audits are unchanged: no flavor in the scope of Laravel, postgres for Supabase', () => {
  const laravel = review();
  laravel.run('ran', '0');
  laravel.run('audit');
  assert.equal(laravel.show().audit.scope.flavor, undefined);
  assert.equal(auditApi({ text: 'FATAL:  role "postgres" does not exist', runs: [{ exit: 0 }], flavor: 'postgres' }).startup.length, 1);
  assert.equal(auditApi({ text: 'FATAL:  role "postgres" does not exist', runs: [{ exit: 0 }], flavor: 'declared' }).findings[0].class, 'fatal', 'the startup entry is Supabase noise, not a declared one');
});

test('Scenario: A run that reports no count - a declared line is proved only by an agent run for the line with exit 0 and at least one test; the pull request says test(s) and filter', () => {
  const r = declaredReview({ autopilot: 'verify' });
  assert.match(r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '1', '--filter', 'login').stderr, /not confirmed in writing/, 'the agent runs nothing before the confirmation');
  r.run('confirm-env');
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--filter', 'login');
  assert.match(r.run('precheck', '1', 'ok').stderr, /ran no test \(count not given\)/);
  assert.match(r.run('auto', '1', 'login').stderr, /ran no test \(count not given\)/);
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '0', '--filter', 'login');
  assert.match(r.run('auto', '1', 'login').stderr, /ran no test \(0\)/);
  r.run('ran', '0', '--by', 'agent', '--tests', '12');
  assert.match(r.run('auto', '1', 'whole suite').stderr, /ran no test/, 'a whole-suite run with no line proves no line');
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tests', '1', '--filter', 'login');
  assert.equal(r.run('precheck', '1', 'ok').status, 0);
  const section = r.run('runs-list').stdout;
  assert.match(section, /by the agent: exit 0, 12 test\(s\)/);
  assert.match(section, /by the agent for line 1, filter `login`: exit 0, 1 test\(s\)/);
  assert.doesNotMatch(section, /assertion/);
});

// ---- harden-api-review-audit: a run belongs to the window it was recorded in

test('Scenario: Empty window after a reset - runs from before do not prove it, a run after does, and a failing run before still stands', () => {
  const runs = [{ exit: 0, tests: 5, by: 'person' }];
  const empty = auditApi({ text: '', runs, flavor: 'declared', windowStart: 1 });
  assert.equal(empty.verdict, 'REVIEW INCONCLUSIVE');
  assert.match(empty.reason, /no test run is recorded since the log was reset/);
  assert.equal(auditApi({ text: '', runs: [...runs, { exit: 0, tests: 5, by: 'person' }], flavor: 'declared', windowStart: 1 }).verdict, 'REVIEW PASSED');
  assert.equal(auditApi({ text: '', runs, flavor: 'declared', windowStart: 0 }).verdict, 'REVIEW PASSED', 'no reset, no change');
  const failing = auditApi({ text: '', runs: [{ exit: 1, line: 1, failing: ['t'], by: 'person' }], flavor: 'declared', windowStart: 1 });
  assert.equal(failing.verdict, 'REVIEW REJECTED');
});

test('reset-log after a recorded run says that the run no longer proves the window, and the audit is inconclusive until a new run', () => {
  const r = declaredReview();
  r.run('ran', '0', '--tests', '5');
  const reset = r.run('reset-log');
  assert.match(reset.stdout, /1 run\(s\) recorded so far no longer prove this window/);
  assert.equal(r.show().log.runsBefore, 1);
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW INCONCLUSIVE/);
  assert.match(out, /since the log was reset/);
  r.run('ran', '0', '--tests', '5');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  const none = declaredReview();
  assert.doesNotMatch(none.run('reset-log').stdout, /no longer prove/);
});

// ---- harden-api-review-audit: the state of a review belongs to one change

test('Scenario: State of another issue - init refuses, names both changes and leaves the file as it is', () => {
  const r = review();
  assert.equal(r.run('init', join(r.dir, 'change'), '--adapter', 'api').status, 0);
  const before = readFileSync(join(r.dir, 'evidence', 'review-state.json'), 'utf8');
  assert.equal(r.show().change, 'change');
  const other = join(r.dir, 'rename-orders');
  mkdirSync(join(other, 'specs', 'cap'), { recursive: true });
  writeFileSync(join(other, 'specs', 'cap', 'spec.md'), SPEC);
  const refused = r.run('init', other, '--adapter', 'api');
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /it is for the change change, not rename-orders/);
  assert.equal(readFileSync(join(r.dir, 'evidence', 'review-state.json'), 'utf8'), before);
  assert.equal(r.run('init', join(r.dir, 'change'), '--adapter', 'api').status, 0, 'the same change can start again');
});

test('Scenario: State of another kind and Same change - owner exits 1 naming what differs, 0 when it is this review', () => {
  const r = review();
  r.run('init', join(r.dir, 'change'), '--adapter', 'api');
  const same = r.run('owner', join(r.dir, 'change'), '--adapter', 'api');
  assert.equal(same.status, 0);
  assert.match(same.stdout, /is the api review of change/);
  const kind = r.run('owner', join(r.dir, 'change'));
  assert.equal(kind.status, 1);
  assert.match(kind.stdout, /it is for an api review, not a device review/);
  const change = r.run('owner', join(r.dir, 'change', 'specs'), '--adapter', 'api');
  assert.equal(change.status, 1);
  assert.match(change.stdout, /it is for the change change, not specs/);
  assert.equal(r.run('init', join(r.dir, 'change')).status, 2, 'a device review does not overwrite an api state');
});

test('Scenario: Older state - owner says the owner is unknown and init does not refuse', () => {
  const r = review();
  r.run('init', join(r.dir, 'change'), '--adapter', 'api');
  const file = join(r.dir, 'evidence', 'review-state.json');
  const old = r.show();
  delete old.change;
  writeFileSync(file, JSON.stringify(old));
  const out = r.run('owner', join(r.dir, 'change'), '--adapter', 'api');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /owner of .* is unknown.*ask the person whether it is theirs/);
  assert.equal(r.run('init', join(r.dir, 'change'), '--adapter', 'api').status, 0);
  assert.equal(r.run('owner', join(r.dir, 'change'), '--adapter', 'api').status, 0);
});

test('init of a compose log says where the running project was started from: a warning for another folder, a note when none runs', () => {
  assert.match(declaredReview().init.stdout, /no running Compose project was found for this folder/);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-where-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  mkdirSync(join(dir, 'backend'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  writeFileSync(join(dir, 'bin', 'docker'), '#!/bin/sh\ncase "$1" in compose) echo c1;; inspect) echo /elsewhere/backend;; esac\nexit 0\n');
  chmodSync(join(dir, 'bin', 'docker'), 0o755);
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
  const init = spawnSync('node', [CLI, 'init', join(dir, 'change'), '--adapter', 'api', '--declared', '--log', 'compose:', '--cwd', join(dir, 'backend'), '--state', join(dir, 'evidence', 'review-state.json')], { encoding: 'utf8', env });
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /warning: the Compose project is running from \/elsewhere\/backend.*not from .*backend/);
});

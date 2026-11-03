import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditApi, auditReport } from '../scripts/lib/logaudit.mjs';
import { containerOf, isDockerLog, readSlice, snapshotLog } from '../scripts/lib/api-log.mjs';
import { parseTap } from '../scripts/lib/pgtap.mjs';
import { checkSupabaseCommand } from '../scripts/lib/supabase-commands.mjs';

const CLI = new URL('../scripts/review-state.mjs', import.meta.url).pathname;
const FIX = new URL('./fixtures/supabase/', import.meta.url).pathname;
const fixture = (name) => readFileSync(join(FIX, name), 'utf8');
const SPEC = '## ADDED Requirements\n### Requirement: A\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n#### Scenario: Two\n- **WHEN** c\n- **THEN** d\n';

// A Supabase platform folder with a change, a config.toml, and a fake `docker` that prints what DOCKER_LOG holds.
function project(autopilot = 'off', { dockerLog = '', dockerStatus = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-sb-'));
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  mkdirSync(join(dir, 'supabase'), { recursive: true });
  mkdirSync(join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  writeFileSync(join(dir, 'supabase', 'config.toml'), 'project_id = "shop"\n');
  writeFileSync(join(dir, 'docker.out'), dockerLog);
  writeFileSync(join(dir, 'docker.args'), '');
  writeFileSync(join(dir, 'bin', 'docker'), `#!/bin/sh\necho "$@" >> "${dir}/docker.args"\nif [ ${dockerStatus} -ne 0 ]; then echo "Error: No such container: supabase_db_shop" >&2; exit ${dockerStatus}; fi\ncat "${dir}/docker.out" >&2\n`);
  chmodSync(join(dir, 'bin', 'docker'), 0o755);
  const state = join(dir, 'evidence', 'review-state.json');
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
  const run = (...args) => spawnSync('node', [CLI, ...args, '--state', state], { encoding: 'utf8', env, input: args.includes('-') ? '' : undefined });
  const init = run('init', join(dir, 'change'), '--adapter', 'api', '--stack', 'supabase', '--cwd', dir, '--autopilot', autopilot);
  return { dir, run, init, show: () => JSON.parse(readFileSync(state, 'utf8')), setLog: (t) => writeFileSync(join(dir, 'docker.out'), t) };
}

test('pgTAP: the assertions, the failing names and the plan are read from the output', () => {
  assert.deepEqual(parseTap(fixture('tap-pass.txt')), { assertions: 4, failing: [], planned: null, planComplete: true });
  const fail = parseTap(fixture('tap-fail.txt'));
  assert.deepEqual([fail.assertions, fail.failing, fail.planComplete], [4, ['orders is gone'], true]);
  const half = parseTap(fixture('tap-incomplete.txt'));
  assert.deepEqual([half.assertions, half.planComplete], [2, false]);
  assert.equal(parseTap(fixture('tap-empty.txt')).assertions, 0);
  const uncaught = parseTap(fixture('tap-uncaught.txt'));
  assert.deepEqual([uncaught.assertions, uncaught.planComplete], [0, false]);
  assert.deepEqual(parseTap('ok 1 - a\nnot ok 2 - b\n# Failed test 2: "b"\n1..2\n'), { assertions: 2, failing: ['b'], planned: 2, planComplete: true });
});

test('Supabase commands: only the closed list, never a remote target', () => {
  ['supabase test db', 'supabase test db supabase/tests/orders_rls.test.sql', 'supabase db lint', 'supabase status', 'supabase start', 'supabase stop', 'docker logs --since 2026-11-02T10:00:00Z supabase_db_shop', 'docker inspect supabase_db_shop', 'docker info']
    .forEach((c) => assert.equal(checkSupabaseCommand(c).allowed, true, c));
  ['supabase test db --linked', 'supabase test db --db-url postgres://x', 'supabase test db --db-url=postgres://x', 'supabase link --project-ref abc', 'supabase db push', 'supabase db pull', 'supabase db reset --linked', 'supabase db lint --linked', 'cat supabase/.temp/project-ref', 'supabase test db .env', 'supabase functions deploy', 'rm -rf supabase', '']
    .forEach((c) => assert.equal(checkSupabaseCommand(c).allowed, false, c));
});

test('Container log: the setting names a container, {project_id} comes from config.toml, and the slice starts at a timestamp', () => {
  const r = project();
  assert.equal(isDockerLog('docker:supabase_db_{project_id}'), true);
  assert.equal(isDockerLog('storage/logs/*.log'), false);
  assert.equal(containerOf('docker:supabase_db_{project_id}', { cwd: r.dir }), 'supabase_db_shop');
  assert.equal(containerOf('docker:other', { cwd: r.dir }), 'other');
  const snap = snapshotLog('docker:supabase_db_{project_id}', { cwd: r.dir, now: () => new Date('2026-11-02T10:00:00Z') });
  assert.deepEqual(snap, { pattern: 'docker:supabase_db_{project_id}', source: 'docker', container: 'supabase_db_shop', since: '2026-11-02T10:00:00.000Z' });
  const slice = readSlice(snap, { run: (cmd, args) => ({ status: 0, stdout: '', stderr: `${cmd} ${args.join(' ')}\n` }) });
  assert.equal(slice.text, 'docker logs --since 2026-11-02T10:00:00.000Z supabase_db_shop\n');
  assert.throws(() => containerOf('docker:supabase_db_{project_id}', { cwd: tmpdir() }), /project_id/);
});

test('Scenario: Unreadable file - a container that does not exist is reported and the verdict is not a pass', () => {
  const slice = readSlice({ source: 'docker', container: 'gone', since: 't' }, { run: () => ({ status: 1, stdout: '', stderr: 'Error: No such container: gone\n' }) });
  assert.equal(slice.unreadable[0].file, 'gone');
  const audit = auditApi({ text: slice.text, runs: [{ exit: 0, tests: 3, by: 'agent', line: 1 }], unreadable: slice.unreadable, flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW INCONCLUSIVE');
  assert.match(audit.reason, /gone/);
});

test('Scenario: Denial provoked by a policy test - expected denials are listed, not findings (hand-written log: no capture holds one)', () => {
  const audit = auditApi({ text: fixture('db-log-denials-handwritten.txt'), runs: [{ exit: 0, tests: 4, by: 'agent', line: 1 }], flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW PASSED');
  assert.equal(audit.expected.length, 4);
  assert.match(auditReport(audit, { scope: { kind: 'api', pattern: 'docker:x', runs: 1, flavor: 'postgres' } }), /4 expected denial/);
});

test('Scenario: Policy test that logs nothing - the run is the proof and the report says so', () => {
  const audit = auditApi({ text: fixture('db-log-rls-denials.txt'), runs: [{ exit: 0, tests: 4, by: 'agent', line: 1 }], flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW PASSED');
  assert.equal(audit.expected.length, 0);
  assert.match(auditReport(audit, { scope: { kind: 'api', pattern: 'docker:x', runs: 1, flavor: 'postgres' } }), /No denial appears in the log.*the proof is the recorded run/);
});

test('Scenario: Denials with a failing run - the run rejects, the denials stay as context', () => {
  const audit = auditApi({ text: fixture('db-log-denials-handwritten.txt'), runs: [{ exit: 1, tests: 4, by: 'agent', line: 1, failing: ['anon cannot read orders'] }], flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW REJECTED');
  assert.equal(audit.findings[0].class, 'test-failure');
  assert.match(audit.findings[0].excerpt, /anon cannot read orders/);
  assert.equal(audit.expected.length, 4);
});

test('Scenario: Other error and Fatal - a missing relation, a syntax error, a fatal entry and a deadlock are findings', () => {
  const run = [{ exit: 0, tests: 4, by: 'agent', line: 1 }];
  const syntax = auditApi({ text: fixture('db-log-error.txt'), runs: run, flavor: 'postgres' });
  assert.equal(syntax.verdict, 'REVIEW REJECTED');
  assert.deepEqual(syntax.counts, { 'database-error': 1 });
  assert.deepEqual(auditApi({ text: fixture('db-log-uncaught.txt'), runs: run, flavor: 'postgres' }).counts, { 'database-error': 1 });
  assert.deepEqual(auditApi({ text: fixture('db-log-fatal-handwritten.txt'), runs: run, flavor: 'postgres' }).counts, { fatal: 1, deadlock: 1 });
});

test('Scenario: Database reset with a good migration - the startup entry is listed, not a finding', () => {
  const audit = auditApi({ text: fixture('db-log-reset.txt'), runs: [{ exit: 0, tests: 4, by: 'agent', line: 1 }], flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW PASSED');
  assert.equal(audit.startup.length, 1);
  assert.match(audit.startup[0].excerpt, /role "postgres" does not exist/);
  const report = auditReport(audit, { scope: { kind: 'api', pattern: 'docker:x', runs: 1, flavor: 'postgres' } });
  assert.match(report, /1 expected startup entry/);
  assert.match(report, /No denial appears in the log/);
});

test('Scenario: Database reset with a broken migration - rejected on the ERROR, the startup entry is not a finding', () => {
  const audit = auditApi({ text: `${fixture('db-log-reset.txt')}${fixture('db-log-error.txt')}`, runs: [{ exit: 0, tests: 4, by: 'agent', line: 1 }], flavor: 'postgres' });
  assert.equal(audit.verdict, 'REVIEW REJECTED');
  assert.deepEqual(audit.counts, { 'database-error': 1 });
  assert.equal(audit.startup.length, 1);
});

test('Scenario: Fatal - only the startup entry of a reset is spared; another role or message still rejects', () => {
  const run = [{ exit: 0, tests: 4, by: 'agent', line: 1 }];
  assert.deepEqual(auditApi({ text: `${fixture('db-log-reset.txt')}${fixture('db-log-fatal-handwritten.txt')}`, runs: run, flavor: 'postgres' }).counts, { fatal: 1, deadlock: 1 });
  assert.deepEqual(auditApi({ text: '2026-11-03 05:00:00.000 UTC [9] FATAL:  role "app" does not exist\n', runs: run, flavor: 'postgres' }).counts, { fatal: 1 });
  assert.equal(auditApi({ text: '2026-11-03 05:00:00.000 UTC [9] FATAL:  role "postgres" does not exist\n', runs: [], flavor: 'postgres' }).verdict, 'REVIEW PASSED');
});

test('Postgres audit: a clean slice with a recorded run passes, and with no run it proves nothing', () => {
  assert.equal(auditApi({ text: fixture('db-log-clean.txt'), runs: [{ exit: 0, tests: 2, by: 'person' }], flavor: 'postgres' }).verdict, 'REVIEW PASSED');
  assert.equal(auditApi({ text: '', runs: [{ exit: 0, tests: 2, by: 'person' }], flavor: 'postgres' }).verdict, 'REVIEW PASSED');
  assert.equal(auditApi({ text: '', runs: [], flavor: 'postgres' }).verdict, 'REVIEW INCONCLUSIVE');
  assert.equal(auditApi({ text: fixture('db-log-denials-handwritten.txt'), runs: [], flavor: 'postgres' }).verdict, 'REVIEW REJECTED');
});

test('Laravel audit is unchanged by the Postgres flavor', () => {
  assert.equal(auditApi({ text: 'ERROR: permission denied\n', runs: [{ exit: 0, tests: 1 }] }).verdict, 'REVIEW PASSED');
});

test('Supabase review: init reads the container log from now on, the audit reads the slice through docker', () => {
  const r = project('off', { dockerLog: fixture('db-log-clean.txt') });
  assert.equal(r.init.status, 0, r.init.stderr);
  assert.match(r.init.stdout, /the log of the container supabase_db_shop is read from \d{4}-/);
  assert.equal(r.show().stack, 'supabase');
  assert.equal(r.show().log.source, 'docker');
  r.run('ran', '0');
  assert.match(r.run('audit').stdout, /^REVIEW PASSED/);
  assert.match(readFileSync(join(r.dir, 'docker.args'), 'utf8'), /^logs --since \S+ supabase_db_shop/);
});

test('Supabase review: expected denials pass with a run, other errors reject', () => {
  const r = project('off', { dockerLog: fixture('db-log-denials-handwritten.txt') });
  r.run('ran', '0');
  const ok = r.run('audit');
  assert.match(ok.stdout, /^REVIEW PASSED/);
  assert.equal(r.show().audit.expected.length, 4);
  r.setLog(fixture('db-log-error.txt'));
  const bad = r.run('audit').stdout;
  assert.match(bad, /^REVIEW REJECTED/);
  assert.match(bad, /database-error: .*tabel/);
});

test('Supabase review: a container that is missing makes the audit inconclusive', () => {
  const r = project('off', { dockerStatus: 1 });
  r.run('ran', '0');
  const out = r.run('audit').stdout;
  assert.match(out, /^REVIEW INCONCLUSIVE/);
  assert.match(out, /supabase_db_shop/);
});

test('Scenario: Failing assertion and Plan not completed - the run is recorded with its assertions', () => {
  const r = project('precheck');
  r.run('confirm-env');
  const fail = r.run('ran', '1', '--by', 'agent', '--line', '1', '--filter', 'supabase/tests/orders_rls.test.sql', '--tap', join(FIX, 'tap-fail.txt'));
  assert.equal(fail.status, 0, fail.stderr);
  assert.match(fail.stdout, /4 assertion\(s\)/);
  assert.deepEqual(r.show().runs[0].failing, ['orders is gone']);
  const half = r.run('ran', '0', '--by', 'agent', '--line', '2', '--tap', join(FIX, 'tap-incomplete.txt'));
  assert.match(half.stdout, /the plan was not completed/);
  const run = r.show().runs[1];
  assert.deepEqual([run.exit, run.incomplete, run.tests], [1, true, 2]);
});

test('Supabase review: a line is proved only by a run of the agent with at least one assertion', () => {
  const r = project('verify');
  r.run('confirm-env');
  assert.match(r.run('precheck', '1', 'ok').stderr, /no test run of the agent/);
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--tap', join(FIX, 'tap-empty.txt'));
  assert.match(r.run('auto', '1', 'file ran').stderr, /ran no test/);
  r.run('ran', '0', '--by', 'agent', '--line', '1', '--filter', 'supabase/tests/orders_rls.test.sql', '--tap', join(FIX, 'tap-pass.txt'));
  assert.equal(r.run('auto', '1', 'supabase/tests/orders_rls.test.sql: 4 assertions').status, 0);
  const list = r.run('runs-list').stdout;
  assert.match(list, /file `supabase\/tests\/orders_rls.test.sql`: exit 0, 4 assertion\(s\)/);
});

test('Scenario: Run told by the person - recorded as the person\'s, without assertions', () => {
  const r = project();
  r.run('ran', '0');
  assert.match(r.run('runs-list').stdout, /by the person: exit 0, no assertions counted/);
});

test('started-stack: only a Supabase review driven by the agent records it', () => {
  const off = project('off');
  assert.match(off.run('started-stack').stderr, /does not drive/);
  const on = project('precheck');
  on.run('confirm-env');
  assert.equal(on.run('started-stack').status, 0);
  assert.equal(on.show().started_stack, true);
});

test('A waiver of an inconclusive Supabase audit is refused', () => {
  const r = project('off', { dockerStatus: 1 });
  r.run('ran', '0');
  r.run('audit');
  assert.notEqual(r.run('waive', '1', 'because').status, 0);
});

test('A finding of the Postgres audit can be waived with a reason', () => {
  const r = project('off', { dockerLog: fixture('db-log-error.txt') });
  r.run('ran', '0');
  r.run('audit');
  const out = r.run('waive', '1', 'known migration typo, fixed in the next issue');
  assert.equal(out.status, 0, out.stderr);
});

test('supabase-command.mjs exits 0 for an allowed command and 1 with the reason for a refused one', () => {
  const script = new URL('../scripts/supabase-command.mjs', import.meta.url).pathname;
  assert.equal(spawnSync('node', [script, 'supabase', 'test', 'db'], { encoding: 'utf8' }).status, 0);
  const refused = spawnSync('node', [script, 'supabase test db --linked'], { encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(JSON.parse(refused.stdout).reason, /local only/);
  assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
});

test('reset-log takes a new timestamp for the container after a fix', async () => {
  const r = project('off');
  const before = r.show().log.since;
  await new Promise((resolve) => setTimeout(resolve, 20));
  const out = r.run('reset-log');
  assert.equal(out.status, 0, out.stderr);
  assert.ok(r.show().log.since > before);
  assert.match(out.stdout, /container supabase_db_shop is read from/);
});

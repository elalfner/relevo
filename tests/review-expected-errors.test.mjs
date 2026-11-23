import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditApi, auditReport, ownExpectedFatal } from '../scripts/lib/logaudit.mjs';
import { expectedErrorProblem, expectedFatalProblem, parseProfile, resolveProfile } from '../scripts/lib/stack-profile.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const STATE_CLI = join(ROOT, 'scripts/review-state.mjs');
const PROFILE_CLI = join(ROOT, 'scripts/stack-profile.mjs');

// ---------- profile

const header = (list) => `---\nstack: nhost\nreview:\n  expected_errors: ${list}\n---\n`;
const resolve = (stack, repoText) => resolveProfile({
  platform: { stack, path: '.', targets: [] },
  pluginRoot: ROOT,
  read: (p) => (p.startsWith(ROOT) ? readFileSync(p, 'utf8') : p === `.relevo/stacks/${stack}.md` ? repoText : null),
});

test('Scenario: Valid list - the resolved review block has both entries and the plugin log and test', () => {
  const r = resolve('nhost', header('[permiso_denegado, bitacora_inmutable]'));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.profile.review.expected_errors, ['permiso_denegado', 'bitacora_inmutable']);
  assert.equal(r.profile.review.log, 'compose:');
});

test('Scenario: Not a list of strings - the key is named', () => {
  ['permiso_denegado', '[]', '[x, ""]', '[12345]'].forEach((v) => {
    const r = parseProfile(header(v));
    assert.ok(r.errors.some((e) => /review\.expected_errors/.test(e)), v);
  });
});

test('Scenario: Unsafe characters - the entry is refused', () => {
  ['a"b c', 'a`b c', 'a$b c', 'a\\b c', 'a;b cd', 'a\nb c', '-abc', ' abc'].forEach((v) => assert.ok(expectedErrorProblem(v), JSON.stringify(v)));
});

test('Scenario: Reserved word - the entry is named', () => {
  ['FATAL', 'fatal error', 'deadlock detected', 'out of memory', 'ERROR', '"500"', 'fat', 'memory', 'dead'].forEach((v) => {
    const r = parseProfile(header(`[${v}]`));
    assert.ok(r.errors.some((e) => /review\.expected_errors/.test(e)), v);
  });
  assert.equal(expectedErrorProblem('bitacora_inmutable'), null);
  assert.equal(expectedErrorProblem('permiso_denegado: tabla'), null);
  assert.match(expectedErrorProblem('ab'), /3 to 100/);
});

test('Scenario: No default for Nhost - the shipped profile has no list', () => {
  const r = resolve('nhost', null);
  assert.equal(r.ok, true);
  assert.equal(r.profile.review.expected_errors, undefined);
});

test('Scenario: Shipped stack that is not declared - the key is ignored and listed', () => {
  const r = resolve('supabase', '---\nstack: supabase\nreview:\n  expected_errors: [permiso_denegado]\n---\n');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.profile.review.expected_errors, undefined);
  assert.deepEqual(r.profile.ignored.map((i) => i.key), ['review.expected_errors']);
});

test('the plugin profiles never carry the key', () => {
  const r = resolveProfile({ platform: { stack: 'nhost', path: '.', targets: [] }, pluginRoot: ROOT, read: (p) => (p.startsWith(ROOT) ? readFileSync(p, 'utf8') : null) });
  assert.equal(r.ok, true);
});

test('Scenario: Printed for the review - the list and the ignored key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-exp-'));
  mkdirSync(join(dir, '.relevo/stacks'), { recursive: true });
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  backend:\n    stack: nhost\n  db:\n    stack: supabase\n');
  writeFileSync(join(dir, '.relevo/stacks/nhost.md'), header('[permiso_denegado]'));
  writeFileSync(join(dir, '.relevo/stacks/supabase.md'), '---\nstack: supabase\nreview:\n  expected_errors: [permiso_denegado]\n---\n');
  const out = (p) => JSON.parse(spawnSync('node', [PROFILE_CLI, '--config', join(dir, 'relevo.yml'), '--plugin-root', ROOT, '--platform', p, '--role', 'review'], { encoding: 'utf8' }).stdout);
  assert.deepEqual(out('backend').review.expected_errors, ['permiso_denegado']);
  assert.deepEqual(out('backend').review_ignored, []);
  assert.equal(out('db').review.expected_errors, undefined);
  assert.equal(out('db').review_ignored[0].key, 'review.expected_errors');
});

// ---------- audit

const RUN = [{ exit: 0, tests: 5, by: 'person' }];
const LIST = ['bitacora_inmutable', 'permiso_denegado'];
const E = (m) => `2026-11-19 10:00:00 ERROR:  ${m}`;
const audit = (text, over = {}) => auditApi({ text, runs: RUN, flavor: 'declared', expectedErrors: LIST, ...over });

test('Scenario: Provoked errors with a listed code - passes and the report lists the pattern with its count', () => {
  const a = audit([E('bitacora_inmutable: no se puede modificar'), E('bitacora_inmutable: no se puede borrar'), E('permiso_denegado: x')].join('\n'));
  assert.equal(a.verdict, 'REVIEW PASSED');
  assert.equal(a.declaredExpected.length, 3);
  const report = auditReport(a, { issue: 1, scope: { kind: 'api', flavor: 'declared', runs: 1 } });
  assert.match(report, /3 expected error\(s\) that match a pattern the repository declared/);
  assert.match(report, /`bitacora_inmutable`: 2 times/);
  assert.match(report, /waiver stays the person's decision/);
});

test('Scenario: Unlisted error - rejected with a database-error finding', () => {
  const a = audit([E('bitacora_inmutable: x'), E('relation "x" does not exist')].join('\n'));
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.deepEqual(a.counts, { 'database-error': 1 });
});

test('Scenario: Fatal, deadlock, out of memory and 5xx stay findings whatever the list says', () => {
  const lines = [
    '2026 FATAL:  bitacora_inmutable',
    '2026 PANIC:  permiso_denegado',
    E('deadlock detected bitacora_inmutable'),
    E('out of memory permiso_denegado'),
    'GET /x response 500 bitacora_inmutable',
    'ERROR: FATAL: bitacora_inmutable',
  ];
  lines.forEach((l) => {
    const a = audit(l);
    assert.equal(a.verdict, 'REVIEW REJECTED', l);
    assert.equal(a.declaredExpected.length, 0, l);
  });
});

test('Scenario: The match reads the message after ERROR, not the text before it', () => {
  assert.equal(audit('bitacora_inmutable ERROR:  something else').verdict, 'REVIEW REJECTED');
});

test('Scenario: No run recorded - a listed error is a denial finding', () => {
  const a = audit(E('bitacora_inmutable: x'), { runs: [] });
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.deepEqual(a.counts, { denial: 1 });
});

test('Scenario: Empty list or other flavor - classified as before', () => {
  assert.equal(audit(E('bitacora_inmutable: x'), { expectedErrors: [] }).verdict, 'REVIEW REJECTED');
  assert.equal(audit(E('bitacora_inmutable: x'), { flavor: 'postgres' }).verdict, 'REVIEW REJECTED');
  assert.equal(audit(E('bitacora_inmutable: x'), { flavor: 'laravel' }).declaredExpected, undefined);
});

// ---------- init and audit through the CLI

const SPEC = '## ADDED Requirements\n### Requirement: A\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
function project(logText) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-exp-'));
  mkdirSync(join(dir, 'change/specs/cap'), { recursive: true });
  mkdirSync(join(dir, 'bin'), { recursive: true });
  writeFileSync(join(dir, 'change/specs/cap/spec.md'), SPEC);
  writeFileSync(join(dir, 'docker.out'), '');
  writeFileSync(join(dir, 'bin/docker'), `#!/bin/sh\ncase "$*" in *"config --services"*) echo postgres; exit 0;; esac\ncat "${dir}/docker.out"\n`);
  chmodSync(join(dir, 'bin/docker'), 0o755);
  const state = join(dir, 'evidence/review-state.json');
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
  const run = (...args) => spawnSync('node', [STATE_CLI, ...args, '--state', state], { encoding: 'utf8', env, cwd: dir });
  return { dir, run, state, setLog: (t) => writeFileSync(join(dir, 'docker.out'), t), logText };
}

test('init refuses --expected-error without --declared and an invalid entry', () => {
  const p = project();
  const a = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'supabase', '--cwd', p.dir, '--expected-error', 'permiso_denegado');
  assert.notEqual(a.status, 0);
  assert.match(a.stderr, /declared adapter/);
  const b = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', p.dir, '--expected-error', 'FATAL');
  assert.notEqual(b.status, 0);
  assert.match(b.stderr, /--expected-error "FATAL"/);
});

test('a project listing its codes gets REVIEW PASSED, and REVIEW REJECTED when a FATAL appears', () => {
  const p = project();
  const init = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', p.dir, '--expected-error', 'bitacora_inmutable', '--expected-error', 'permiso_denegado');
  assert.equal(init.status, 0, init.stderr);
  assert.deepEqual(JSON.parse(readFileSync(p.state, 'utf8')).expectedErrors, ['bitacora_inmutable', 'permiso_denegado']);
  assert.equal(p.run('ran', '0', '--by', 'person').status, 0);
  p.setLog('postgres-1  | 2026-11-19 ERROR:  bitacora_inmutable: no\npostgres-1  | 2026-11-19 ERROR:  permiso_denegado: no\n');
  const ok = p.run('audit');
  assert.match(ok.stdout, /REVIEW PASSED/, ok.stdout + ok.stderr);
  const state = JSON.parse(readFileSync(p.state, 'utf8'));
  assert.equal(state.audit.declaredExpected.length, 2);
  assert.match(readFileSync(join(p.dir, 'evidence/review-report.md'), 'utf8'), /`bitacora_inmutable`: 1 time/);
  p.setLog('postgres-1  | 2026-11-19 ERROR:  bitacora_inmutable: no\npostgres-1  | 2026-11-19 FATAL:  the database system is shutting down\n');
  assert.match(p.run('audit').stdout, /REVIEW REJECTED/);
  p.setLog('postgres-1  | 2026-11-19 ERROR:  codigo_nuevo: no\n');
  assert.match(p.run('audit').stdout, /REVIEW REJECTED/);
});

// ---------- expected_fatals (declare-expected-fatals): the profile

const AUTOVACUUM = 'terminating autovacuum process due to administrator command';
const fatals = (list) => `---\nstack: nhost\nreview:\n  expected_fatals: ${list}\n---\n`;

test('Scenario: Valid list of fatals - the resolved review block has the entry and the plugin log and test', () => {
  const r = resolve('nhost', fatals(`[${AUTOVACUUM}]`));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.profile.review.expected_fatals, [AUTOVACUUM]);
  assert.equal(r.profile.review.log, 'compose:');
  assert.equal(r.profile.review.expected_errors, undefined, 'the two lists are separate');
});

test('Scenario: Not a list of strings (fatals) and Unsafe characters - the key is named', () => {
  [AUTOVACUUM, '[]', '[x, ""]', '[12345]'].forEach((v) => {
    assert.ok(parseProfile(fatals(v)).errors.some((e) => /review\.expected_fatals/.test(e)), v);
  });
  ['a"b c', 'a`b c', 'a$b c', 'a\\b c', 'a\nb c', '-abc', ' abc'].forEach((v) => assert.ok(expectedFatalProblem(v), JSON.stringify(v)));
});

test('Scenario: Reserved word (fatals) - PANIC, deadlock, out of memory, HTTP, a 5xx status and the FATAL level are refused', () => {
  ['PANIC: could not write', 'deadlock detected', 'out of memory', '"500"', 'response 503', 'FATAL: terminating autovacuum process', 'fatal'].forEach((v) => {
    assert.ok(parseProfile(fatals(`[${v}]`)).errors.some((e) => /review\.expected_fatals/.test(e)), v);
  });
  assert.match(expectedFatalProblem('FATAL: x y'), /without the level/);
  assert.equal(expectedFatalProblem(AUTOVACUUM), null);
  assert.equal(expectedFatalProblem('the database system is shutting down'), null);
  assert.equal(expectedFatalProblem('a fatal mistake in the plan'), null, 'the word may appear inside a message');
});

test('Scenario: No default for Nhost and The plugin own profile - the shipped profile has no list and cannot carry one', () => {
  assert.equal(resolve('nhost', null).profile.review.expected_fatals, undefined);
  const plugin = resolveProfile({
    platform: { stack: 'nhost', path: '.', targets: [] },
    pluginRoot: ROOT,
    read: (p) => (p.startsWith(ROOT) ? readFileSync(p, 'utf8').replace(/^review:/m, `review:\n  expected_fatals: [${AUTOVACUUM}]`) : null),
  });
  assert.equal(plugin.ok, false);
  assert.ok(plugin.errors.some((e) => /review\.expected_fatals.*belongs in the repository/.test(e)));
});

test('Scenario: Shipped stack that is not declared (fatals) - ignored and listed, and printed for the review of nhost', () => {
  const r = resolve('supabase', `---\nstack: supabase\nreview:\n  expected_fatals: [${AUTOVACUUM}]\n---\n`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.profile.review.expected_fatals, undefined);
  assert.ok(r.profile.ignored.some((x) => x.key === 'review.expected_fatals'));
  assert.deepEqual(r.profile.reviewIgnoredKeys, ['review.expected_fatals']);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-fatals-'));
  mkdirSync(join(dir, '.relevo/stacks'), { recursive: true });
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  backend:\n    stack: nhost\n  db:\n    stack: supabase\n');
  writeFileSync(join(dir, '.relevo/stacks/nhost.md'), fatals(`[${AUTOVACUUM}]`));
  writeFileSync(join(dir, '.relevo/stacks/supabase.md'), `---\nstack: supabase\nreview:\n  expected_fatals: [${AUTOVACUUM}]\n---\n`);
  const out = (p) => JSON.parse(spawnSync('node', [PROFILE_CLI, '--config', join(dir, 'relevo.yml'), '--plugin-root', ROOT, '--platform', p, '--role', 'review'], { encoding: 'utf8' }).stdout);
  assert.deepEqual(out('backend').review.expected_fatals, [AUTOVACUUM]);
  assert.equal(out('db').review.expected_fatals, undefined);
  assert.equal(out('db').review_ignored[0].key, 'review.expected_fatals');
});

// ---------- expected_fatals: the audit

const F = (m) => `postgres-1  | 2026-11-19 10:00:00.000 UTC [88] FATAL:  ${m}`;
const fatalAudit = (text, over = {}) => auditApi({ text, runs: RUN, flavor: 'declared', expectedFatals: [AUTOVACUUM], ...over });

test('Scenario: Autovacuum ended by the harness - passes, and the report lists the message with its count', () => {
  const text = [F(AUTOVACUUM), F(AUTOVACUUM), F(AUTOVACUUM), 'postgres-1  | 2026-11-19 10:00:01 UTC [1] LOG:  checkpoint starting: immediate force wait'].join('\n');
  const a = fatalAudit(text);
  assert.equal(a.verdict, 'REVIEW PASSED', JSON.stringify(a.findings));
  assert.equal(a.declaredFatals.length, 3);
  assert.deepEqual(a.findings, []);
  const report = auditReport(a, { scope: { kind: 'api', flavor: 'declared', runs: 1 } });
  assert.match(report, /3 expected fatal\(s\)/);
  assert.match(report, new RegExp(`\`${AUTOVACUUM}\`: 3 times`));
  assert.match(report, /repository's declaration, and a waiver stays the person's decision/);
});

test('Scenario: No run recorded - a listed fatal is a fatal finding', () => {
  const a = fatalAudit(F(AUTOVACUUM), { runs: [] });
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.equal(a.findings[0].class, 'fatal');
});

test('Scenario: A longer or shorter message - each is a fatal finding', () => {
  ['terminating connection due to administrator command', `${AUTOVACUUM}, then more`, 'terminating autovacuum process'].forEach((m) => {
    const a = fatalAudit(F(m));
    assert.equal(a.verdict, 'REVIEW REJECTED', m);
    assert.equal(a.findings[0].class, 'fatal', m);
  });
  assert.equal(fatalAudit(F(`${AUTOVACUUM.replace(/ /g, '   ')}  `)).verdict, 'REVIEW PASSED', 'whitespace is collapsed');
});

test('Scenario: Unlisted fatal - one finding, while the listed one is still excused', () => {
  const a = fatalAudit([F(AUTOVACUUM), F('the database system is shutting down')].join('\n'));
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.equal(a.findings.length, 1);
  assert.match(a.findings[0].excerpt, /shutting down/);
  assert.equal(a.declaredFatals.length, 1);
});

test('Scenario: Fatal signal on a listed message - a line with out of memory, a 500 or a PANIC stays a finding', () => {
  [`${F(AUTOVACUUM)} out of memory`, `${F(AUTOVACUUM)} response 500`, `PANIC:  ${AUTOVACUUM}`].forEach((line) => {
    assert.equal(fatalAudit(line, { expectedFatals: [AUTOVACUUM, 'x'] }).verdict, 'REVIEW REJECTED', line);
  });
  assert.equal(ownExpectedFatal(F(AUTOVACUUM), []), null);
  assert.equal(ownExpectedFatal('ERROR:  x', [AUTOVACUUM]), null, 'only a FATAL line');
});

test('the two lists do not excuse each other, and a Supabase or Laravel audit ignores expected_fatals', () => {
  assert.equal(fatalAudit(F(AUTOVACUUM), { expectedFatals: [], expectedErrors: [AUTOVACUUM] }).verdict, 'REVIEW REJECTED', 'expected_errors never excuses a FATAL');
  assert.equal(fatalAudit(E('bitacora_inmutable: x'), { expectedFatals: [AUTOVACUUM] }).verdict, 'REVIEW REJECTED', 'expected_fatals never excuses an ERROR');
  assert.equal(auditApi({ text: F(AUTOVACUUM), runs: RUN, flavor: 'postgres', expectedFatals: [AUTOVACUUM] }).verdict, 'REVIEW REJECTED');
  assert.equal(fatalAudit('', { expectedFatals: [] }).declaredFatals, undefined, 'an empty list adds nothing to the result');
});

// ---------- expected_fatals: init and audit through the CLI

test('init refuses --expected-fatal without --declared and an invalid entry, and records a valid one in the state', () => {
  const p = project();
  const a = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'supabase', '--cwd', p.dir, '--expected-fatal', AUTOVACUUM);
  assert.notEqual(a.status, 0);
  assert.match(a.stderr, /--expected-fatal goes with a declared adapter/);
  const b = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', p.dir, '--expected-fatal', 'PANIC: could not write');
  assert.notEqual(b.status, 0);
  assert.match(b.stderr, /--expected-fatal "PANIC: could not write"/);
  const c = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', p.dir, '--expected-fatal', AUTOVACUUM);
  assert.equal(c.status, 0, c.stderr);
  assert.deepEqual(JSON.parse(readFileSync(p.state, 'utf8')).expectedFatals, [AUTOVACUUM]);
});

test('a project listing the autovacuum fatal gets REVIEW PASSED, and REVIEW REJECTED for another fatal or one nobody listed', () => {
  const p = project();
  const init = p.run('init', join(p.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', p.dir, '--expected-fatal', AUTOVACUUM);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(p.run('ran', '0', '--by', 'person').status, 0);
  p.setLog(`${F(AUTOVACUUM)}\n${F(AUTOVACUUM)}\npostgres-1  | 2026-11-19 UTC [1] LOG:  checkpoint starting: immediate force wait\n`);
  const ok = p.run('audit');
  assert.match(ok.stdout, /REVIEW PASSED/, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(readFileSync(p.state, 'utf8')).audit.declaredFatals.length, 2);
  assert.match(readFileSync(join(p.dir, 'evidence/review-report.md'), 'utf8'), /2 expected fatal\(s\)/);
  p.setLog(`${F(AUTOVACUUM)}\n${F('the database system is shutting down')}\n`);
  assert.match(p.run('audit').stdout, /REVIEW REJECTED/);
  const none = project();
  none.run('init', join(none.dir, 'change'), '--adapter', 'api', '--stack', 'nhost', '--declared', '--log', 'compose:', '--cwd', none.dir);
  none.run('ran', '0', '--by', 'person');
  none.setLog(`${F(AUTOVACUUM)}\n`);
  assert.match(none.run('audit').stdout, /REVIEW REJECTED/, 'with nothing declared the fatal is a finding, as before');
});

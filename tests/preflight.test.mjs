import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatPreflight, runPreflight } from '../scripts/lib/preflight.mjs';

const VALID = 'limits:\n  run_max_cost: 5\n';
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const bad = (stdout = '') => ({ status: 1, stdout, stderr: '' });
// A fake outside world: every command succeeds unless the test changes its answer.
const world = (over = {}) => (command, args) => {
  const key = [command, ...args].join(' ');
  const answers = {
    'openspec --version': ok('1.14.3'),
    'openspec list --json': ok('{"changes":[],"root":{"path":"/r","source":"nearest"}}'),
    'git status --porcelain': ok(''),
    'gh auth status': ok(),
    ...over,
  };
  return answers[key] ?? bad();
};
const check = (over, checks) => runPreflight({ checks, readConfig: () => VALID, run: world(over) });

test('all the default checks pass in a good environment', () => {
  const r = runPreflight({ readConfig: () => VALID, run: world() });
  assert.equal(r.ok, true);
  assert.deepEqual(r.results.map((x) => x.check), ['config', 'openspec', 'openspec-root', 'clean-tree']);
  assert.equal(formatPreflight(r), 'preflight ok (config, openspec, openspec-root, clean-tree)');
});

test('Scenario: Invalid configuration - the validation output is shown and the fix named', () => {
  const r = runPreflight({ checks: ['config'], readConfig: () => 'review:\n  mode: sometimes\n', run: world() });
  assert.equal(r.ok, false);
  assert.match(formatPreflight(r), /relevo\.yml is not valid:/);
  assert.match(formatPreflight(r), /review\.mode has invalid value "sometimes"/);
  assert.match(formatPreflight(r), /fix: fix it, and check it with node scripts\/validate-config\.mjs/);
});

test('a missing relevo.yml says to run /relevo:init', () => {
  const r = runPreflight({ checks: ['config'], readConfig: () => { throw new Error('ENOENT'); }, run: world() });
  assert.match(formatPreflight(r), /relevo\.yml was not found/);
  assert.match(formatPreflight(r), /\/relevo:init/);
});

test('Scenario: OpenSpec is missing - the run stops, gives the install command and forbids writing the change by hand', () => {
  const out = formatPreflight(check({ 'openspec --version': { status: 127, stdout: '', stderr: '' } }, ['openspec']));
  assert.match(out, /Stop here: do not go on from memory/);
  assert.match(out, /nothing under openspec\/changes\/ by hand|anything under openspec\/changes\/ by hand/);
  assert.match(out, /npm install --global @fission-ai\/openspec/);
});

test('OpenSpec that does not run is reported with /relevo:doctor', () => {
  const r = check({ 'openspec --version': { status: 127, stdout: '', stderr: '' } }, ['openspec']);
  assert.equal(r.ok, false);
  assert.match(formatPreflight(r), /the OpenSpec command line does not run[\s\S]*\/relevo:doctor/);
});

test('Scenario: No OpenSpec root - "root": null is the answer, even when the command exits with an error', () => {
  const r = check({ 'openspec list --json': bad('{"changes":[],"root":null}') }, ['openspec-root']);
  assert.equal(r.ok, false);
  assert.match(formatPreflight(r), /OpenSpec finds no root for this repository/);
  assert.equal(check({ 'openspec list --json': bad('not json') }, ['openspec-root']).ok, false);
  assert.equal(check({ 'openspec list --json': ok('{}') }, ['openspec-root']).ok, false);
});

test('Scenario: Uncommitted changes - the first files are listed and the rest counted', () => {
  const dirty = Array.from({ length: 7 }, (_, i) => ` M file${i}.dart`).join('\n');
  const r = check({ 'git status --porcelain': ok(`${dirty}\n`) }, ['clean-tree']);
  assert.equal(r.ok, false);
  const text = formatPreflight(r);
  assert.match(text, /the working tree has uncommitted changes:/);
  assert.match(text, / M file0\.dart/);
  assert.match(text, /and 2 more/);
  assert.match(text, /commit or stash them first/);
});

test('the GitHub login is only checked when asked for', () => {
  const signedOut = { 'gh auth status': bad() };
  assert.equal(runPreflight({ readConfig: () => VALID, run: world(signedOut) }).ok, true);
  const r = check(signedOut, ['gh']);
  assert.equal(r.ok, false);
  assert.match(formatPreflight(r), /gh auth login/);
});

test('every failing check is reported, not only the first', () => {
  const r = runPreflight({ readConfig: () => 'x: [', run: world({ 'git status --porcelain': ok(' M a\n'), 'openspec --version': bad() }) });
  assert.equal(r.results.filter((x) => !x.ok).length, 3);
});

test('an unknown check name is an error that lists the valid ones', () => {
  assert.throws(() => runPreflight({ checks: ['config', 'luck'], readConfig: () => VALID, run: world() }), /unknown check "luck": expected one of config, openspec, openspec-root, clean-tree, gh/);
});

// ---------- The command, with a fake OpenSpec in the PATH so the test needs nothing installed

function sandbox({ config = VALID, rootNull = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-pre-'));
  execFileSync('git', ['init', '-q', '-b', 'dev'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'a@b'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'relevo.yml'), config);
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: dir });
  const bin = join(dir, '..', `bin-${Math.random().toString(36).slice(2)}`);
  mkdirSync(bin);
  writeFileSync(join(bin, 'openspec'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 1.14.3; exit 0; fi\n${rootNull ? 'echo \'{"changes":[],"root":null}\'; exit 1' : 'echo \'{"changes":[],"root":{"path":"/r"}}\'; exit 0'}\n`);
  chmodSync(join(bin, 'openspec'), 0o755);
  return { dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } };
}
const CLI = new URL('../scripts/preflight.mjs', import.meta.url).pathname;
const cli = (s, ...args) => spawnSync('node', [CLI, ...args], { cwd: s.dir, env: s.env, encoding: 'utf8' });

test('the command exits 0 when everything is in order', () => {
  const r = cli(sandbox());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^preflight ok/);
});

test('the command exits 1 and prints each failure with its fix', () => {
  const s = sandbox({ rootNull: true });
  writeFileSync(join(s.dir, 'new.txt'), 'x\n');
  const r = cli(s);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /openspec-root: OpenSpec finds no root/);
  assert.match(r.stderr, /clean-tree: the working tree has uncommitted changes/);
});

test('the command exits 2 for an unknown check', () => {
  const r = cli(sandbox(), '--checks', 'config,luck');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown check "luck"/);
});

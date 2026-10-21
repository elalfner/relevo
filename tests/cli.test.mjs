import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute, isInsideGitRepo, parseArgs, resolveScope, scopeChoices, steps } from '../scripts/lib/cli.mjs';

const cli = new URL('../scripts/cli.mjs', import.meta.url).pathname;

function fakeClaude(failOn = null) {
  const calls = [];
  return {
    calls,
    deps: {
      has: (c) => c === 'claude',
      version: '9.9.9',
      doctorScript: 'doctor.mjs',
      run: (cmd, args) => {
        calls.push([cmd, ...args].join(' '));
        return failOn && args.includes(failOn) ? { code: 1, output: 'boom\n' } : { code: 0, output: '' };
      }
    }
  };
}

test('the arguments are checked: a command is required, a scope must be known', () => {
  assert.equal(parseArgs([]).command, 'help');
  assert.match(parseArgs(['frobnicate']).error, /unknown command/);
  assert.match(parseArgs(['install', '--scope', 'galaxy']).error, /scope must be one of/);
  assert.match(parseArgs(['install', '--wat']).error, /unknown option/);
  assert.deepEqual(parseArgs(['install']), { command: 'install', scope: null }, 'no scope given: the command decides');
  assert.deepEqual(parseArgs(['update']), { command: 'update', scope: null });
  assert.deepEqual(parseArgs(['install', '--scope=project']), { command: 'install', scope: 'project' });
  assert.deepEqual(parseArgs(['update', '--scope', 'local']), { command: 'update', scope: 'local' });
});

for (const scope of ['user', 'project', 'local']) {
  test(`install for the ${scope} scope adds the marketplace sparsely and installs the plugin with the same scope`, () => {
    const { calls, deps } = fakeClaude();
    const r = execute({ command: 'install', scope }, deps);
    assert.equal(r.code, 0);
    assert.deepEqual(calls, [
      `claude plugin marketplace add elalfner/relevo --scope ${scope} --sparse .claude-plugin`,
      `claude plugin install relevo@relevo --scope ${scope}`
    ]);
    assert.match(r.lines.at(-1), /Relevo is installed/);
  });
}

test('install says what was done when a step fails, and that repeating it is safe', () => {
  const { deps } = fakeClaude('install');
  const r = execute({ command: 'install', scope: 'user' }, deps);
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /install the plugin" failed; the steps before it were done \(add the marketplace/);
  assert.match(r.lines.join('\n'), /safe to repeat/);
});

test('without Claude Code it stops, says how to get it and changes nothing', () => {
  const calls = [];
  const r = execute({ command: 'install', scope: 'user' }, { has: () => false, run: (...a) => { calls.push(a); return { code: 0, output: '' }; }, version: '1', doctorScript: 'd' });
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /Claude Code is required/);
  assert.match(r.lines.join('\n'), /nothing was changed/);
  assert.deepEqual(calls, []);
});

test('update refreshes the marketplace and then the plugin; version prints the version', () => {
  assert.deepEqual(steps('update', 'project').map((s) => s.args.join(' ')), [
    'plugin marketplace update relevo',
    'plugin update relevo@relevo --scope project'
  ]);
  assert.deepEqual(execute({ command: 'version' }, fakeClaude().deps), { code: 0, lines: ['9.9.9'] });
});

test('the real entry point installs through a fake claude on the path and prints the usage on a mistake', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-cli-'));
  writeFileSync(join(dir, 'claude'), '#!/bin/sh\necho "claude $@" >> "$LOG"\nexit 0\n');
  chmodSync(join(dir, 'claude'), 0o755);
  const log = join(dir, 'log');
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, LOG: log };
  const out = execFileSync(process.execPath, [cli, 'install', '--scope', 'project'], { env, encoding: 'utf8' });
  assert.match(out, /Relevo is installed for this repository/);
  const bad = spawnSync(process.execPath, [cli, 'nope'], { env, encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /usage: relevo/);
});

// Get started shows one way to install, with the project scope written out; the shortcut is for the other pages.
test('the install pages and the cover show the same commands as the ones the command line runs', () => {
  const doc = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const expected = steps('install', 'user').map((s) => `claude ${s.args.filter((a, i, all) => !(a === '--scope' || all[i - 1] === '--scope')).join(' ')}`);
  for (const p of ['docs/install.md', 'docs/install.es.md', 'README.md', 'README.es.md']) {
    const text = doc(p);
    expected.forEach((line) => assert.ok(text.includes(line), `${p} shows "${line}"`));
    assert.match(text, /npm install -g @elalfner\/relevo/, p);
    assert.match(text, /relevo install --scope project/, p);
  }
});

test('Scenario: Choosing in a terminal - in a repository the project is preselected, outside one the machine', () => {
  assert.deepEqual(resolveScope({ interactive: true, inRepo: true }), { ask: true, preferred: 'project' });
  assert.deepEqual(resolveScope({ interactive: true, inRepo: false }), { ask: true, preferred: 'user' });
  assert.deepEqual(resolveScope({ given: 'local', interactive: true, inRepo: true }), { scope: 'local' }, 'a given scope skips the question');
});

test('Scenario: No terminal - it never waits: project in a repository, machine outside one, and it says why', () => {
  const inRepo = resolveScope({ interactive: false, inRepo: true });
  assert.equal(inRepo.scope, 'project');
  assert.match(inRepo.reason, /no --scope given and no terminal: this folder is inside a git repository, so the project scope is used/);
  const out = resolveScope({ interactive: false, inRepo: false });
  assert.equal(out.scope, 'user');
  assert.match(out.reason, /not inside a git repository, so the machine scope is used/);
  assert.equal(resolveScope({ given: 'user', interactive: false, inRepo: true }).reason, undefined);
});

test('Scenario: Not inside a repository - the list says so; the project option names the folder', () => {
  const inside = scopeChoices({ cwd: '/work/app', inRepo: true });
  assert.deepEqual(inside.map((c) => c.value), ['project', 'user', 'local']);
  assert.match(inside[0].label, /^Project \(\/work\/app\): declared in \.claude\/settings\.json/);
  assert.doesNotMatch(inside[0].label, /not a git repository/);
  assert.match(scopeChoices({ cwd: '/home/ana', inRepo: false })[0].label, /\[not a git repository\]/);
});

test('git decides whether the folder is a repository, and a missing git counts as no', () => {
  assert.equal(isInsideGitRepo(() => ({ code: 0, output: 'true\n' })), true);
  assert.equal(isInsideGitRepo(() => ({ code: 128, output: 'fatal: not a git repository' })), false);
  assert.equal(isInsideGitRepo(() => ({ code: 1, output: '' })), false);
});

test('Scenario: Updating - no scope is passed unless the person gives one', () => {
  assert.deepEqual(steps('update', null).map((s) => s.args.join(' ')), ['plugin marketplace update relevo', 'plugin update relevo@relevo']);
  assert.deepEqual(steps('update', 'project').map((s) => s.args.join(' ')), ['plugin marketplace update relevo', 'plugin update relevo@relevo --scope project']);
  const { calls, deps } = fakeClaude();
  const r = execute({ command: 'update', scope: null }, deps);
  assert.equal(r.code, 0);
  assert.deepEqual(calls, ['claude plugin marketplace update relevo', 'claude plugin update relevo@relevo']);
});

test('the installed message names the scope and where it was written', () => {
  const { deps } = fakeClaude();
  const at = (scope) => execute({ command: 'install', scope }, { ...deps, cwd: '/work/app' }).lines.join('\n');
  assert.match(at('project'), /Scope: project \(\.claude\/settings\.json of \/work\/app, so commit it to share it\)\./);
  assert.match(at('user'), /Scope: user \(your user settings\)\./);
  assert.match(at('local'), /Scope: local \(\.claude\/settings\.local\.json of \/work\/app\)\./);
});

function fakeBin(dir) {
  writeFileSync(join(dir, 'claude'), '#!/bin/sh\necho "claude $@" >> "$LOG"\nexit 0\n');
  chmodSync(join(dir, 'claude'), 0o755);
}

test('Scenario: No terminal - the real command uses the project inside a git repository and the machine outside one, without waiting', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-cli-scope-'));
  fakeBin(dir);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, LOG: join(dir, 'log') };
  const repo = mkdtempSync(join(tmpdir(), 'relevo-cli-repo-'));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const inRepo = spawnSync(process.execPath, [cli, 'install'], { cwd: repo, env, encoding: 'utf8', input: '', timeout: 15000 });
  assert.equal(inRepo.status, 0, inRepo.stderr);
  assert.match(inRepo.stdout, /relevo: no --scope given and no terminal: this folder is inside a git repository, so the project scope is used\./);
  assert.match(readFileSync(join(dir, 'log'), 'utf8'), /claude plugin install relevo@relevo --scope project/);
  const plain = mkdtempSync(join(tmpdir(), 'relevo-cli-plain-'));
  const outside = spawnSync(process.execPath, [cli, 'install'], { cwd: plain, env: { ...env, GIT_CEILING_DIRECTORIES: tmpdir() }, encoding: 'utf8', input: '', timeout: 15000 });
  assert.equal(outside.status, 0, outside.stderr);
  assert.match(outside.stdout, /so the machine scope is used\./);
  assert.match(readFileSync(join(dir, 'log'), 'utf8'), /claude plugin install relevo@relevo --scope user/);
});

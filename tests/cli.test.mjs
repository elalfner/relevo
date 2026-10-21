import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute, parseArgs, steps } from '../scripts/lib/cli.mjs';

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
  assert.deepEqual(parseArgs(['install']), { command: 'install', scope: 'user' });
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

test('the install pages show the same commands as the ones the command line runs', () => {
  const doc = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const expected = steps('install', 'user').map((s) => `claude ${s.args.filter((a, i, all) => !(a === '--scope' || all[i - 1] === '--scope')).join(' ')}`);
  for (const p of ['docs/install.md', 'docs/install.es.md', 'docs/get-started.md', 'docs/get-started.es.md', 'README.md', 'README.es.md']) {
    const text = doc(p);
    expected.forEach((line) => assert.ok(text.includes(line), `${p} shows "${line}"`));
    assert.match(text, /npm install -g @elalfner\/relevo/, p);
    assert.match(text, /relevo install --scope project/, p);
  }
});

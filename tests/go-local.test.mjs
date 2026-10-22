import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { planLocalRun, runLocal } from '../scripts/lib/go-local.mjs';
import { runFlags } from '../scripts/lib/run-flags.mjs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));
const REPO = '/home/me/code/shop';

/** A fake runner: records every call; `fail` maps "cmd arg0 arg1" prefixes to errors, `streamStatus` is the run's exit status. */
function fakeRunner({ fail = {}, streamStatus = 0, variable = null } = {}) {
  const calls = [];
  return {
    calls,
    capture(cmd, args, options) {
      calls.push({ kind: 'capture', cmd, args, cwd: options.cwd });
      const key = `${cmd} ${args.slice(0, 2).join(' ')}`;
      if (key in fail) throw Object.assign(new Error(fail[key].message ?? 'failed'), fail[key]);
      if (cmd === 'git' && args[0] === 'rev-parse') return `${REPO}\n`;
      if (cmd === 'gh' && args[0] === 'variable') {
        if (variable === null) throw new Error('HTTP 404');
        return `${variable}\n`;
      }
      return '';
    },
    stream(cmd, args, options) {
      calls.push({ kind: 'stream', cmd, args, cwd: options.cwd, env: options.env });
      if (streamStatus === 'ENOENT') throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
      return streamStatus;
    },
  };
}
const run = (runner, extra = {}) => runLocal({ issue: '42', config, runner, ...extra });

test('Scenario: Local build - a worktree from the base branch, claude -p with the flags of the workflow, removed on a clean end', () => {
  const runner = fakeRunner();
  const r = run(runner);
  assert.equal(r.status, 0);
  assert.equal(r.removed, true);
  assert.equal(r.worktree, '/home/me/code/.relevo-worktrees/shop-42');
  const git = runner.calls.filter((c) => c.cmd === 'git').map((c) => c.args.join(' '));
  assert.ok(git.includes('fetch origin dev'));
  assert.ok(git.includes('worktree add --detach /home/me/code/.relevo-worktrees/shop-42 origin/dev'));
  assert.ok(git.includes('worktree remove --force /home/me/code/.relevo-worktrees/shop-42'));
  const claude = runner.calls.find((c) => c.kind === 'stream');
  assert.equal(claude.cmd, 'claude');
  assert.deepEqual(claude.args, ['-p', '/relevo:go 42', ...runFlags(config)]);
  assert.equal(claude.cwd, r.worktree);
  assert.equal(claude.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, '1');
});

test('the worktree lies outside the repository, so uncommitted changes in it do not matter', () => {
  const plan = planLocalRun({ issue: '7', repoRoot: REPO, config });
  assert.ok(!plan.worktree.startsWith(`${REPO}/`));
  assert.equal(plan.git[1][1], 'add');
});

test('Scenario: Local build with Antigravity - agent-guard run with the limits, a time limit and a summary outside the worktree', () => {
  const agyConfig = { ...config, agent: { build: 'antigravity' } };
  const plan = planLocalRun({ issue: '42', repoRoot: REPO, config: agyConfig });
  assert.equal(plan.claude[0], 'node');
  const [guard, mode, ...rest] = plan.claude[1];
  assert.match(guard, /scripts\/agent-guard\.mjs$/);
  assert.ok(!guard.startsWith(REPO), 'the guard belongs to the plugin, not to the project');
  assert.equal(mode, 'run');
  assert.ok(!rest.includes('--') && !rest.includes('agy'));
  const at = (name) => rest[rest.indexOf(name) + 1];
  assert.equal(at('--prompt'), '/relevo:go 42');
  assert.equal(at('--config'), 'relevo.yml');
  assert.equal(at('--timeout-minutes'), '50');
  assert.ok(!at('--summary').startsWith(plan.worktree));
  assert.deepEqual(plan.env, {});

  const runner = fakeRunner();
  const r = runLocal({ issue: '42', config: agyConfig, runner });
  assert.equal(r.status, 0);
  const spawned = runner.calls.find((c) => c.kind === 'stream');
  assert.equal(spawned.cmd, 'node');
  assert.equal(spawned.args[1], 'run');

  const enoent = runLocal({ issue: '42', config: agyConfig, runner: fakeRunner({ streamStatus: 'ENOENT' }) });
  assert.match(enoent.messages.join('\n'), /the agy or node command was not found/);
});

test('Scenario: The guard accepts the planned command (real argument parser, stub agy)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-guard-test-'));
  const stub = join(dir, 'agy');
  writeFileSync(stub, '#!/bin/sh\necho \'{"type":"result","result":"ok"}\'\nexit 0\n');
  chmodSync(stub, 0o755);
  const agyConfig = { ...config, agent: { build: 'antigravity' } };
  const plan = planLocalRun({ issue: '42', repoRoot: REPO, config: agyConfig });
  const args = [...plan.claude[1], '--agy', stub, '--max-turns', '5', '--max-tokens', '5000'];
  // the temp folder has no relevo.yml: the limits come from the flags instead of --config
  args.splice(args.indexOf('--config'), 2);
  const r = spawnSync('node', args, { cwd: dir, encoding: 'utf8' });
  assert.ok(r.status !== 2, `the guard rejected the planned arguments: ${r.stderr}`);
  rmSync(dir, { recursive: true, force: true });
});

test('Scenario: The guard rejects the command - the worktree is kept and its path printed', () => {
  const agyConfig = { ...config, agent: { build: 'antigravity' } };
  const r = runLocal({ issue: '42', config: agyConfig, runner: fakeRunner({ streamStatus: 2 }) });
  assert.equal(r.status, 2);
  assert.equal(r.removed, false);
  const out = r.messages.join('\n');
  assert.match(out, /the run guard refused to start/);
  assert.ok(out.includes(r.worktree));
});

test('Scenario: Run fails - the worktree stays and its path is printed', () => {
  const runner = fakeRunner({ streamStatus: 3 });
  const r = run(runner);
  assert.equal(r.status, 3);
  assert.equal(r.removed, false);
  assert.ok(!runner.calls.some((c) => c.args.includes('remove')));
  assert.match(r.messages.join('\n'), /status 3; the worktree is kept for inspection: \/home\/me\/code\/\.relevo-worktrees\/shop-42/);
});

test('Scenario: Cloud can also build it - a warning when the workflow is installed and the variable is not off', () => {
  const warns = (over) => run(fakeRunner({ variable: over.variable ?? null }), { workflowPresent: over.workflowPresent }).messages.some((m) => /the cloud can also build this issue/.test(m));
  assert.equal(warns({ workflowPresent: true }), true);
  assert.equal(warns({ workflowPresent: true, variable: 'on' }), true);
  assert.equal(warns({ workflowPresent: true, variable: 'off' }), false);
  assert.equal(warns({ workflowPresent: false }), false);
  const text = run(fakeRunner(), { workflowPresent: true }).messages.join('\n');
  assert.match(text, /RELEVO_CLOUD_GO to `off`/);
});

test('--dry-run prints the plan and runs nothing', () => {
  const runner = fakeRunner();
  const r = run(runner, { dryRun: true });
  assert.equal(r.status, 0);
  assert.ok(!runner.calls.some((c) => c.kind === 'stream' || (c.cmd === 'git' && c.args[0] !== 'rev-parse')));
  assert.match(r.messages.join('\n'), /worktree: .*shop-42 \(from origin\/dev\)/);
  assert.match(r.messages.join('\n'), /command: claude -p "\/relevo:go 42" --max-turns 100 --max-budget-usd 5 --allowedTools/);
});

test('missing pieces are explained: no claude, no gh, not signed in, not a repository, a bad issue, an existing worktree', () => {
  assert.match(run(fakeRunner({ streamStatus: 'ENOENT' })).messages.join('\n'), /claude command was not found: install Claude Code/);
  assert.equal(run(fakeRunner({ streamStatus: 'ENOENT' })).status, 127);
  assert.match(run(fakeRunner({ fail: { 'gh auth status': { code: 'ENOENT' } } })).messages[0], /gh\) is not installed/);
  assert.match(run(fakeRunner({ fail: { 'gh auth status': {} } })).messages[0], /not signed in: run `gh auth login`/);
  assert.match(run(fakeRunner({ fail: { 'git rev-parse --show-toplevel': {} } })).messages[0], /not inside a git repository/);
  assert.equal(runLocal({ issue: 'abc', config, runner: fakeRunner() }).status, 2);
  const taken = run(fakeRunner(), { exists: () => true });
  assert.equal(taken.status, 2);
  assert.match(taken.messages[0], /already exists/);
});

test('a worktree that cannot be prepared stops before claude runs', () => {
  const runner = fakeRunner({ fail: { 'git fetch origin': { message: 'fatal: unable to access' } } });
  const r = run(runner);
  assert.equal(r.status, 1);
  assert.match(r.messages.join('\n'), /could not prepare the worktree: fatal: unable to access/);
  assert.ok(!runner.calls.some((c) => c.kind === 'stream'));
});

test('the command-line wrapper rejects a missing issue and a missing relevo.yml', () => {
  const cli = `${root}scripts/go-local.mjs`;
  assert.equal(spawnSync('node', [cli, '--config', '/nonexistent/relevo.yml', '5'], { encoding: 'utf8' }).status, 2);
  const noIssue = spawnSync('node', [cli, '--config', `${root}templates/relevo.yml`, '--dry-run'], { encoding: 'utf8', cwd: root });
  assert.equal(noIssue.status, 2);
  assert.match(noIssue.stdout + noIssue.stderr, /give the issue number/);
});

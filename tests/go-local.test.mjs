import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { NO_STATE, planLocalRun, runLocal } from '../scripts/lib/go-local.mjs';
import { runFlags } from '../scripts/lib/run-flags.mjs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));
const REPO = '/home/me/code/shop';

/** A fake runner: records every call; `fail` maps "cmd arg0 arg1" prefixes to errors, `streamStatus` is the run's exit status. */
function fakeRunner({ fail = {}, streamStatus = 0, variable = null, stdout = '', whenRun = null } = {}) {
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
    run(cmd, args, options) {
      calls.push({ kind: 'stream', cmd, args, cwd: options.cwd, env: options.env });
      if (streamStatus === 'ENOENT') return Promise.reject(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }));
      return whenRun ? whenRun().then(() => ({ status: streamStatus, stdout })) : Promise.resolve({ status: streamStatus, stdout });
    },
  };
}
const run = async (runner, extra = {}) => runLocal({ issue: "42", config, runner, ...extra });

test('Scenario: Local build - a worktree from the base branch, claude -p with the flags of the workflow, removed on a clean end', async () => {
  const runner = fakeRunner();
  const r = await run(runner);
  assert.equal(r.status, 0);
  assert.equal(r.removed, true);
  assert.equal(r.worktree, '/home/me/code/.relevo-worktrees/shop-42');
  const git = runner.calls.filter((c) => c.cmd === 'git').map((c) => c.args.join(' '));
  assert.ok(git.includes('fetch origin dev'));
  assert.ok(git.includes('worktree add --detach /home/me/code/.relevo-worktrees/shop-42 origin/dev'));
  assert.ok(git.includes('worktree remove --force /home/me/code/.relevo-worktrees/shop-42'));
  const claude = runner.calls.find((c) => c.kind === 'stream');
  assert.equal(claude.cmd, 'claude');
  assert.deepEqual(claude.args, ['-p', '/relevo:go 42', ...runFlags(config, { json: true })]);
  assert.equal(claude.cwd, r.worktree);
  assert.equal(claude.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, '1');
});

test('the worktree lies outside the repository, so uncommitted changes in it do not matter', async () => {
  const plan = planLocalRun({ issue: '7', repoRoot: REPO, config });
  assert.ok(!plan.worktree.startsWith(`${REPO}/`));
  assert.equal(plan.git[1][1], 'add');
});

test('Scenario: Local build with Antigravity - agent-guard run with the limits, a time limit and a summary outside the worktree', async () => {
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
  const r = await runLocal({ issue: '42', config: agyConfig, runner });
  assert.equal(r.status, 0);
  const spawned = runner.calls.find((c) => c.kind === 'stream');
  assert.equal(spawned.cmd, 'node');
  assert.equal(spawned.args[1], 'run');

  const enoent = await runLocal({ issue: '42', config: agyConfig, runner: fakeRunner({ streamStatus: 'ENOENT' }) });
  assert.match(enoent.messages.join('\n'), /the agy or node command was not found/);
});

test('Scenario: The guard accepts the planned command (real argument parser, stub agy)', async () => {
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

test('Scenario: The guard rejects the command - the worktree is kept and its path printed', async () => {
  const agyConfig = { ...config, agent: { build: 'antigravity' } };
  const r = await runLocal({ issue: '42', config: agyConfig, runner: fakeRunner({ streamStatus: 2 }) });
  assert.equal(r.status, 2);
  assert.equal(r.removed, false);
  const out = r.messages.join('\n');
  assert.match(out, /the run guard refused to start/);
  assert.ok(out.includes(r.worktree));
});

test('Scenario: Run fails - the worktree stays and its path is printed', async () => {
  const runner = fakeRunner({ streamStatus: 3 });
  const r = await run(runner);
  assert.equal(r.status, 3);
  assert.equal(r.removed, false);
  assert.ok(!runner.calls.some((c) => c.args.includes('remove')));
  assert.match(r.messages.join('\n'), /status 3; the worktree is kept for inspection: \/home\/me\/code\/\.relevo-worktrees\/shop-42/);
});

test('Scenario: Local build - no cloud warning and the variable of the cloud is not read, because a local build starts no cloud', async () => {
  for (const variable of [null, 'on', 'off']) {
    const runner = fakeRunner({ variable });
    const r = await run(runner);
    assert.equal(r.status, 0);
    assert.ok(!r.messages.some((m) => /cloud/.test(m)), `no cloud warning with the variable ${variable}`);
    assert.ok(!runner.calls.some((c) => c.cmd === 'gh' && c.args[0] === 'variable'), 'RELEVO_CLOUD_GO is not read');
  }
});

test('--dry-run prints the plan and runs nothing', async () => {
  const runner = fakeRunner();
  const r = await run(runner, { dryRun: true });
  assert.equal(r.status, 0);
  assert.ok(!runner.calls.some((c) => c.kind === 'stream' || (c.cmd === 'git' && c.args[0] !== 'rev-parse')));
  assert.match(r.messages.join('\n'), /worktree: .*shop-42 \(from origin\/dev\)/);
  assert.match(r.messages.join('\n'), /command: claude -p "\/relevo:go 42" --output-format json --max-turns 100 --max-budget-usd 5 --allowedTools/);
});

test('missing pieces are explained: no claude, no gh, not signed in, not a repository, a bad issue, an existing worktree', async () => {
  assert.match((await run(fakeRunner({ streamStatus: 'ENOENT' }))).messages.join('\n'), /claude command was not found: install Claude Code/);
  assert.equal((await run(fakeRunner({ streamStatus: 'ENOENT' }))).status, 127);
  assert.match((await run(fakeRunner({ fail: { 'gh auth status': { code: 'ENOENT' } } }))).messages[0], /gh\) is not installed/);
  assert.match((await run(fakeRunner({ fail: { 'gh auth status': {} } }))).messages[0], /not signed in: run `gh auth login`/);
  assert.match((await run(fakeRunner({ fail: { 'git rev-parse --show-toplevel': {} } }))).messages[0], /not inside a git repository/);
  assert.equal((await runLocal({ issue: 'abc', config, runner: fakeRunner() })).status, 2);
  const taken = await run(fakeRunner(), { exists: () => true });
  assert.equal(taken.status, 2);
  assert.match(taken.messages[0], /already exists/);
});

test('a worktree that cannot be prepared stops before claude runs', async () => {
  const runner = fakeRunner({ fail: { 'git fetch origin': { message: 'fatal: unable to access' } } });
  const r = await run(runner);
  assert.equal(r.status, 1);
  assert.match(r.messages.join('\n'), /could not prepare the worktree: fatal: unable to access/);
  assert.ok(!runner.calls.some((c) => c.kind === 'stream'));
});

test('the command-line wrapper rejects a missing issue and a missing relevo.yml', async () => {
  const cli = `${root}scripts/go-local.mjs`;
  assert.equal(spawnSync('node', [cli, '--config', '/nonexistent/relevo.yml', '5'], { encoding: 'utf8' }).status, 2);
  const noIssue = spawnSync('node', [cli, '--config', `${root}templates/relevo.yml`, '--dry-run'], { encoding: 'utf8', cwd: root });
  assert.equal(noIssue.status, 2);
  assert.match(noIssue.stdout + noIssue.stderr, /give the issue number/);
});

test('Scenario: Local retry - the agent runs /relevo:go <n> --retry with the same limits, and the cloud is not asked about', async () => {
  const runner = fakeRunner();
  const r = await run(runner, { retry: true });
  assert.equal(r.status, 0);
  const claude = runner.calls.find((c) => c.kind === 'stream');
  assert.deepEqual(claude.args, ['-p', '/relevo:go 42 --retry', ...runFlags(config, { json: true })]);
  assert.ok(!runner.calls.some((c) => c.cmd === 'gh' && c.args[0] === 'variable'), 'the cloud variable is not read');
  assert.ok(!r.messages.some((m) => /cloud/.test(m)), 'no cloud warning for a retry');
});

test('the source of the local run no longer reads RELEVO_CLOUD_GO', () => {
  assert.doesNotMatch(readFileSync(`${root}scripts/lib/go-local.mjs`, 'utf8'), /RELEVO_CLOUD_GO|cloudBuilds/);
});

test('the dry run shows the retry flag, and Antigravity gets it in its prompt', async () => {
  const dry = await run(fakeRunner(), { retry: true, dryRun: true });
  assert.match(dry.messages.join('\n'), /\/relevo:go 42 --retry/);
  const agy = planLocalRun({ issue: '42', repoRoot: REPO, config: { ...config, agent: { ...config.agent, build: 'antigravity' } }, retry: true });
  assert.ok(agy.claude[1].includes('/relevo:go 42 --retry'));
});

test('Scenario: the build gets its state folder as RELEVO_PROGRESS_DIR, made before it starts and outside every working tree', async () => {
  const prepared = [];
  const runner = fakeRunner();
  const r = await run(runner, { state: { ...NO_STATE, prepare: (d) => { prepared.push(d); return true; } } });
  const stream = runner.calls.find((c) => c.kind === 'stream');
  assert.equal(stream.env.RELEVO_PROGRESS_DIR, '/home/me/code/.relevo-worktrees/.state/shop-42');
  assert.deepEqual(prepared, [stream.env.RELEVO_PROGRESS_DIR]);
  assert.ok(!stream.env.RELEVO_PROGRESS_DIR.startsWith(`${REPO}/`) && !stream.env.RELEVO_PROGRESS_DIR.startsWith(`${r.worktree}/`));
  assert.equal(stream.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, '1');
  // the state stays when the worktree is removed
  assert.ok(!runner.calls.some((c) => c.cmd === 'git' && c.args.join(' ').includes('.state')));
});

test('when the state folder cannot be made the build runs as today, without the variable', async () => {
  const runner = fakeRunner();
  const r = await run(runner, { state: { ...NO_STATE, prepare: () => false } });
  assert.equal(r.status, 0);
  assert.equal(runner.calls.find((c) => c.kind === 'stream').env.RELEVO_PROGRESS_DIR, undefined);
});

// ---------- the progress lines of a build, from snapshots (the state folder is injected, and so are the clock and the sleep)

const snap = (over = {}) => ({
  issue: 42, changeId: '42-x', phase: { phase: 'development', attempt: null, of: null }, group: null, tasks: null,
  startedAt: 0, lastChange: 0, minutes: 0, lenses: [], agents: [], outcome: null, totals: null, ended: null, ...over,
});

/** A run that takes one sleep per snapshot: each sleep moves the clock one minute and shows the next snapshot, then the run ends. */
function scripted(snapshots, runnerOptions = {}) {
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  let shown = null;
  let next = 0;
  let clock = 0;
  const saved = [];
  const totals = [];
  const state = {
    ...NO_STATE,
    snapshot: () => shown,
    start: () => { shown = snapshots[next++] ?? null; },
    end: () => {},
    totals: (dir, t) => totals.push(t),
    save: (dir, s) => saved.push(s),
    read: (path) => runnerOptions.summary ?? null,
  };
  const sleep = async () => {
    clock += 60000;
    if (next < snapshots.length) shown = { ...snapshots[next++], minutes: Math.floor(clock / 60000) };
    else finish();
    await new Promise((resolve) => setImmediate(resolve));
  };
  const runner = fakeRunner({ ...runnerOptions, whenRun: () => done });
  const lines = [];
  return { runner, state, sleep, now: () => clock, lines, print: (m) => lines.push(m), saved, totals };
}
const withTicks = (t, extra = {}) => run(t.runner, { state: t.state, sleep: t.sleep, now: t.now, print: t.print, ...extra });

test('Scenario: A build with three groups - a line for each phase and group, with the minutes', async () => {
  const t = scripted([
    snap({ phase: { phase: 'planning', attempt: null, of: null } }),
    snap({ phase: { phase: 'development', attempt: null, of: null }, group: { group: 1, of: 3 }, tasks: { done: 0, total: 6 } }),
    snap({ phase: { phase: 'development', attempt: null, of: null }, group: { group: 2, of: 3 }, tasks: { done: 2, total: 6 } }),
  ]);
  await withTicks(t);
  const lines = t.lines.filter((l) => /^\[/.test(l));
  assert.deepEqual(lines, [
    '[0 min] planning',
    '[1 min] development · group 1 of 3 · tasks 0 of 6',
    '[2 min] development · group 2 of 3 · tasks 2 of 6',
  ]);
});

test('Scenario: Nothing changes - no line is repeated, and the next one carries the minutes that passed', async () => {
  const same = { phase: { phase: 'development', attempt: null, of: null }, group: { group: 1, of: 2 }, tasks: { done: 1, total: 4 } };
  const t = scripted([snap(same), snap(same), snap(same), snap({ ...same, tasks: { done: 2, total: 4 } })]);
  await withTicks(t);
  const lines = t.lines.filter((l) => /^\[/.test(l));
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^\[3 min\] .*tasks 2 of 4/);
});

test('a lens or an agent that finishes gets a line of its own', async () => {
  const dev = { phase: { phase: 'qa', attempt: 1, of: 2 }, tasks: { done: 3, total: 3 } };
  const t = scripted([
    snap({ ...dev, lenses: [{ lens: 'code', attempt: 1, at: 1, event: 'start' }] }),
    snap({ ...dev, lenses: [{ lens: 'code', attempt: 1, at: 1, event: 'start' }, { lens: 'code', attempt: 1, at: 2, event: 'end' }] }),
    snap({ ...dev, lenses: [{ lens: 'code', attempt: 1, at: 1, event: 'start' }, { lens: 'code', attempt: 1, at: 2, event: 'end' }], agents: [{ agent: 'relevo:dev', tool_uses: 3, duration_ms: null, tokens: null, at: 3 }] }),
  ]);
  await withTicks(t);
  const text = t.lines.join('\n');
  assert.match(text, /QA \(attempt 1 of 2\) · tasks 3 of 3 · QA lens code started/);
  assert.match(text, /QA lens code finished/);
  assert.match(text, /agent relevo:dev finished/);
});

test('the lines are in the language of relevo.yml', async () => {
  const t = scripted([snap({ group: { group: 2, of: 3 }, tasks: { done: 1, total: 2 } })]);
  await run(t.runner, { state: t.state, sleep: t.sleep, now: t.now, print: t.print, config: { ...config, language: 'es' } });
  assert.ok(t.lines.some((l) => /^\[\d+ min\] desarrollo · grupo 2 de 3 · tareas 1 de 2/.test(l)), t.lines.join('\n'));
});

test('Scenario: Antigravity - the same lines come from the same folder, whatever agent runs', async () => {
  const agy = { ...config, agent: { build: 'antigravity' } };
  const t = scripted([snap({ group: { group: 1, of: 1 } })]);
  const r = await runLocal({ issue: '42', config: agy, runner: t.runner, state: t.state, sleep: t.sleep, now: t.now, print: t.print });
  assert.equal(r.status, 0);
  assert.ok(t.lines.some((l) => /group 1 of 1/.test(l)));
});

test('Scenario: The progress cannot be written - the build runs as today and says once that its progress is not available', async () => {
  const runner = fakeRunner();
  const lines = [];
  const r = await run(runner, { state: { ...NO_STATE, prepare: () => false }, print: (m) => lines.push(m) });
  assert.equal(r.status, 0);
  assert.equal(lines.filter((l) => /progress of this build is not available/.test(l)).length, 1);
  assert.equal(lines.filter((l) => /^\[/.test(l)).length, 0);
});

test('a snapshot that throws never stops the build', async () => {
  const t = scripted([snap()]);
  t.state.snapshot = () => { throw new Error('boom'); };
  const r = await withTicks(t);
  assert.equal(r.status, 0);
});

test('the change id is derived from the title of the issue and handed to the snapshot', async () => {
  const seen = [];
  const runner = fakeRunner();
  const original = runner.capture;
  runner.capture = (cmd, args, options) => (cmd === 'gh' && args[0] === 'issue' ? 'Add the export button\n' : original(cmd, args, options));
  const state = { ...NO_STATE, snapshot: (a) => { seen.push(a.changeId); return null; } };
  await run(runner, { state });
  assert.ok(seen.length > 0 && seen.every((id) => /^42-/.test(id)), String(seen));
});

// ---------- what the run used

const ANSWER = JSON.stringify({ type: 'result', result: 'Built #42: all tasks done.', num_turns: 18, total_cost_usd: 1.23, usage: { input_tokens: 1000, output_tokens: 500 } });

test('Scenario: Totals reported - the answer and one sentence with turns, cost and tokens are printed, kept in the state, and nothing is posted', async () => {
  const t = scripted([snap()], { stdout: ANSWER });
  const r = await withTicks(t);
  assert.ok(t.lines.includes('Built #42: all tasks done.'));
  const sentence = t.lines.find((l) => /This run used/.test(l));
  assert.match(sentence, /18 turns/);
  assert.match(sentence, /about \$1\.23/);
  assert.match(sentence, /1,500 tokens/);
  assert.deepEqual(t.totals, [{ turns: 18, cost: 1.23, tokens: 1500 }]);
  assert.ok(!t.runner.calls.some((c) => c.cmd === 'gh' && /comment|api/.test(c.args.join(' '))), 'nothing is posted on the issue');
  assert.equal(r.status, 0);
});

test('Scenario: Nothing reported - raw output is printed, nothing is said about usage, and the build is not failed', async () => {
  const t = scripted([snap()], { stdout: 'plain text from the agent\n' });
  const r = await withTicks(t);
  assert.ok(t.lines.includes('plain text from the agent'));
  assert.ok(!t.lines.some((l) => /used/.test(l)));
  assert.deepEqual(t.totals, []);
  assert.equal(r.status, 0);
});

test('the Antigravity path reads the summary of the guard', async () => {
  const summary = JSON.stringify({ type: 'result', status: 'SUCCESS', num_turns: 7, usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 } });
  const agy = { ...config, agent: { build: 'antigravity' } };
  const t = scripted([snap()], { summary, stdout: 'done' });
  await runLocal({ issue: '42', config: agy, runner: t.runner, state: t.state, sleep: t.sleep, now: t.now, print: t.print });
  assert.match(t.lines.find((l) => /This run used/.test(l)), /7 turns.*150 tokens/);
  assert.deepEqual(t.totals, [{ turns: 7, cost: null, tokens: 150 }]);
});

test('the last snapshot is written at the end, before the worktree goes, so that its tasks stay readable', async () => {
  const t = scripted([snap({ tasks: { done: 3, total: 3 } })]);
  await withTicks(t);
  assert.equal(t.saved.length, 1);
  assert.deepEqual(t.saved[0].tasks, { done: 3, total: 3 });
});

// ---------- local-tracker: a files project builds from its own base branch, with no remote and no gh

const FILES = loadConfig('limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nbranches:\n  base: main\n').config;

test('Scenario: Files project - the worktree is made from the local base, nothing is fetched and gh is never called', async () => {
  const runner = fakeRunner();
  const originalCapture = runner.capture.bind(runner);
  runner.capture = (cmd, args, options) => {
    if (cmd === 'node' && args[1] === 'issue-get') { runner.calls.push({ kind: 'capture', cmd, args }); return JSON.stringify({ title: 'Add the export button' }); }
    return originalCapture(cmd, args, options);
  };
  const r = await runLocal({ issue: '42', config: FILES, runner });
  assert.equal(r.status, 0);
  const git = runner.calls.filter((c) => c.cmd === 'git').map((c) => c.args.join(' '));
  assert.ok(git.includes('worktree add --detach /home/me/code/.relevo-worktrees/shop-42 main'), git.join('\n'));
  assert.ok(!git.some((a) => /fetch|origin/.test(a)), 'no fetch and no origin');
  assert.ok(!runner.calls.some((c) => c.cmd === 'gh'), 'gh is never called, not even to check that it is signed in');
  assert.ok(runner.calls.some((c) => c.cmd === 'node' && c.args[1] === 'issue-get'), 'the title comes from the tracker');
});

test('Scenario: Files project - the dry run names the local base, and a github project still names origin', async () => {
  const files = await runLocal({ issue: '42', config: FILES, runner: fakeRunner(), dryRun: true });
  assert.match(files.messages.join('\n'), /\(from main\)/);
  const github = await runLocal({ issue: '42', config, runner: fakeRunner(), dryRun: true });
  assert.match(github.messages.join('\n'), /\(from origin\/dev\)/);
});

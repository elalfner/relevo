import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_PROGRAMS, DENIED, EXIT, Tracker, agySettings, logLine, runGuard } from '../scripts/lib/agent-guard.mjs';
import { readUsage, reachedUsageLimit } from '../scripts/lib/run-usage.mjs';
import { readSource } from '../scripts/lib/adapters/source.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const step = (conv, index, type, extra = {}) => JSON.stringify({ event: 'step_update', step_update: { conversation_id: conv, step_index: index, state: 'DONE', step_type: type, ...extra } });
const turn = (conv, index, total = 100) => step(conv, index, 'agent_response', { usage: { input_tokens: total - 10, output_tokens: 10, total_tokens: total, cache_read_tokens: 5 } });
const result = (extra = {}) => JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'done', ...extra } });

// A child the test controls: it emits what the test pushes and records what the guard does to it.
function fakeChild() {
  const child = new EventEmitter();
  Object.assign(child, { stdout: new EventEmitter(), stderr: new EventEmitter(), signals: [], pid: 4242, kill(s) { this.signals.push(s); if (s === 'SIGTERM' || s === 'SIGKILL') queueMicrotask(() => this.emit('close', null)); } });
  child.push = (...lines) => lines.forEach((l) => child.stdout.emit('data', `${l}\n`));
  child.end = (code = 0) => child.emit('close', code);
  return child;
}
function start(limits, extra = {}) {
  const child = fakeChild();
  const timers = [];
  const logs = [];
  const done = runGuard({ command: 'agy', args: ['-p', 'x'], limits, spawn: () => child, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; }, clearTimer: () => {}, log: (l) => logs.push(l), ...extra });
  return { child, timers, logs, done };
}

test('the tracker counts a turn once, when it is done, from the main agent and from a subagent', () => {
  const t = new Tracker();
  [turn('a', 1), turn('a', 1), step('a', 2, 'tool', { tool_name: 'run_command' }), turn('b', 1), JSON.stringify({ event: 'step_update', step_update: { conversation_id: 'a', step_index: 3, state: 'ACTIVE', step_type: 'agent_response' } })].forEach((l) => t.feed(l));
  assert.equal(t.turns, 2, 'one turn of each conversation, a repeated report and an unfinished step not counted');
  assert.equal(t.tokens, 200);
  assert.equal(t.cached, 10);
  assert.equal(t.feed('not json'), null);
});

test('Scenario: Step limit reached - the guard kills the process group and exits with the code of a limit', async () => {
  const { child, logs, done } = start({ turns: 3, tokens: 1e9, minutes: 30 });
  child.push(turn('a', 1), turn('a', 3), turn('a', 5));
  assert.deepEqual(child.signals, [], 'three turns are within the limit of three');
  child.push(turn('a', 7));
  const r = await done;
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(r.code, EXIT.turns);
  assert.equal(r.summary.stopped_by, 'turns');
  assert.match(logs.join('\n'), /reached the limit of 3 turns \(limits\.run_max_turns\)/);
});

test('the token limit stops the run too, and the summary says which limit', async () => {
  const { child, done } = start({ turns: 100, tokens: 250, minutes: 30 });
  child.push(turn('a', 1, 100), turn('a', 3, 100), turn('a', 5, 100));
  const r = await done;
  assert.equal(r.code, EXIT.tokens);
  assert.equal(r.summary.stopped_by, 'tokens');
  assert.equal(r.summary.usage.input_tokens, 270);
});

test('Scenario: No output - the guard ends the agent at the time limit and the run reports that it produced nothing useful', async () => {
  const { child, timers, done } = start({ turns: 100, tokens: 1e9, minutes: 2 });
  const limit = timers.find((t) => t.ms === 2 * 60 * 1000);
  assert.ok(limit, 'a timer for the time limit was set');
  limit.fn();
  const r = await done;
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(r.code, EXIT.time);
  assert.equal(r.summary.status, 'NO_RESULT');
});

test('a process that ignores the first signal is killed five seconds later', async () => {
  const { child, timers, done } = start({ turns: 1, tokens: 1e9, minutes: 30 });
  child.kill = function kill(s) { this.signals.push(s); if (s === 'SIGKILL') queueMicrotask(() => this.emit('close', null)); };
  child.push(turn('a', 1), turn('a', 3));
  const k = timers.find((t) => t.ms === 5000);
  assert.ok(k);
  k.fn();
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
  assert.equal((await done).code, EXIT.turns);
});

test('Scenario: A refused tool - the agent exits 0 but the final event lists a denied action, so the guard fails the run and names it', async () => {
  const { child, logs, done } = start({ turns: 100, tokens: 1e9, minutes: 30 });
  child.push(turn('a', 1), result({ denied_actions: [{ action: 'command', display_name: 'RunCommand' }] }));
  child.end(0);
  const r = await done;
  assert.equal(r.code, EXIT.refused);
  assert.deepEqual(r.summary.denied, ['RunCommand']);
  assert.match(logs.join('\n'), /a tool was refused \(RunCommand\)/);
});

test('a tool step that ended in a permission error is a refusal even without the list in the final event', async () => {
  const { child, done } = start({ turns: 100, tokens: 1e9, minutes: 30 });
  child.push(step('a', 2, 'tool', { tool_name: 'run_command', state: 'ERROR', tool_info: { parameters: { CommandLine: 'curl -sI https://example.com' }, error: 'permission check failed for unsandboxed "curl -sI https://example.com"' } }), result());
  child.end(0);
  const r = await done;
  assert.equal(r.code, EXIT.refused);
  assert.deepEqual(r.summary.denied, ['curl']);
});

test('a clean run exits 0, one that fails exits 1, and one that ends without a result exits 14', async () => {
  let g = start({ turns: 100, tokens: 1e9, minutes: 30 });
  g.child.push(turn('a', 1), result());
  g.child.end(0);
  assert.equal((await g.done).code, EXIT.ok);
  g = start({ turns: 100, tokens: 1e9, minutes: 30 });
  g.child.push(result({ status: 'ERROR' }));
  g.child.end(1);
  assert.equal((await g.done).code, EXIT.failed);
  g = start({ turns: 100, tokens: 1e9, minutes: 30 });
  g.child.end(0);
  const r = await g.done;
  assert.equal(r.code, EXIT.silent);
  assert.equal(r.summary.status, 'NO_RESULT');
});

test('a line split across two chunks is still read, and the log has no output of the agent, only its tools', async () => {
  const { child, logs, done } = start({ turns: 100, tokens: 1e9, minutes: 30 });
  const line = step('a', 1, 'tool', { tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'git commit -m "TOKEN=abc123secret"' }, output: 'SECRET OUTPUT' } });
  child.stdout.emit('data', line.slice(0, 40));
  child.stdout.emit('data', `${line.slice(40)}\n`);
  child.push(result());
  child.end(0);
  await done;
  assert.deepEqual(logs, ['tool run_command (git)']);
  assert.ok(!logs.join('').includes('abc123secret') && !logs.join('').includes('SECRET OUTPUT'));
  assert.equal(logLine({ step_update: { state: 'ACTIVE', step_type: 'tool' } }), null);
});

test('the summary is in the shape that run-usage.mjs reads, and a quota error of the provider is seen as a usage limit', async () => {
  const { child, done } = start({ turns: 100, tokens: 1e9, minutes: 30 });
  child.push(turn('a', 1, 1000));
  child.stderr.emit('data', 'Error: 429 quota exceeded for this API key\n');
  child.end(1);
  const { summary } = await done;
  const usage = readUsage(JSON.stringify(summary));
  assert.equal(usage.turns, 1);
  assert.equal(usage.tokens, 1000);
  assert.ok(reachedUsageLimit(JSON.stringify(summary)));
  assert.ok(!reachedUsageLimit(JSON.stringify({ ...summary, stderr_tail: '' })));
});

test('Scenario: Reading the workflow - the settings deny the web, allow only listed commands and name the stack tools', () => {
  const s = agySettings({ profile: { commands: { analyze: 'flutter analyze --no-pub', test: 'flutter test --no-pub' }, tools: ['flutter', 'dart'] } });
  assert.equal(s.modelProvider, 'gemini');
  assert.deepEqual(s.permissions.deny, DENIED);
  for (const d of ['read_url(*)', 'execute_url(*)', 'command(curl)', 'command(wget)']) assert.ok(s.permissions.deny.includes(d), d);
  assert.ok(s.permissions.allow.includes('command(flutter)') && s.permissions.allow.includes('command(dart)'));
  assert.ok(!s.permissions.allow.includes('command(curl)') && !s.permissions.allow.includes('command(wget)'));
  assert.deepEqual(s.permissions.allow, [...s.permissions.allow].sort(), 'a stable order');
  assert.ok(!JSON.stringify(s).includes('KEY'), 'no key in the settings');
  assert.ok(!agySettings({ extra: ['curl'] }).permissions.allow.includes('command(curl)'), 'denied programs cannot be added back');
});

test('Scenario: the programs the skill go and the agents call are in the allow list', () => {
  const source = readSource(root);
  const texts = [source.skills.find((s) => s.name === 'go').body, ...source.agents.map((a) => a.body)];
  const used = new Set();
  for (const text of texts) {
    for (const m of text.matchAll(/```(?:bash|sh|shell)?\n([\s\S]*?)```/g)) for (const l of m[1].split('\n')) used.add(l.trim().replace(/^\$ /, '').split(/\s+/)[0]);
    for (const m of text.matchAll(/`((?:node|git|gh|openspec|echo|flutter|npm|npx|composer|php)) [^`\n]*`/g)) used.add(m[1]);
  }
  used.delete('');
  const shellWords = [...used].filter((w) => /^[a-z][a-z0-9._-]*$/.test(w));
  const missing = shellWords.filter((w) => !BASE_PROGRAMS.includes(w) && !['flutter', 'npm', 'npx', 'composer', 'php'].includes(w));
  assert.deepEqual(missing, [], `the skill or the agents call ${missing.join(', ')}, which the run may not use`);
  for (const w of ['node', 'git', 'gh', 'openspec']) assert.ok(shellWords.includes(w) || BASE_PROGRAMS.includes(w), w);
});

const cli = join(root, 'scripts', 'agent-guard.mjs');

test('the command: settings writes the file from the profile of the platform, and run needs its limits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-guard-'));
  writeFileSync(join(dir, 'relevo.yml'), 'agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 2000000\nplatform: flutter-android\n');
  const out = join(dir, 'home', '.gemini', 'antigravity-cli', 'settings.json');
  const r = spawnSync(process.execPath, [cli, 'settings', '--out', out, '--platform', 'nope', '--config', join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(r.status, 2, 'an unknown platform is a usage error');
  const ok = spawnSync(process.execPath, [cli, 'settings', '--out', out, '--config', join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const settings = JSON.parse(readFileSync(out, 'utf8'));
  assert.ok(settings.permissions.allow.includes('command(flutter)'));
  const bad = spawnSync(process.execPath, [cli, 'run', '--prompt', 'x', '--summary', join(dir, 's.json')], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--max-turns must be a number greater than zero/);
});

test('the command: run starts the agent under the limits, writes the summary and the output file, and returns its code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-guard-'));
  const fake = join(dir, 'agy');
  writeFileSync(fake, `#!/usr/bin/env node\nconst a = process.argv.slice(2);\nconsole.log(JSON.stringify({ event: 'step_update', step_update: { conversation_id: 'a', step_index: 1, state: 'DONE', step_type: 'agent_response', usage: { input_tokens: 90, output_tokens: 10, total_tokens: 100 } } }));\nconsole.log(JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'args=' + a.join(' ') } }));\n`, { mode: 0o755 });
  const out = join(dir, 'gh-output');
  const r = spawnSync(process.execPath, [cli, 'run', '--agy', fake, '--prompt', '/relevo:go 7', '--max-turns', '5', '--max-tokens', '1000', '--timeout-minutes', '1', '--summary', join(dir, 'summary.json'), '--github-output', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /args=-p \/relevo:go 7 --output-format stream-json --print-timeout 2m/);
  assert.match(r.stderr, /model turn/);
  assert.match(readFileSync(out, 'utf8'), /^execution_file=.*summary\.json$/m);
  const usage = readUsage(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.deepEqual([usage.turns, usage.tokens], [1, 100]);
});

test('the command: run takes its limits from relevo.yml, and a flag can only lower them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-guard-'));
  writeFileSync(join(dir, 'relevo.yml'), 'agent:\n  build: antigravity\nlimits:\n  run_max_turns: 2\n  run_max_tokens: 5000\n');
  const fake = join(dir, 'agy');
  const turns = (n) => Array.from({ length: n }, (_, i) => `console.log(JSON.stringify({ event: 'step_update', step_update: { conversation_id: 'a', step_index: ${i}, state: 'DONE', step_type: 'agent_response', usage: { input_tokens: 90, output_tokens: 10, total_tokens: 100 } } }));`).join('\n');
  writeFileSync(fake, `#!/usr/bin/env node\n${turns(4)}\nsetTimeout(() => {}, 20000);\n`, { mode: 0o755 });
  const run = (...extra) => spawnSync(process.execPath, [cli, 'run', '--agy', fake, '--prompt', 'x', '--config', join(dir, 'relevo.yml'), '--timeout-minutes', '1', '--summary', join(dir, 's.json'), ...extra], { encoding: 'utf8' });
  const r = run();
  assert.equal(r.status, EXIT.turns, r.stdout + r.stderr);
  assert.match(r.stderr, /limit of 2 turns/);
  const lowered = run('--max-turns', '1');
  assert.match(lowered.stderr, /limit of 1 turns/);
  const higher = run('--max-turns', '50');
  assert.match(higher.stderr, /limit of 2 turns/, 'a flag cannot raise the limit of relevo.yml');
  assert.equal(JSON.parse(readFileSync(join(dir, 's.json'), 'utf8')).stopped_by, 'turns');
});

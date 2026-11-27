import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordPhase, writeClass } from '../scripts/lib/phase-log.mjs';
import { writeRunLimits } from '../scripts/lib/time-limit.mjs';

const GUARD = new URL('../scripts/time-guard.mjs', import.meta.url).pathname;
const MIN = 60000;
const temp = () => mkdtempSync(join(tmpdir(), 'relevo-guard-'));

// A build with a limit of 5 minutes that entered planning `minutes` ago: the hard stop is at 15.
function build(minutes) {
  const dir = temp();
  recordPhase(dir, { phase: 'planning' }, Date.now() - minutes * MIN);
  writeRunLimits(dir, { run_max_minutes: 5 });
  return dir;
}
const launch = { tool_name: 'Agent', tool_input: { subagent_type: 'relevo:dev' } };
const subagent = { tool_name: 'Bash', tool_input: { command: 'ls' }, agent_id: 'a1', agent_type: 'relevo:dev' };
const main = { tool_name: 'Bash', tool_input: { command: 'git push' } };

function guard(progress, input) {
  const cwd = temp();
  const r = spawnSync(process.execPath, [GUARD], { cwd, encoding: 'utf8', input: typeof input === 'string' ? input : JSON.stringify({ cwd, ...input }), env: { ...process.env, RELEVO_PROGRESS_DIR: progress ?? '' } });
  assert.equal(r.status, 0, r.stderr);
  if (!r.stdout.trim()) return null;
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny', 'the guard only ever refuses');
  return out.permissionDecisionReason;
}

test('Scenario: The check was skipped - a launch after the limit is refused and the reason names it', () => {
  assert.match(guard(build(6), launch), /minutes limit of this Relevo run \(5\)/);
  assert.match(guard(build(6), { ...launch, tool_name: 'Task' }), /minutes limit/);
  assert.equal(guard(build(4), launch), null, 'within the limit');
  assert.equal(guard(build(6), { tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } }), null, 'only Relevo agents');
});

test('Scenario: Between the limit and the hard stop - a subagent goes on', () => {
  assert.equal(guard(build(6), subagent), null);
});

test('Scenario: The developer is still working - after the hard stop every subagent call is refused', () => {
  assert.match(guard(build(16), subagent), /time limit of this Relevo run has passed/);
  assert.match(guard(build(16), { ...subagent, tool_name: 'Read' }), /final report now/);
});

test('Scenario: The work is kept afterwards - the orchestrator is not refused, except to launch', () => {
  assert.equal(guard(build(16), main), null);
  assert.match(guard(build(16), launch), /minutes limit/);
});

test('Scenario: An ordinary session - nothing is said', () => {
  assert.equal(guard(null, subagent), null);
  assert.equal(guard(null, launch), null);
});

test('Scenario: A build that already ended - nothing is refused', () => {
  const dir = build(16);
  writeClass(dir, 'limit');
  assert.equal(guard(dir, subagent), null);
});

test('Scenario: Unreadable state - the call is allowed', () => {
  assert.equal(guard(temp(), subagent), null);
  assert.equal(guard(build(16), 'not json'), null);
  assert.equal(guard(join(temp(), 'missing'), subagent), null);
});

test('the plugin ships the hook and the package holds it', () => {
  const hooks = JSON.parse(readFileSync(new URL('../hooks/hooks.json', import.meta.url), 'utf8'));
  assert.match(hooks.hooks.PreToolUse[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/time-guard\.mjs/);
  assert.ok(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).files.includes('hooks'));
});

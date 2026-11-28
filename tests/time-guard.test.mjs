import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

function runGuardRaw(progress, input) {
  const cwd = temp();
  const r = spawnSync(process.execPath, [GUARD], { cwd, encoding: 'utf8', input: typeof input === 'string' ? input : JSON.stringify({ cwd, ...input }), env: { ...process.env, RELEVO_PROGRESS_DIR: progress ?? '' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

function guard(progress, input) {
  const parsed = runGuardRaw(progress, input);
  if (!parsed) return null;
  const out = parsed.hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny', 'the guard only ever refuses');
  return out.permissionDecisionReason;
}

function agyGuard(progress, input) {
  const parsed = runGuardRaw(progress, input);
  if (!parsed) return null;
  assert.equal(parsed.decision, 'deny', 'Antigravity PreToolUse returns { decision: "deny", reason }');
  assert.equal('hookSpecificOutput' in parsed, false, 'Antigravity response must not wrap in Claude hookSpecificOutput');
  return parsed.reason;
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

// ---- Antigravity camelCase PreToolUse payloads (agy 1.5.18)

const agyLaunch = {
  hookEventName: 'PreToolUse',
  conversationId: 'orch-1',
  lastUserInput: '/relevo:go 42',
  toolCall: { id: 'c1', name: 'invoke_subagent', args: { TypeName: 'relevo-dev', Role: 'build 1/1' } }
};
const agySubagentCall = {
  hookEventName: 'PreToolUse',
  conversationId: 'sub-1',
  lastUserInput: '',
  toolCall: { id: 'c2', name: 'run_command', args: { CommandLine: 'npm test' } }
};
const agyOrchestratorCall = {
  hookEventName: 'PreToolUse',
  conversationId: 'orch-1',
  lastUserInput: '/relevo:go 42',
  toolCall: { id: 'c3', name: 'run_command', args: { CommandLine: 'git push' } }
};

test('Scenario: Antigravity PreToolUse refusal - subagent launch past soft limit returns { decision: deny, reason }', () => {
  assert.match(agyGuard(build(6), agyLaunch), /minutes limit of this Relevo run \(5\)/);
  assert.match(agyGuard(build(6), { ...agyLaunch, toolCall: { id: 'c1', name: 'invoke_subagent', args: { TypeName: 'relevo-qa-spec' } } }), /minutes limit/);
  assert.equal(agyGuard(build(4), agyLaunch), null, 'within limit prints empty stdout');
  assert.equal(agyGuard(build(6), { ...agyLaunch, toolCall: { id: 'c1', name: 'invoke_subagent', args: { TypeName: 'research' } } }), null, 'non-Relevo subagent allowed');
});

test('Scenario: Antigravity PreToolUse refusal - subagent tool calls denied after hard stop, send_message and orchestrator allowed', () => {
  assert.equal(agyGuard(build(6), agySubagentCall), null, 'between soft limit and hard stop subagent continues');
  assert.match(agyGuard(build(16), agySubagentCall), /time limit of this Relevo run has passed/);
  assert.match(agyGuard(build(16), { ...agySubagentCall, toolCall: { id: 'c4', name: 'read_file', args: { Path: 'a.txt' } } }), /final report now/);
  assert.equal(agyGuard(build(16), { ...agySubagentCall, toolCall: { id: 'c5', name: 'send_message', args: { Recipient: 'orch-1', Message: 'report' } } }), null, 'subagent must be able to send final report');
  assert.equal(agyGuard(build(16), agyOrchestratorCall), null, 'orchestrator cleanup stays allowed after hard stop');
  assert.match(agyGuard(build(16), agyLaunch), /minutes limit/, 'orchestrator cannot launch another Relevo agent');
});

test('Scenario: Antigravity interactive Workspace: share builder orchestrator is not blocked after hard stop', () => {
  const dir = build(4);
  // Interactive builder itself has lastUserInput: "" because it was launched via invoke_subagent.
  const shareBuilderLaunch = {
    hookEventName: 'PreToolUse',
    conversationId: 'builder-1',
    lastUserInput: '',
    toolCall: { id: 'c1', name: 'invoke_subagent', args: { TypeName: 'relevo-dev', Role: 'build 1/1' } }
  };
  assert.equal(agyGuard(dir, shareBuilderLaunch), null, 'records builder-1 as orchestrator');
  // Advance build past hard stop by replacing the planning timestamp in the same progress dir.
  rmSync(join(dir, 'phases.jsonl'));
  recordPhase(dir, { phase: 'planning' }, Date.now() - 16 * MIN);
  const shareBuilderCleanup = {
    hookEventName: 'PreToolUse',
    conversationId: 'builder-1',
    lastUserInput: '',
    toolCall: { id: 'c6', name: 'run_command', args: { CommandLine: 'git push' } }
  };
  assert.equal(agyGuard(dir, shareBuilderCleanup), null, 'recorded orchestrator stays allowed');
  assert.match(agyGuard(dir, agySubagentCall), /time limit of this Relevo run has passed/, 'child subagent is still denied');
});

test('Scenario: Antigravity ordinary session or ended build prints nothing (never {})', () => {
  assert.equal(agyGuard(null, agySubagentCall), null);
  assert.equal(agyGuard(null, agyLaunch), null);
  const dir = build(16);
  writeClass(dir, 'limit');
  assert.equal(agyGuard(dir, agySubagentCall), null);
});

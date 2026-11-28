// What the time guard refuses. `call` is the input of a PreToolUse hook (Claude Code snake_case or Antigravity
// camelCase) and `clock` the answer of `runClock`.

const CLAUDE_LAUNCH_TOOLS = new Set(['Agent', 'Task']);

/** Which hook payload format `call` uses: `'claude'`, `'antigravity'`, or `null`. */
export function detectFormat(call) {
  if (!call || typeof call !== 'object') return null;
  if (typeof call.tool_name === 'string') return 'claude';
  if (call.toolCall && typeof call.toolCall.name === 'string') return 'antigravity';
  return null;
}

/** True when an Antigravity PreToolUse call launches a Relevo subagent (`relevo-*`). */
export function isAntigravityLaunch(call) {
  return detectFormat(call) === 'antigravity'
    && call.toolCall.name === 'invoke_subagent'
    && String(call.toolCall.args?.TypeName ?? '').startsWith('relevo-');
}

function isAntigravitySubagent(call, orchestratorId) {
  if (call.parentConversationId || call.isSubagent === true) return true;
  if (typeof call.agentId === 'string' && call.agentId !== '') return true;
  if (typeof call.agent_id === 'string' && call.agent_id !== '') return true;
  // Measured on agy 1.5.18 (docs/pilot-findings.md): subagents send `lastUserInput: ""` while the root orchestrator
  // keeps its non-empty prompt even after reactive wakeup. Recording the orchestrator's `conversationId` when it
  // launches `relevo-*` also protects an interactive `Workspace: 'share'` builder subagent from blocking itself.
  if (call.lastUserInput === '') {
    if (orchestratorId && call.conversationId === orchestratorId) return false;
    return true;
  }
  return false;
}

/** The JSON object to print on stdout when refusing a call, in the format expected by the host tool. */
export function formatDenial(format, reason) {
  if (format === 'antigravity') return { decision: 'deny', reason };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}

/** The reason to refuse the call, or null to leave it alone. */
export function refusal(call, clock, now = Date.now(), { orchestratorId = null } = {}) {
  const format = detectFormat(call);
  if (!clock || !format) return null;

  if (format === 'claude') {
    const agent = typeof call.agent_id === 'string' && call.agent_id !== '';
    if (agent && now >= clock.hard) {
      return 'The time limit of this Relevo run has passed. Make no more tool calls: write your final report now, say that the time limit stopped you and what is left to do, and end.';
    }
    const launches = CLAUDE_LAUNCH_TOOLS.has(call.tool_name) && String(call.tool_input?.subagent_type ?? '').startsWith('relevo:');
    if (launches && now >= clock.soft) {
      return `The minutes limit of this Relevo run (${clock.maxMinutes}) has passed, so no agent starts. Take the failure path with the reason "run limit reached".`;
    }
    return null;
  }

  // Antigravity PreToolUse (camelCase payload).
  if (isAntigravityLaunch(call) && now >= clock.soft) {
    return `The minutes limit of this Relevo run (${clock.maxMinutes}) has passed, so no agent starts. Take the failure path with the reason "run limit reached".`;
  }
  // Subagents deliver their final report back to the parent via `send_message`, so never refuse it at the hard stop.
  if (call.toolCall.name !== 'send_message' && isAntigravitySubagent(call, orchestratorId) && now >= clock.hard) {
    return 'The time limit of this Relevo run has passed. Make no more tool calls: write your final report now, say that the time limit stopped you and what is left to do, and end.';
  }
  return null;
}

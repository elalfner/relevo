// What the time guard refuses. `call` is the input of a PreToolUse hook and `clock` the answer of `runClock`.

const LAUNCH_TOOLS = new Set(['Agent', 'Task']);

/** The reason to refuse the call, or null to leave it alone. */
export function refusal(call, clock, now = Date.now()) {
  if (!clock || !call || typeof call.tool_name !== 'string') return null;
  const agent = typeof call.agent_id === 'string' && call.agent_id !== '';
  if (agent && now >= clock.hard) {
    return 'The time limit of this Relevo run has passed. Make no more tool calls: write your final report now, say that the time limit stopped you and what is left to do, and end.';
  }
  const launches = LAUNCH_TOOLS.has(call.tool_name) && String(call.tool_input?.subagent_type ?? '').startsWith('relevo:');
  if (launches && now >= clock.soft) {
    return `The minutes limit of this Relevo run (${clock.maxMinutes}) has passed, so no agent starts. Take the failure path with the reason "run limit reached".`;
  }
  return null;
}

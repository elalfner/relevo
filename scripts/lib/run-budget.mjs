// The budget of a run between its agents. `go` records what each agent used when it finishes (the tool calls and the
// time that end its report) and asks, before it launches the next one, whether a limit was reached. Implements "No agent
// starts after a limit of the run" and "The budget guard stops a run only on what it can read" of the go specification.
//
// The runner counts only the turns of the main agent against `--max-turns`; the subagents are counted here. A finished
// subagent reports its tool calls, and each call is followed by one more turn of the model, and the last turn gives the
// answer, so its turns are `tool_uses + 1` (the same estimate `run-usage.mjs` makes after the run).
//
// The guard decides only on figures it can read. Anything it cannot read is `known: false` and never stops a run.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPhaseLog } from './phase-log.mjs';

const LEDGER = 'budget.jsonl';
const AGENT_RE = /^[A-Za-z0-9:._-]{1,60}$/;

/** A non-negative whole number from a command-line value, or null: '12' counts, '1.5', '-3', '12abc' and '' do not. */
export function wholeNumber(value) {
  return /^\d{1,12}$/.test(String(value ?? '').trim()) ? Number(String(value).trim()) : null;
}

/**
 * Appends what a finished agent used. Only whole numbers and a plain agent name are written: the figures come from the
 * report of an agent, which is untrusted text, and nothing of that text is kept. Returns whether a line was written.
 */
export function recordAgent(dir, { agent, toolUses, durationMs = null, tokens = null }, now = Date.now()) {
  if (!dir || !AGENT_RE.test(String(agent ?? ''))) return false;
  const calls = wholeNumber(toolUses);
  if (calls === null) return false;
  const line = { agent, tool_uses: calls, duration_ms: wholeNumber(durationMs), tokens: wholeNumber(tokens), at: now };
  try {
    appendFileSync(join(dir, LEDGER), `${JSON.stringify(line)}\n`);
    return true;
  } catch {
    return false;
  }
}

/** The recorded agents in order; a line that is not valid is skipped. */
export function readLedger(dir) {
  const file = dir ? join(dir, LEDGER) : null;
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((line) => {
    try {
      const e = JSON.parse(line);
      return AGENT_RE.test(String(e.agent)) && Number.isInteger(e.tool_uses) && e.tool_uses >= 0
        ? { agent: e.agent, tool_uses: e.tool_uses, duration_ms: Number.isInteger(e.duration_ms) ? e.duration_ms : null, tokens: Number.isInteger(e.tokens) ? e.tokens : null, at: Number.isFinite(e.at) ? e.at : null }
        : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/** The turns the subagents took: each finished agent counts its tool calls plus the turn that gave the answer. */
export function subagentTurns(entries) {
  return entries.reduce((total, e) => total + e.tool_uses + 1, 0);
}

/**
 * Where the run stands against its limits.
 *   dir     the progress folder of the run (RELEVO_PROGRESS_DIR)
 *   limits  { run_max_turns, run_max_minutes }: a limit that is not a positive number is not checked
 * Returns { known, stop, reason, subagent_turns, max_turns, elapsed_minutes, max_minutes, agents }. `reason` is `turns`
 * or `minutes` when `stop` is true. Without a folder nothing is known and nothing stops. The time starts when `go`
 * announced its first phase; without that moment only the turns are checked.
 */
export function budgetStatus({ dir, limits = {}, now = Date.now() }) {
  const maxTurns = Number.isFinite(limits.run_max_turns) && limits.run_max_turns > 0 ? limits.run_max_turns : null;
  const maxMinutes = Number.isFinite(limits.run_max_minutes) && limits.run_max_minutes > 0 ? limits.run_max_minutes : null;
  const base = { known: false, stop: false, reason: null, subagent_turns: null, max_turns: maxTurns, elapsed_minutes: null, max_minutes: maxMinutes, agents: [] };
  if (!dir) return base;
  let entries;
  let phases;
  try {
    entries = readLedger(dir);
    phases = readPhaseLog(dir);
  } catch {
    return base;
  }
  const turns = subagentTurns(entries);
  const started = phases.length ? phases[0].at : null;
  const elapsed = started === null ? null : Math.max(0, (now - started) / 60000);
  const reason = maxTurns !== null && turns >= maxTurns ? 'turns' : maxMinutes !== null && elapsed !== null && elapsed >= maxMinutes ? 'minutes' : null;
  return {
    known: true,
    stop: reason !== null,
    reason,
    subagent_turns: turns,
    max_turns: maxTurns,
    elapsed_minutes: elapsed === null ? null : Math.round(elapsed * 10) / 10,
    max_minutes: maxMinutes,
    agents: entries.map((e) => e.agent),
  };
}

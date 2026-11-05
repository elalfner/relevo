// What a cloud run used, read from the execution log of the agent runner. Implements "The consumption of a run is
// visible" of the execution-modes specification.
//
// The format of that log is not documented (only its path is an output of the action), so everything here is
// tolerant: a JSON array, JSON lines or a single object are accepted, the last entry that looks like a result is
// used, and anything missing is simply left out. Nothing found means nothing is said, never an error.

import { OUTCOME_CLASSES } from './phase-log.mjs';

function entries(text) {
  const t = String(text ?? '').trim();
  if (!t) return [];
  try {
    const whole = JSON.parse(t);
    return Array.isArray(whole) ? whole : [whole];
  } catch {
    return t.split('\n').map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The turns that subagents took, which the runner leaves out of `num_turns` (spike S3 of specialist-review-lenses: a
 * subagent that made three tool calls ran inside a run limited to two turns). A finished subagent reports its tool
 * calls in its `task_notification`; each call is followed by one more turn of the model, and the last turn gives the
 * answer, so its turns are `tool_uses + 1`. This is an estimate that is exact when the model makes one call per turn.
 */
function subagentTurnsOf(all) {
  let total = 0;
  all.forEach((e) => {
    if (e.type !== 'system' || e.subtype !== 'task_notification') return;
    const calls = num(e.usage?.tool_uses);
    if (calls !== null) total += calls + 1;
  });
  return total;
}

/**
 * { turns, cost, tokens, cached } with null for what the log does not say, or null when it says none of them.
 * `turns` counts the main agent and its subagents; `subagentTurns` is the part of them that the runner does not count,
 * and is present only when there is one. The cost already includes the subagents (the runner counts it).
 */
export function readUsage(text) {
  const all = entries(text).filter((e) => e && typeof e === 'object');
  const result = [...all].reverse().find((e) => e.type === 'result') ?? [...all].reverse().find((e) => num(e.num_turns) !== null);
  if (!result) return null;
  const input = num(result.usage?.input_tokens);
  const output = num(result.usage?.output_tokens);
  const usage = {
    turns: num(result.num_turns),
    cost: num(result.total_cost_usd),
    tokens: input !== null || output !== null ? (input ?? 0) + (output ?? 0) : null,
    // Tokens read from or written to the prompt cache are reported apart: they are most of a long run and the
    // plain input/output figure alone looks far smaller than what the run really processed.
    cached: num(result.usage?.cache_read_input_tokens) !== null || num(result.usage?.cache_creation_input_tokens) !== null
      ? (num(result.usage?.cache_read_input_tokens) ?? 0) + (num(result.usage?.cache_creation_input_tokens) ?? 0)
      : null,
  };
  if (usage.turns === null && usage.cost === null && usage.tokens === null) return null;
  const sub = subagentTurnsOf(all);
  if (sub > 0 && usage.turns !== null) {
    usage.turns += sub;
    usage.subagentTurns = sub;
  }
  return usage;
}

/** The limits of relevo.yml that a run went past: [{ limit, used, max }], empty when it kept within them or the figure is unknown. */
export function limitsExceeded(usage, limits = {}) {
  const out = [];
  if (!usage) return out;
  if (usage.turns !== null && Number.isFinite(limits.run_max_turns) && usage.turns > limits.run_max_turns) out.push({ limit: 'limits.run_max_turns', used: usage.turns, max: limits.run_max_turns });
  if (usage.cost !== null && Number.isFinite(limits.run_max_cost) && usage.cost > limits.run_max_cost) out.push({ limit: 'limits.run_max_cost', used: usage.cost, max: limits.run_max_cost });
  return out;
}

/** One line for a comment, or an empty string when there is nothing to say. */
export function usageLine(usage, { subscription = false, limits = null } = {}) {
  if (!usage) return '';
  const parts = [];
  if (usage.turns !== null) parts.push(`${usage.turns} turn${usage.turns === 1 ? '' : 's'}${usage.subagentTurns ? ` (${usage.subagentTurns} by subagents)` : ''}`);
  if (usage.cost !== null) parts.push(`about $${usage.cost.toFixed(2)}${subscription ? ' (notional: a subscription is not billed per run)' : ''}`);
  if (usage.tokens !== null) parts.push(`${usage.tokens.toLocaleString('en-US')} tokens${usage.cached ? ` (plus ${usage.cached.toLocaleString('en-US')} from the cache)` : ''}`);
  if (!parts.length) return '';
  const over = limitsExceeded(usage, limits ?? {});
  const warn = over.map((o) => ` It went past ${o.limit} (${o.max}) with ${o.limit.endsWith('turns') ? o.used : `$${o.used.toFixed(2)}`}${o.limit.endsWith('turns') && usage.subagentTurns ? ': the runner counts only the turns of the main agent, so the turns of the subagents were not stopped' : ''}.`).join('');
  return `This run used ${parts.join(', ')}.${warn}`;
}

// The hidden marker that goes with the sentence: the same figures, in a form the daily digest can add up without
// reading the wording. Implements "The consumption of a run is visible" of the execution-modes specification.
// The runs whose usage the digest adds up: those of the last seven days. Fixed, not a setting of relevo.yml.
export const USAGE_DAYS = 7;
const MARKER_RE = /<!-- relevo:usage (\{[^\n]*?\}) -->/g;
const FIGURES = ['turns', 'cost', 'tokens'];

/** The marker for a comment, from the same result as the sentence, or an empty string when there is nothing to say. */
export function usageMarker(usage, { subscription = false, phases = null, lenses = null, outcomeClass = null } = {}) {
  if (!usage) return '';
  const figures = {};
  FIGURES.forEach((k) => {
    if (usage[k] !== null && usage[k] !== undefined) figures[k] = usage[k];
  });
  if (usage.cached) figures.cached = usage.cached;
  if (Object.keys(figures).length === 0) return '';
  figures.notional = Boolean(subscription);
  // Where the time went and how the run ended. Readers that do not know these keys ignore them.
  if (Array.isArray(phases) && phases.length) figures.phases = phases;
  // The seconds of each QA lens, apart from the phases: the digest knows only the five phases.
  if (Array.isArray(lenses) && lenses.length) figures.lenses = lenses;
  if (OUTCOME_CLASSES.includes(outcomeClass)) figures.class = outcomeClass;
  return `<!-- relevo:usage ${JSON.stringify(figures)} -->`;
}

/**
 * The figures of one comment of the repository, or null. Only a comment of a bot counts, with exactly one marker whose
 * JSON is an object with finite numbers: a person who types a marker does not change the totals, and the figures are
 * never inferred from the sentence. `created_at` travels with the figures so that the caller can keep a window.
 */
export function parseUsageMarker(comment) {
  if (comment?.user?.type !== 'Bot') return null;
  const found = [...String(comment.body ?? '').matchAll(MARKER_RE)];
  if (found.length !== 1) return null;
  let data;
  try {
    data = JSON.parse(found[0][1]);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const run = { created_at: comment.created_at ?? null, notional: data.notional === true };
  for (const k of [...FIGURES, 'cached']) {
    if (data[k] === undefined) continue;
    if (num(data[k]) === null) return null;
    run[k] = data[k];
  }
  // The phases and the class are read only when they are well formed; a malformed one is left out, not an error.
  if (Array.isArray(data.phases)) {
    const phases = data.phases.filter((p) => p && typeof p.name === 'string' && num(p.seconds) !== null && p.seconds >= 0);
    if (phases.length === data.phases.length && phases.length) run.phases = phases.map((p) => ({ name: p.name, attempt: Number.isInteger(p.attempt) ? p.attempt : null, seconds: p.seconds }));
  }
  if (Array.isArray(data.lenses)) {
    const lenses = data.lenses.filter((l) => l && typeof l.name === 'string' && num(l.seconds) !== null && l.seconds >= 0);
    if (lenses.length === data.lenses.length && lenses.length) run.lenses = lenses.map((l) => ({ name: l.name, attempt: Number.isInteger(l.attempt) ? l.attempt : null, seconds: l.seconds }));
  }
  if (OUTCOME_CLASSES.includes(data.class)) run.class = data.class;
  return FIGURES.some((k) => run[k] !== undefined) ? run : null;
}

/**
 * How the runs of a window ended and where their time went: { byClass, phaseSeconds, withRecord, withoutRecord }.
 * A run without a class and without phases (a comment from before they existed) counts under `withoutRecord`.
 */
export function summarizeOutcomes(runs) {
  const byClass = {};
  const phaseSeconds = {};
  let withRecord = 0;
  runs.forEach((r) => {
    if (!r.class && !r.phases) return;
    withRecord += 1;
    if (r.class) byClass[r.class] = (byClass[r.class] ?? 0) + 1;
    (r.phases ?? []).forEach((p) => {
      phaseSeconds[p.name] = (phaseSeconds[p.name] ?? 0) + p.seconds;
    });
  });
  return { byClass, phaseSeconds, withRecord, withoutRecord: runs.length - withRecord };
}

/**
 * { runs, turns, cost, tokens, costRuns, notionalRuns } over parsed runs. A figure is the sum over the runs that
 * report it, and null when none does; `costRuns` of the runs report a cost and `notionalRuns` of those are notional.
 */
export function sumUsage(runs) {
  const sum = (k) => {
    const have = runs.filter((r) => num(r[k]) !== null);
    return have.length ? have.reduce((t, r) => t + r[k], 0) : null;
  };
  const costed = runs.filter((r) => num(r.cost) !== null);
  return {
    runs: runs.length, turns: sum('turns'), cost: sum('cost'), tokens: sum('tokens'),
    costRuns: costed.length, notionalRuns: costed.filter((r) => r.notional).length,
  };
}

// Messages the Claude CLI and the API document for a usage limit, a quota or an empty credit balance. These patterns
// are not from a failed run seen here (see docs/pilot-findings.md); a wrong guess only changes the wording of a
// comment on a run that already failed.
const LIMIT_RE = /usage limit|limit reached|rate[ _-]?limit|credit balance is too low|exceeded your (current )?quota|quota exceeded|resource[ _]exhausted|insufficient[ _]quota/i;

/**
 * Does the log show that a usage limit, a quota or the credit was reached? In a structured log only what a real limit
 * looks like counts: the text of a final result that is an error, or a rate-limit event whose status is not
 * "allowed" (the runner writes those events all through a healthy run, with status "allowed" and a tiny utilization,
 * so their mere name says nothing). A log that is not structured is plain text and is read as a whole.
 */
export function reachedUsageLimit(text) {
  const all = entries(text).filter((e) => e && typeof e === 'object');
  if (all.length === 0) return LIMIT_RE.test(String(text ?? ''));
  return all.some((e) => {
    if (e.type === 'rate_limit_event') {
      const status = e.rate_limit_info?.status;
      return typeof status === 'string' && !status.startsWith('allowed');
    }
    // The summary of the guard for the other agent runner is a result too: it has no is_error, but a failed exit code
    // and the tail of the standard error where the provider's message lands.
    if (e.type === 'result' && (e.is_error === true || (typeof e.exit_code === 'number' && e.exit_code !== 0))) {
      return LIMIT_RE.test([e.result, e.error, e.stderr_tail].map((v) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''))).join('\n'));
    }
    return false;
  });
}

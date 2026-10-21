// What a cloud run used, read from the execution log of the agent runner. Implements "The consumption of a run is
// visible" of the execution-modes specification.
//
// The format of that log is not documented (only its path is an output of the action), so everything here is
// tolerant: a JSON array, JSON lines or a single object are accepted, the last entry that looks like a result is
// used, and anything missing is simply left out. Nothing found means nothing is said, never an error.

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

/** { turns, cost, tokens, cached } with null for what the log does not say, or null when it says none of them. */
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
  return usage.turns === null && usage.cost === null && usage.tokens === null ? null : usage;
}

/** One line for a comment, or an empty string when there is nothing to say. */
export function usageLine(usage, { subscription = false } = {}) {
  if (!usage) return '';
  const parts = [];
  if (usage.turns !== null) parts.push(`${usage.turns} turn${usage.turns === 1 ? '' : 's'}`);
  if (usage.cost !== null) parts.push(`about $${usage.cost.toFixed(2)}${subscription ? ' (notional: a subscription is not billed per run)' : ''}`);
  if (usage.tokens !== null) parts.push(`${usage.tokens.toLocaleString('en-US')} tokens${usage.cached ? ` (plus ${usage.cached.toLocaleString('en-US')} from the cache)` : ''}`);
  return parts.length ? `This run used ${parts.join(', ')}.` : '';
}

// Messages the Claude CLI and the API document for a usage limit, a quota or an empty credit balance. These patterns
// are not from a failed run seen here (see docs/pilot-findings.md); a wrong guess only changes the wording of a
// comment on a run that already failed.
const LIMIT_RE = /usage limit|limit reached|rate[ _-]?limit|credit balance is too low|exceeded your (current )?quota|quota exceeded|resource[ _]exhausted|insufficient[ _]quota/i;

/** Does the log show that a usage limit, a quota or the credit was reached? */
export function reachedUsageLimit(text) {
  return LIMIT_RE.test(String(text ?? ''));
}

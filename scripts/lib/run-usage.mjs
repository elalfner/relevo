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

// The cost of an agent is a share of the real cost of its model, by the weighted input side of its messages. The output
// tokens are not used: the `usage` of a streamed message is a snapshot taken before the answer is complete (a real log
// had 2,466 output tokens in its messages and 66,240 in `modelUsage`), while the input side agrees with `modelUsage`.
// The weights follow the structure of the published prices: a cache read costs a tenth of an input token and a cache
// write a quarter more (twice for the one-hour cache).
function inputSideWeight(u) {
  const input = num(u.input_tokens) ?? 0;
  const read = num(u.cache_read_input_tokens) ?? 0;
  const five = num(u.cache_creation?.ephemeral_5m_input_tokens);
  const hour = num(u.cache_creation?.ephemeral_1h_input_tokens);
  const created = num(u.cache_creation_input_tokens) ?? 0;
  const write = five !== null || hour !== null ? (five ?? 0) * 1.25 + (hour ?? 0) * 2 : created * 1.25;
  return input + read * 0.1 + write;
}

/**
 * The real cost of each model and an estimate of what each agent cost, from what the log has: `modelUsage` of the
 * result, the `Agent` calls, `task_started` and `task_notification` of each subagent, and the model and usage of every
 * message with the `parent_tool_use_id` of its agent. Messages repeat once per content block, so each id counts once.
 * Returns { models, agents }, each null when the log does not have what it needs. The estimated costs of the agents of
 * a model add up to its real cost.
 */
function breakdown(all, result) {
  const models = Object.entries(result.modelUsage && typeof result.modelUsage === 'object' ? result.modelUsage : {})
    .filter(([, m]) => m && num(m.costUSD) !== null)
    .map(([model, m]) => ({ model, cost: m.costUSD }));

  const done = new Map();
  const started = new Map();
  const calls = new Map();
  all.forEach((e) => {
    if (e.type === 'system' && e.subtype === 'task_started' && typeof e.tool_use_id === 'string') started.set(e.tool_use_id, e);
    if (e.type === 'system' && e.subtype === 'task_notification' && typeof e.tool_use_id === 'string' && num(e.usage?.tool_uses) !== null) done.set(e.tool_use_id, e.usage);
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      e.message.content.forEach((c) => {
        if (c?.type === 'tool_use' && (c.name === 'Agent' || c.name === 'Task') && typeof c.id === 'string') calls.set(c.id, c.input ?? {});
      });
    }
  });
  if (done.size === 0) return { models: models.length ? models : null, agents: null };

  // One entry per message id and agent; the main agent is the key ''.
  const seen = new Map();
  all.forEach((e) => {
    if (e.type !== 'assistant' || !e.message?.id || !e.message.usage) return;
    seen.set(`${e.parent_tool_use_id ?? ''}|${e.message.id}`, { agent: e.parent_tool_use_id ?? '', model: e.message.model ?? null, weight: inputSideWeight(e.message.usage) });
  });
  const weights = new Map(); // agent, then model -> weight
  const modelTotals = new Map();
  const modelOfAgent = new Map(); // the model with the most weight, per agent
  seen.forEach(({ agent, model, weight }) => {
    if (!model) return;
    if (!weights.has(agent)) weights.set(agent, new Map());
    weights.get(agent).set(model, (weights.get(agent).get(model) ?? 0) + weight);
    modelTotals.set(model, (modelTotals.get(model) ?? 0) + weight);
  });
  weights.forEach((byModel, agent) => {
    byModel.forEach((w, model) => {
      const best = modelOfAgent.get(agent);
      if (!best || w > best.weight) modelOfAgent.set(agent, { model, weight: w });
    });
  });
  const costOf = (agent) => {
    if (models.length === 0) return null;
    let total = 0;
    let any = false;
    models.forEach(({ model, cost }) => {
      const w = weights.get(agent)?.get(model);
      const sum = modelTotals.get(model);
      if (w && sum > 0) {
        total += cost * (w / sum);
        any = true;
      }
    });
    return any ? total : null;
  };
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

  const agents = [clean({ name: 'main', model: modelOfAgent.get('')?.model ?? null, turns: num(result.num_turns), cost: costOf('') })];
  done.forEach((usage, id) => {
    const call = calls.get(id) ?? {};
    const name = started.get(id)?.subagent_type ?? call.subagent_type;
    agents.push(clean({
      name: typeof name === 'string' && name ? name : 'subagent',
      model: modelOfAgent.get(id)?.model ?? (typeof call.model === 'string' ? call.model : null),
      effort: typeof call.effort === 'string' ? call.effort : null,
      turns: usage.tool_uses + 1,
      seconds: num(usage.duration_ms) !== null ? Math.round(usage.duration_ms / 1000) : null,
      cost: costOf(id),
    }));
  });
  return { models: models.length ? models : null, agents };
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
  const detail = breakdown(all, result);
  if (sub > 0 && usage.turns !== null) {
    usage.turns += sub;
    usage.subagentTurns = sub;
  }
  if (detail.models) usage.models = detail.models;
  if (detail.agents) usage.agents = detail.agents;
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

// The model plan of the run (scripts/model-plan.mjs), as `go` saved it. Only fixed words and short strings are kept: the plan
// is read from a file and goes into a comment.
const PLAN_SOURCES = ['config', 'auto', 'issue'];
const ESCALATION_REASONS = ['qa-rejected', 'gate-red'];
const PLAN_ROLES = ['dev', 'spec', 'security', 'code', 'interface'];
const text200 = (v) => String(v ?? '').replace(/[^\x20-\x7e]/g, ' ').trim().slice(0, 200);

/** The roles of a saved plan as [{ role, model, effort, source, why }], and its notes; null when there is no usable plan. */
export function planFromJson(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return null; }
  }
  if (!data || typeof data !== 'object' || data.failed) return null;
  const entry = (role, r) => (r && typeof r.model === 'string' && r.model && PLAN_SOURCES.includes(r.source)
    ? { role, model: text200(r.model), ...(typeof r.effort === 'string' ? { effort: text200(r.effort) } : {}), source: r.source, ...(typeof r.why === 'string' ? { why: text200(r.why) } : {}) }
    : null);
  const roles = [entry('dev', data.dev), ...PLAN_ROLES.slice(1).map((lens) => entry(lens, data.qa?.[lens]))].filter(Boolean);
  if (roles.length === 0) return null;
  const notes = Array.isArray(data.notes) ? data.notes.map(text200).filter(Boolean).slice(0, 5) : [];
  // The retries that ran the developer one name up the ladder (`model-plan.mjs escalate`); a malformed entry is left out.
  const escalations = (Array.isArray(data.escalations) ? data.escalations : [])
    .filter((e) => e && typeof e.from === 'string' && typeof e.to === 'string' && Number.isInteger(e.attempt) && ESCALATION_REASONS.includes(e.reason))
    .map((e) => ({ attempt: e.attempt, from: text200(e.from), to: text200(e.to), reason: e.reason })).slice(0, 5);
  return { roles, notes, escalations };
}

/**
 * The checks of the validation gate with their seconds, from the text of its receipt: [{ name, seconds, reused?, original? }].
 * A reused check ran in no time in this gate, so it says how long it took when it ran. Null when the receipt is missing,
 * is not JSON or has no usable command.
 */
export function checksFromReceipt(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return null; }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.commands)) return null;
  const checks = data.commands
    .filter((c) => c && typeof c.name === 'string' && /^[a-z][a-z-]{0,29}$/.test(c.name) && num(c.duration_ms) !== null && c.duration_ms >= 0)
    .map((c) => ({ name: c.name, seconds: Math.round(c.duration_ms / 1000), ...(c.reused === true ? { reused: true, original: num(c.original_duration_ms) !== null ? Math.round(c.original_duration_ms / 1000) : 0 } : {}) }));
  return checks.length ? checks : null;
}

/** One line for a comment, or an empty string when there is nothing to say. */
export function usageLine(usage, { subscription = false, limits = null, plan = null, checks = null } = {}) {
  if (!usage) return '';
  const parts = [];
  if (usage.turns !== null) parts.push(`${usage.turns} turn${usage.turns === 1 ? '' : 's'}${usage.subagentTurns ? ` (${usage.subagentTurns} by subagents)` : ''}`);
  if (usage.cost !== null) parts.push(`about $${usage.cost.toFixed(2)}${subscription ? ' (notional: a subscription is not billed per run)' : ''}`);
  if (usage.tokens !== null) parts.push(`${usage.tokens.toLocaleString('en-US')} tokens${usage.cached ? ` (plus ${usage.cached.toLocaleString('en-US')} from the cache)` : ''}`);
  if (!parts.length) return '';
  const over = limitsExceeded(usage, limits ?? {});
  const warn = over.map((o) => ` It went past ${o.limit} (${o.max}) with ${o.limit.endsWith('turns') ? o.used : `$${o.used.toFixed(2)}`}${o.limit.endsWith('turns') && usage.subagentTurns ? ': the runner counts only the turns of the main agent, so the turns of the subagents were not stopped' : ''}.`).join('');
  const agent = (a) => `${a.name}${a.model ? ` (${a.model}${a.effort ? `, ${a.effort}` : ''})` : ''} ${a.turns} turn${a.turns === 1 ? '' : 's'}${a.seconds ? `, ${(a.seconds / 60).toFixed(1)} min` : ''}${a.cost !== undefined ? `, about $${a.cost.toFixed(2)}` : ''}`;
  const byAgent = usage.agents?.length ? ` By agent: ${usage.agents.map(agent).join('; ')}.` : '';
  const byModel = usage.models?.length ? ` Cost by model: ${usage.models.map((m) => `${m.model} $${m.cost.toFixed(2)}`).join(', ')}.` : '';
  const role = (r) => `${r.role === 'dev' ? 'developer' : `${r.role} lens`} ${r.model}${r.effort ? `, ${r.effort}` : ''} (${r.source}${r.why ? `: ${r.why}` : ''})`;
  const byPlan = plan?.roles?.length ? ` Models chosen: ${plan.roles.map(role).join('; ')}.${plan.notes?.length ? ` Notes on the plan: ${plan.notes.join('; ')}.` : ''}` : '';
  const raised = plan?.escalations?.length ? ` The developer went up on a retry: ${plan.escalations.map((e) => `${e.from} to ${e.to} on attempt ${e.attempt} (${e.reason === 'gate-red' ? 'the gate was red' : 'QA rejected'})`).join('; ')}.` : '';
  const byCheck = checks?.length ? ` Checks of the gate: ${checks.map((c) => (c.reused ? `${c.name} reused (${c.original}s when it ran)` : `${c.name} ${c.seconds}s`)).join(', ')}.` : '';
  return `This run used ${parts.join(', ')}.${warn}${byAgent}${byModel}${byCheck}${byPlan}${raised}`;
}

// The hidden marker that goes with the sentence: the same figures, in a form the daily digest can add up without
// reading the wording. Implements "The consumption of a run is visible" of the execution-modes specification.
// The runs whose usage the digest adds up: those of the last seven days. Fixed, not a setting of relevo.yml.
export const USAGE_DAYS = 7;
const MARKER_RE = /<!-- relevo:usage (\{[^\n]*?\}) -->/g;
const FIGURES = ['turns', 'cost', 'tokens'];

/** The marker for a comment, from the same result as the sentence, or an empty string when there is nothing to say. */
export function usageMarker(usage, { subscription = false, phases = null, lenses = null, outcomeClass = null, plan = null, checks = null } = {}) {
  if (!usage) return '';
  const figures = {};
  FIGURES.forEach((k) => {
    if (usage[k] !== null && usage[k] !== undefined) figures[k] = usage[k];
  });
  if (usage.cached) figures.cached = usage.cached;
  if (Object.keys(figures).length === 0) return '';
  // Which agent used what, and the real cost of each model; the digest adds up only the totals and ignores these keys.
  if (Array.isArray(usage.agents) && usage.agents.length) figures.agents = usage.agents.map((a) => ({ ...a, ...(a.cost !== undefined ? { cost: Math.round(a.cost * 10000) / 10000 } : {}) }));
  if (Array.isArray(usage.models) && usage.models.length) figures.models = usage.models;
  figures.notional = Boolean(subscription);
  // Where the time went and how the run ended. Readers that do not know these keys ignore them.
  if (Array.isArray(phases) && phases.length) figures.phases = phases;
  // The seconds of each QA lens, apart from the phases: the digest knows only the five phases.
  if (Array.isArray(lenses) && lenses.length) figures.lenses = lenses;
  // The model and the effort each role was launched with, and where the choice came from; the digest ignores this key.
  // The seconds of each check of the gate, and whether it was reused; the digest ignores this key.
  if (Array.isArray(checks) && checks.length) figures.checks = checks;
  if (plan?.roles?.length) figures.plan = plan.roles;
  if (plan?.escalations?.length) figures.escalated = plan.escalations;
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
  // Which agent used what: read only when every entry is well formed; a malformed one leaves the key out, not an error.
  if (Array.isArray(data.agents) && data.agents.length) {
    const good = data.agents.every((a) => a && typeof a.name === 'string' && num(a.turns) !== null && (a.model === undefined || typeof a.model === 'string')
      && (a.effort === undefined || typeof a.effort === 'string') && (a.seconds === undefined || num(a.seconds) !== null) && (a.cost === undefined || num(a.cost) !== null));
    if (good) run.agents = data.agents.map(({ name, model, effort, turns, seconds, cost }) => ({ name, turns, ...(model !== undefined ? { model } : {}), ...(effort !== undefined ? { effort } : {}), ...(seconds !== undefined ? { seconds } : {}), ...(cost !== undefined ? { cost } : {}) }));
  }
  if (Array.isArray(data.models) && data.models.length && data.models.every((m) => m && typeof m.model === 'string' && num(m.cost) !== null)) {
    run.models = data.models.map((m) => ({ model: m.model, cost: m.cost }));
  }
  // The model plan: read only when every entry is well formed; a malformed one leaves the key out, not an error.
  if (Array.isArray(data.plan) && data.plan.length && data.plan.every((r) => r && PLAN_ROLES.includes(r.role) && typeof r.model === 'string' && PLAN_SOURCES.includes(r.source))) {
    run.plan = data.plan.map((r) => ({ role: r.role, model: r.model, source: r.source, ...(typeof r.effort === 'string' ? { effort: r.effort } : {}), ...(typeof r.why === 'string' ? { why: r.why } : {}) }));
  }
  if (Array.isArray(data.escalated) && data.escalated.length && data.escalated.every((e) => e && typeof e.from === 'string' && typeof e.to === 'string' && Number.isInteger(e.attempt) && ESCALATION_REASONS.includes(e.reason))) {
    run.escalated = data.escalated.map((e) => ({ attempt: e.attempt, from: e.from, to: e.to, reason: e.reason }));
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

/**
 * Which limit of the runner cut the run, from the result of its log: `turns` (`error_max_turns`), `cost`
 * (`error_max_budget_usd`), or null when the log says neither. The subtypes are the ones the Claude Code SDK documents
 * for a result; a log without them gives null and the comment keeps its general wording.
 */
export function runnerCut(text) {
  const result = [...entries(text).filter((e) => e && typeof e === 'object')].reverse().find((e) => e.type === 'result');
  if (result?.subtype === 'error_max_turns') return 'turns';
  if (result?.subtype === 'error_max_budget_usd') return 'cost';
  return null;
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

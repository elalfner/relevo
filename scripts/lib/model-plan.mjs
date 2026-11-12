// The model and the effort of each agent for one run. Implements "The model plan is made by a script before the first launch",
// "The plan scores the size of the change and two raises", "What the issue asks for is clamped" and "The plan never raises the
// cost limit" of the go specification.
//
// A script decides, not the main agent: the same inputs give the same plan, and the plan says for each role where its model
// came from (`config`, `auto` or `issue`) and why. A role that is not `auto` keeps what relevo.yml says. Nothing here reads or
// changes a limit: `limits.run_max_cost`, `run_max_turns` and `run_max_minutes` stay the hard stops. A role on `auto` always stays
// inside its range: a model that the issue asks for is clamped to the floor and to the ceiling, and so is the default model of the role.
//
// The effort is not scored in this stage: every role keeps the configured effort.

import { AGENT_DEFAULTS, AUTO, QA_LENSES } from './config.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { parseIssueModels } from './issue-model.mjs';
import { taskGroups } from './task-groups.mjs';

// Size of the change = pending tasks + scenarios of the issue.
export const SMALL_MAX = 6;
export const MEDIUM_MAX = 14;

// Security-sensitive areas, in English and Spanish. "Design token" is a design term, not a credential.
const SENSITIVE_RE = /\b(?:authenticat|authoriz|oauth|login|log-in|credential|token|password|payment|permission|secret|encrypt|autentic|autoriz|contrase|credencial|pago|permiso|secreto|cifrad)/i;
const DESIGN_TOKEN_RE = /\bdesign[ -]tokens?\b/gi;

/** The size class of a change: 'none' when there is nothing to score. */
export function sizeOf(tasks, scenarios) {
  const n = tasks + scenarios;
  if (n === 0) return 'none';
  if (n <= SMALL_MAX) return 'small';
  if (n <= MEDIUM_MAX) return 'medium';
  return 'large';
}

/** Does the text name a security-sensitive area? */
export function isSensitive(text) {
  return SENSITIVE_RE.test(String(text ?? '').replace(DESIGN_TOKEN_RE, ''));
}

/** The position of a level (0 floor, 1 middle rounded up, 2 ceiling) in the range [floor..ceiling] of the ladder. */
function pickIndex(ladder, floor, ceiling, level) {
  const f = ladder.indexOf(floor);
  const c = ladder.indexOf(ceiling);
  if (level <= 0) return f;
  if (level >= 2) return c;
  return f + Math.ceil((c - f) / 2);
}

const LEVEL = { small: 0, medium: 1, large: 2 };

/**
 * config        the effective configuration (`loadConfig(...).config`)
 * issue         { title, body } of the issue
 * tasksText     the text of tasks.md of the change (the pending tasks are counted); null when there is none
 * lenses        the QA lenses that run (the others get no entry); all of them by default
 *
 * Returns { dev, qa: { <lens>: ... }, signals, notes }. Each role is { model, effort, source, why }.
 */
export function planModels({ config, issue = {}, tasksText = null, lenses = QA_LENSES }) {
  const agents = config.agents;
  const ladder = agents.ladder;
  const notes = [];
  const body = String(issue.body ?? '');

  const parsed = parseIssueBody(body);
  const tasks = tasksText === null ? 0 : taskGroups(tasksText).pending;
  const scenarios = parsed.scenarios ?? 0;
  const size = sizeOf(tasks, scenarios);
  const deps = (parsed.allowPaths ?? []).length > 0;
  const sensitive = isSensitive(`${issue.title ?? ''}\n${body}`);
  const signals = { tasks, scenarios, size, dependency_files: deps, sensitive };

  const asked = parseIssueModels(body);
  asked.problems.forEach((p) => notes.push(`the issue: ${p}`));
  const publicTrust = config.trust === 'public';
  if (publicTrust && (asked.dev || asked.qa)) notes.push('trust is public, so the Model: and QA-model: lines of the issue are ignored');

  const explain = () => {
    if (size === 'none') return 'there was nothing to score';
    const parts = [`${size} change (${tasks} tasks, ${scenarios} scenarios)`];
    if (deps) parts.push('a dependency file is allowed');
    if (sensitive) parts.push('a security-sensitive area is named');
    return parts.join(', ');
  };

  function decide(path, role, defaults, askedName, isSecurity) {
    if (role.model !== AUTO) return { model: role.model, effort: role.effort, source: 'config', why: 'set in relevo.yml' };
    const { floor, ceiling } = role;
    if (askedName && !publicTrust) {
      const idx = ladder.indexOf(askedName);
      if (idx === -1) {
        notes.push(`the issue asks for "${askedName}" for ${path}, which is not in agents.ladder (${ladder.join(', ')}), so the line is ignored`);
      } else if (idx > ladder.indexOf(ceiling)) {
        return { model: ceiling, effort: role.effort, source: 'issue', why: `the issue asks for ${askedName}, clamped to the ceiling ${ceiling}` };
      } else if (idx < ladder.indexOf(floor)) {
        // The floor is the lowest the configuration allows for this role: an issue cannot go under it, as it cannot go over the ceiling.
        return { model: floor, effort: role.effort, source: 'issue', why: `the issue asks for ${askedName}, raised to the floor ${floor}` };
      } else {
        return { model: askedName, effort: role.effort, source: 'issue', why: `the issue asks for ${askedName}` };
      }
    }
    if (size === 'none') {
      // The default model of the role is a name like any other: it is kept inside the range, and a name the ladder does not have is not used.
      const at = ladder.indexOf(defaults.model);
      const moved = at === -1 ? ` (${defaults.model} is not in agents.ladder, so the floor ${floor} is used)`
        : at < ladder.indexOf(floor) ? ` (${defaults.model} was raised to the floor ${floor})`
          : at > ladder.indexOf(ceiling) ? ` (${defaults.model} was lowered to the ceiling ${ceiling})` : '';
      const model = at === -1 || at < ladder.indexOf(floor) ? floor : at > ladder.indexOf(ceiling) ? ceiling : defaults.model;
      return { model, effort: role.effort, source: 'auto', why: `the default model of the role${moved}: ${explain()}` };
    }
    const raised = deps || sensitive;
    const level = isSecurity && raised ? 2 : Math.min(2, LEVEL[size] + (raised ? 1 : 0));
    const model = ladder[pickIndex(ladder, floor, ceiling, level)];
    return { model, effort: role.effort, source: 'auto', why: explain() };
  }

  const plan = { dev: decide('agents.dev', agents.dev, AGENT_DEFAULTS.dev, asked.dev, false), qa: {}, signals, notes };
  lenses.forEach((lens) => {
    plan.qa[lens] = decide(`agents.qa.${lens}`, agents.qa[lens], AGENT_DEFAULTS.qa[lens], asked.qa, lens === 'security');
  });

  // A line of the issue for a role that is not on auto is not read: the repository decided.
  if (!publicTrust) {
    if (asked.dev && agents.dev.model !== AUTO) notes.push(`Model: of the issue is ignored: agents.dev is not auto`);
    if (asked.qa && lenses.every((l) => agents.qa[l].model !== AUTO)) notes.push('QA-model: of the issue is ignored: no QA lens is auto');
  }
  return plan;
}

/**
 * The plan that the configuration alone gives: what `go` uses when the plan cannot be made. A role on `auto` has no model to
 * launch with, so it gets the default model of the role.
 */
export function configPlan(config, reason, lenses = QA_LENSES) {
  const role = (r, defaults) => ({ model: r.model === AUTO ? defaults.model : r.model, effort: r.effort, source: 'config', why: reason });
  const qa = {};
  lenses.forEach((lens) => { qa[lens] = role(config.agents.qa[lens], AGENT_DEFAULTS.qa[lens]); });
  return { dev: role(config.agents.dev, AGENT_DEFAULTS.dev), qa, signals: null, notes: [reason] };
}

// The reasons that raise the developer for a retry: a red gate or a rejection by the lenses, both followed by a fix launch.
export const ESCALATION_REASONS = ['qa-rejected', 'gate-red'];

/**
 * The model of the developer for a retry. Implements "A retry of the developer runs one level up" of the go specification.
 *
 *   config   the effective configuration
 *   from     the model the developer ran with in the attempt that failed
 *   attempt  the number of the attempt that is about to start (2 for the first retry)
 *   reason   one of ESCALATION_REASONS
 *
 * Returns { model, escalated, why, ...(escalated: from, to, attempt, reason) }. Only a developer on `auto` is raised, one name of
 * `agents.ladder` at a time and never past its ceiling, so the cost limit is not touched. Anything else keeps `from`.
 */
export function escalateDev({ config, from, attempt, reason }) {
  const keep = (why) => ({ model: from, escalated: false, why });
  const dev = config.agents.dev;
  if (dev.model !== AUTO) return keep('the developer is not on auto, so the repository decided its model');
  if (!ESCALATION_REASONS.includes(reason)) return keep(`"${reason}" is not a reason to raise the model`);
  const ladder = config.agents.ladder;
  const at = ladder.indexOf(from);
  if (at === -1) return keep(`"${from}" is not in agents.ladder (${ladder.join(', ')})`);
  if (at >= ladder.indexOf(dev.ceiling)) return keep(`${from} is already the ceiling of the developer`);
  const to = ladder[at + 1];
  return { model: to, escalated: true, from, to, attempt, reason, why: `raised from ${from} to ${to} for attempt ${attempt} (${reason})` };
}

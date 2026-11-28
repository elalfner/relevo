// Schema, defaults and validation for relevo.yml.
// Implements openspec/specs/configuration/spec.md.

import { parse, YamlLiteError } from './yaml-lite.mjs';
import { LABEL_KEYS } from './labels.mjs';
import { SUPPORTED_LANGUAGES } from './messages.mjs';
import { findCredentials } from './scan.mjs';
import { normalizePlatforms } from './platforms.mjs';
import { invalidRestrictedEntries, restrictedRule } from './restricted-paths.mjs';
import { hardRule } from './protected-paths.mjs';

// One entry per supported setting. `required: true` means there is no default.
export const SETTINGS = [
  { path: 'branches.base', type: 'string', default: 'dev' },
  { path: 'branches.release', type: 'string', default: 'main' },
  { path: 'tracker', type: 'enum', allowed: ['github', 'files'], default: 'github' },
  { path: 'git_provider', type: 'enum', allowed: ['github', 'local'], default: 'github' },
  // How deep Relevo works: it moves the default effort of the agents and the questions of think, never which QA lenses run.
  { path: 'depth', type: 'enum', allowed: ['prototype', 'standard'], default: 'standard' },
  { path: 'team.members', type: 'string[]', default: [] },
  { path: 'team.spec_writer', type: 'string', default: null },
  { path: 'team.approvers', type: 'string[]', default: [] },
  { path: 'review.mode', type: 'enum', allowed: ['none', 'peer', 'roles'], default: 'peer' },
  { path: 'review.merger', type: 'enum', allowed: ['author', 'approver'], default: 'approver' },
  { path: 'review.autopilot', type: 'enum', allowed: ['off', 'precheck', 'verify'], default: 'off' },
  { path: 'review.allowed_origins', type: 'origin-list', default: [] },
  // Whether the ship workflow may merge when no check ran on any commit; /relevo:ship asks the person instead.
  { path: 'review.ship_without_ci', type: 'bool', default: false },
  { path: 'limits.built_unreviewed_per_person', type: 'int', min: 1, default: 2 },
  { path: 'limits.concurrent_agents', type: 'int', min: 1, default: 3 },
  { path: 'limits.review_sla_hours', type: 'int', min: 1, default: 8 },
  { path: 'limits.run_max_turns', type: 'int', min: 1, default: 100 },
  // After these minutes an unattended run starts no further agent (the job timeout of the go workflow comes after).
  { path: 'limits.run_max_minutes', type: 'int', min: 5, default: 50 },
  { path: 'limits.building_alert_hours', type: 'int', min: 1, default: 3 },
  // How long an issue waits for a file that another issue also names before it starts anyway.
  { path: 'limits.shared_file_wait_hours', type: 'int', min: 1, default: 24 },
  // The cost limit applies to Claude runs and the token limit to Antigravity runs; both may coexist in one file so teams can switch locally or in the cloud without editing limits.
  { path: 'limits.run_max_cost', type: 'number', exclusiveMin: 0, required: true, default: null, requiredFor: 'claude', missing: 'unattended runs must always have a cost limit (amount in US dollars per run)' },
  { path: 'limits.run_max_tokens', type: 'int', min: 1000, default: null, required: true, requiredFor: 'antigravity', missing: 'unattended runs must always have a limit, and for this agent it is a number of tokens per run' },
  { path: 'agent.build', type: 'enum', allowed: ['claude', 'antigravity'], default: 'claude' },
  // The runner of every Relevo workflow: runs-on is read before any step, so init writes these labels into the files.
  { path: 'runner.labels', type: 'label-list', default: ['ubuntu-latest'] },
  // Only the build job of the go workflow runs on these when they are set; there is no default (absent, it runs on runner.labels).
  { path: 'runner.build_labels', type: 'label-list', default: null },
  { path: 'qa.retries', type: 'int', min: 0, default: 1 },
  { path: 'qa.rules_from', type: 'path-list', default: [] },
  // Whether the findings of the bugs lens block: `advisory` (they are notes), `blocking` (a CONFIRMED finding blocks) or `off` (the lens does not run).
  { path: 'qa.bugs', type: 'enum', allowed: ['advisory', 'blocking', 'off'], default: 'advisory' },
  // Files no agent or script reads, added to the base list of restricted-paths.mjs; it can never take an entry away.
  { path: 'restricted_paths', type: 'restricted-list', default: [] },
  // Files that issues only add lines to (a merge is trivial), so naming one does not make two issues wait for each other.
  { path: 'queue.append_only', type: 'glob-list', default: [] },
  // Generated files and the one command that regenerates them when the base branch is merged into a build.
  { path: 'integration.generated', type: 'glob-list', default: [] },
  { path: 'integration.regenerate', type: 'string', default: null },
  { path: 'skills.allow_scripts', type: 'string[]', default: [] },
  { path: 'links', type: 'repo-list', default: [] },
  { path: 'evidence.policy', type: 'enum', allowed: ['attach_to_pr', 'local_only'], default: 'attach_to_pr' },
  { path: 'digest.issue', type: 'int', min: 1, default: null },
  { path: 'language', type: 'string', default: 'en' },
  { path: 'design.images', type: 'bool', default: false },
  // Where the design system lives, for the interface step of `think`: folders or files inside the repository that the
  // agents may read. They never name a restricted or a protected path.
  { path: 'design.system.tokens', type: 'repo-path-list', default: [] },
  { path: 'design.system.components', type: 'repo-path-list', default: [] },
  { path: 'design.system.references', type: 'repo-path-list', default: [] },
  { path: 'trust', type: 'enum', allowed: ['private-team', 'public'], default: 'private-team' },
  // Prints a redacted rendering of the agent output and keeps the results in the transcript of a run that ends abnormally. Off by default; refused with trust public.
  { path: 'run.full_output', type: 'bool', default: false },
];

const GROUPS = new Set(SETTINGS.filter((s) => s.path.includes('.')).map((s) => s.path.split('.')[0]));
const TOP_SCALARS = new Set(SETTINGS.filter((s) => !s.path.includes('.')).map((s) => s.path));
const KNOWN_TOP = new Set([...GROUPS, ...TOP_SCALARS, 'labels', 'platform', 'platforms', 'agents']);

// The model and the effort of the developer agent and of each QA lens. The default of `dev` is what it always was; the lenses'
// defaults are set in the design of specialist-review-lenses and change only on the evidence of its evaluation.
export const QA_LENSES = ['spec', 'security', 'code', 'interface', 'bugs'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// The order of the models, from the lowest to the highest. Relevo reads only the order, never checks the names against a list of
// models (the list changes): a new model needs a line in relevo.yml and no release.
export const DEFAULT_LADDER = ['haiku', 'sonnet', 'opus'];
export const ANTIGRAVITY_LADDER = ['flash_lite', 'flash', 'pro', 'inherit'];
export const ANTIGRAVITY_SUBAGENT_TIERS = ['flash_lite', 'flash', 'pro', 'inherit'];
export const AUTO = 'auto';
// The lowest model a QA lens takes by default on `auto`.
export const QA_MIN_MODEL = 'sonnet';
export const ANTIGRAVITY_QA_MIN_MODEL = 'inherit';
// Effort suffix on an Antigravity model slug (e.g. `gemini-4-neon-high`); passing a conflicting `--effort` exits 1 in agy 1.5.18.
export const MODEL_EFFORT_SUFFIX_RE = /-(low|medium|high|xhigh|max)$/;

/** The effort suffix carried by a model slug (e.g. `high` in `gemini-4-neon-high`), or null when it is a base slug. */
export function extractEffortSuffix(model) {
  if (typeof model !== 'string') return null;
  const m = MODEL_EFFORT_SUFFIX_RE.exec(model.trim());
  return m ? m[1] : null;
}

export const AGENT_DEFAULTS = {
  ladder: [...DEFAULT_LADDER],
  dev: { model: 'sonnet', effort: 'high' },
  qa: {
    spec: { model: 'opus', effort: 'high' },
    security: { model: 'opus', effort: 'high' },
    code: { model: 'sonnet', effort: 'high' },
    interface: { model: 'sonnet', effort: 'medium' },
    // The defaults of the bugs lens start from those of `code` and change only on the evidence of docs/lens-evaluation.md.
    bugs: { model: 'sonnet', effort: 'high' },
  },
};

export const ANTIGRAVITY_AGENT_DEFAULTS = {
  main: { model: 'gemini-4-neon', effort: 'high' },
  ladder: [...ANTIGRAVITY_LADDER],
  dev: { model: 'inherit', effort: null },
  qa: {
    spec: { model: 'inherit', effort: null },
    security: { model: 'inherit', effort: null },
    code: { model: 'inherit', effort: null },
    interface: { model: 'inherit', effort: null },
    bugs: { model: 'inherit', effort: null },
  },
};

/**
 * The defaults of the agents at a depth for a tool (`claude` or `antigravity`).
 * For Claude, `standard` is `AGENT_DEFAULTS` and `prototype` lowers the effort of the developer and every lens by one step
 * (never below `low`) and caps default lens models at `QA_MIN_MODEL` (`sonnet`).
 * For Antigravity, `standard` uses `gemini-4-neon` (`high`) on `main` and `inherit` on `dev` and all five QA lenses so no
 * subagent silently downgrades to `gemini-4-hydrogen-*`; `prototype` lowers `main.effort` to `medium` while keeping `dev`
 * and all five lenses on `inherit`. A value written under `agents` wins over all of it.
 */
export function agentDefaults(depth = 'standard', tool = 'claude') {
  if (tool === 'antigravity') {
    const defaults = structuredClone(ANTIGRAVITY_AGENT_DEFAULTS);
    if (depth === 'prototype') {
      const idx = EFFORTS.indexOf(defaults.main.effort);
      defaults.main.effort = EFFORTS[Math.max(idx - 1, 0)];
    }
    return defaults;
  }
  const defaults = structuredClone(AGENT_DEFAULTS);
  if (depth !== 'prototype') return defaults;
  const lower = (effort) => EFFORTS[Math.max(EFFORTS.indexOf(effort) - 1, 0)];
  const rank = (model) => DEFAULT_LADDER.indexOf(model);
  defaults.dev.effort = lower(defaults.dev.effort);
  QA_LENSES.forEach((lens) => {
    const role = defaults.qa[lens];
    role.effort = lower(role.effort);
    if (rank(role.model) > rank(QA_MIN_MODEL)) role.model = QA_MIN_MODEL;
  });
  return defaults;
}
const isMapValue = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const AGENT_TOOLS = ['claude', 'antigravity'];

/** Validate and resolve one tool's agent settings from optional base (top-level `agents.*`) and scoped (`agents.<tool>.*`) maps. */
function resolveToolAgents({ rawTop = null, rawScoped = null, tool = 'claude', depth = 'standard' }) {
  const errors = [];
  const given = [];
  const value = agentDefaults(depth, tool);
  const qaMinModel = tool === 'antigravity' ? ANTIGRAVITY_QA_MIN_MODEL : QA_MIN_MODEL;
  const scopedPrefix = `agents.${tool}`;

  const sources = [];
  if (rawTop) sources.push({ raw: rawTop, prefix: 'agents' });
  if (rawScoped) sources.push({ raw: rawScoped, prefix: scopedPrefix });

  // Validate unknown keys inside a scoped tool block.
  if (rawScoped) {
    Object.keys(rawScoped).forEach((k) => {
      if (!['main', 'dev', 'qa', 'ladder'].includes(k)) {
        errors.push({ path: `${scopedPrefix}.${k}`, message: `unknown setting "${scopedPrefix}.${k}"; the roles are main, dev and qa, and ladder is the order of the models` });
      }
    });
  }

  // 1. Ladder first: the floor and the ceiling of every role are names in it.
  sources.forEach(({ raw, prefix }) => {
    if (raw.ladder === undefined) return;
    const l = raw.ladder;
    const names = Array.isArray(l) ? l : null;
    const path = `${prefix}.ladder`;
    if (!names || names.length === 0 || names.some((n) => typeof n !== 'string' || n.trim() === '')) {
      errors.push({ path, message: `${path} must be a list of model names from the lowest to the highest (got ${JSON.stringify(l)})` });
    } else if (new Set(names.map((n) => n.trim())).size !== names.length) {
      errors.push({ path, message: `${path} repeats a name (got ${JSON.stringify(l)})` });
    } else {
      value.ladder = names.map((n) => n.trim());
      given.push(path);
    }
  });

  // 2. Optional `main` session setting ({ model, effort }).
  sources.forEach(({ raw, prefix }) => {
    if (raw.main === undefined) return;
    const path = `${prefix}.main`;
    if (!isMapValue(raw.main)) {
      errors.push({ path, message: `${path} must be a map with model and/or effort` });
      return;
    }
    if (!value.main) value.main = { model: null, effort: null };
    Object.keys(raw.main).forEach((k) => {
      if (!['model', 'effort'].includes(k)) {
        errors.push({ path: `${path}.${k}`, message: `unknown setting "${path}.${k}"; main has model and effort` });
        return;
      }
      const v = raw.main[k];
      if (k === 'model') {
        if (typeof v !== 'string' || v.trim() === '') {
          errors.push({ path: `${path}.model`, message: `${path}.model must be a non-empty model name or alias (got ${JSON.stringify(v)})` });
          return;
        }
        if (v.trim() === AUTO) {
          errors.push({ path: `${path}.model`, message: `${path}.model cannot be "${AUTO}"; set a model name` });
          return;
        }
        value.main.model = v.trim();
      } else {
        if (!EFFORTS.includes(v)) {
          errors.push({ path: `${path}.effort`, message: `${path}.effort has invalid value ${JSON.stringify(v)}; allowed values: ${describeAllowed(EFFORTS)}` });
          return;
        }
        value.main.effort = v;
      }
      given.push(`${path}.${k}`);
    });
  });

  // 3. Subagent roles (`dev` and `qa.<lens>`), merging top-level then tool-scoped entries so overrides replace cleanly.
  const ladder = value.ladder;
  const ladderPath = rawScoped?.ladder !== undefined ? `${scopedPrefix}.ladder` : 'agents.ladder';
  const applyRole = (roleKey, entries, target) => {
    const defaultModel = target.model;
    const range = {};
    let hadAuto = false;
    let lastPath = `agents.${roleKey}`;
    entries.forEach(({ prefix, entry }) => {
      const path = `${prefix}.${roleKey}`;
      lastPath = path;
      if (!isMapValue(entry)) { errors.push({ path, message: `${path} must be a map with model and/or effort` }); return; }
      Object.keys(entry).forEach((k) => {
        if (!['model', 'effort', 'floor', 'ceiling'].includes(k)) { errors.push({ path: `${path}.${k}`, message: `unknown setting "${path}.${k}"; a role has model, effort, floor and ceiling` }); return; }
        const v = entry[k];
        if (k === 'model') {
          if (typeof v !== 'string' || v.trim() === '') { errors.push({ path: `${path}.model`, message: `${path}.model must be a non-empty model name or alias (got ${JSON.stringify(v)})` }); return; }
          target.model = v.trim();
          hadAuto = target.model === AUTO;
        } else if (k === 'effort') {
          if (!EFFORTS.includes(v)) { errors.push({ path: `${path}.effort`, message: `${path}.effort has invalid value ${JSON.stringify(v)}; allowed values: ${describeAllowed(EFFORTS)}` }); return; }
          target.effort = v;
        } else {
          if (typeof v !== 'string' || !ladder.includes(v.trim())) { errors.push({ path: `${path}.${k}`, message: `${path}.${k} must be a name in ${ladderPath} (${ladder.join(', ')}) (got ${JSON.stringify(v)})` }); return; }
          range[k] = v.trim();
        }
        given.push(`${path}.${k}`);
      });
    });
    if (entries.length === 0) return;
    // On auto the range is the floor and the ceiling; by default the ceiling is the default model of the role and the floor the
    // name one step below it, so auto costs no more than the defaults unless the repository raises the ceiling.
    if (target.model === AUTO && hadAuto) {
      const ceiling = range.ceiling ?? defaultModel;
      if (!ladder.includes(ceiling)) { errors.push({ path: `${lastPath}.ceiling`, message: `${lastPath} is auto and the default model "${defaultModel}" of the role is not in ${ladderPath} (${ladder.join(', ')}): set ${lastPath}.ceiling` }); return; }
      const below = ladder.indexOf(ceiling) > 0 ? ladder[ladder.indexOf(ceiling) - 1] : ceiling;
      // A QA lens is not taken below the tool's QA minimum model by default (`sonnet` for Claude, `inherit` for Antigravity).
      const lensFloor = roleKey.startsWith('qa.') && ladder.includes(qaMinModel)
        ? ladder[Math.min(Math.max(ladder.indexOf(below), ladder.indexOf(qaMinModel)), ladder.indexOf(ceiling))]
        : below;
      const floor = range.floor ?? lensFloor;
      if (ladder.indexOf(floor) > ladder.indexOf(ceiling)) { errors.push({ path: `${lastPath}.floor`, message: `${lastPath}.floor "${floor}" is above ${lastPath}.ceiling "${ceiling}" in ${ladderPath} (${ladder.join(', ')})` }); return; }
      target.floor = floor;
      target.ceiling = ceiling;
    } else {
      if (range.floor && range.ceiling && ladder.indexOf(range.floor) > ladder.indexOf(range.ceiling)) { errors.push({ path: `${lastPath}.floor`, message: `${lastPath}.floor "${range.floor}" is above ${lastPath}.ceiling "${range.ceiling}" in ${ladderPath} (${ladder.join(', ')})` }); return; }
      Object.assign(target, range);
    }
  };

  const devEntries = sources.filter(({ raw }) => raw.dev !== undefined).map(({ raw, prefix }) => ({ prefix, entry: raw.dev }));
  applyRole('dev', devEntries, value.dev);

  const qaByLens = new Map(QA_LENSES.map((l) => [l, []]));
  sources.forEach(({ raw, prefix }) => {
    if (raw.qa === undefined) return;
    const qaPath = `${prefix}.qa`;
    if (!isMapValue(raw.qa)) {
      errors.push({ path: qaPath, message: `${qaPath} must be a map with a lens: ${QA_LENSES.join(', ')}` });
      return;
    }
    Object.keys(raw.qa).forEach((lens) => {
      // There is no key that turns a lens off or lowers what it blocks: an unknown name fails here.
      if (!QA_LENSES.includes(lens)) {
        errors.push({ path: `${qaPath}.${lens}`, message: `unknown lens "${lens}" in ${qaPath}; the lenses are ${QA_LENSES.join(', ')}, and none can be turned off or weakened (write exceptions in the project rules file)` });
      } else {
        qaByLens.get(lens).push({ prefix, entry: raw.qa[lens] });
      }
    });
  });
  QA_LENSES.forEach((lens) => applyRole(`qa.${lens}`, qaByLens.get(lens), value.qa[lens]));

  return { value, errors, given };
}

/**
 * Validate `agents` (top-level fallback plus optional `agents.claude` and `agents.antigravity` blocks) and return
 * `{ value, errors, given, byTool, givenByTool }`, where `value` and `given` are for `activeBuild`.
 */
function agentSettings(user, depth = 'standard', activeBuild = 'claude') {
  const errors = [];
  const raw = user.agents;
  if (raw === undefined || raw === null) {
    const byTool = { claude: agentDefaults(depth, 'claude'), antigravity: agentDefaults(depth, 'antigravity') };
    const givenByTool = { claude: [], antigravity: [] };
    return { value: byTool[activeBuild], errors, given: givenByTool[activeBuild], byTool, givenByTool };
  }
  if (!isMapValue(raw)) {
    const byTool = { claude: agentDefaults(depth, 'claude'), antigravity: agentDefaults(depth, 'antigravity') };
    const givenByTool = { claude: [], antigravity: [] };
    return { value: byTool[activeBuild], errors: [{ path: 'agents', message: 'agents must be a map with main, dev, qa, ladder, claude or antigravity' }], given: [], byTool, givenByTool };
  }
  Object.keys(raw).forEach((k) => {
    if (!['main', 'dev', 'qa', 'ladder', ...AGENT_TOOLS].includes(k)) {
      errors.push({ path: `agents.${k}`, message: `unknown setting "agents.${k}"; the roles are main, dev and qa, agents.ladder is the order of the models, and agents.claude / agents.antigravity scope settings per tool` });
    }
  });
  const scoped = {};
  AGENT_TOOLS.forEach((tool) => {
    if (raw[tool] === undefined || raw[tool] === null) return;
    if (!isMapValue(raw[tool])) {
      errors.push({ path: `agents.${tool}`, message: `agents.${tool} must be a map with main, dev, qa and/or ladder` });
      return;
    }
    scoped[tool] = raw[tool];
  });

  const byTool = {};
  const givenByTool = {};
  AGENT_TOOLS.forEach((tool) => {
    // Top-level `agents.*` acts as fallback for the active tool (preserving existing single-tool files). For the inactive
    // tool, only its explicit `agents.<tool>` block is layered over that tool's defaults so Claude top-level settings never
    // leak into Antigravity defaults or fail against Antigravity's ladder.
    const res = resolveToolAgents({
      rawTop: tool === activeBuild ? raw : null,
      rawScoped: scoped[tool] ?? null,
      tool,
      depth,
    });
    byTool[tool] = res.value;
    givenByTool[tool] = res.given;
    errors.push(...res.errors);
  });

  return { value: byTool[activeBuild], errors, given: givenByTool[activeBuild], byTool, givenByTool };
}

/**
 * The effective agent settings for `tool` (`claude` or `antigravity`), falling back to `config.agents` or tool defaults
 * when a caller passes a partial/synthetic config object.
 */
export function agentsFor(config, tool = null) {
  const target = tool ?? config?.agent?.build ?? 'claude';
  if (config?.agents_by_tool?.[target]) return config.agents_by_tool[target];
  if (target === (config?.agent?.build ?? 'claude') && config?.agents) return config.agents;
  return agentDefaults(config?.depth ?? 'standard', target);
}

/** The list of explicitly configured paths under `agents` for `tool`. */
export function agentsGivenFor(config, tool = null) {
  const target = tool ?? config?.agent?.build ?? 'claude';
  if (config?.agents_given_by_tool?.[target]) return config.agents_given_by_tool[target];
  if (target === (config?.agent?.build ?? 'claude')) return config?.agents_given ?? [];
  return [];
}

/**
 * Targeted Antigravity diagnostics for explicitly set `agents.*` fields:
 * - `unapplied`: paths Antigravity cannot enforce (subagent `effort`, non-tier subagent `model`/`floor`/`ceiling`, or non-tier `ladder` names)
 * - `conflicts`: `agents.main` where `model` carries an effort suffix that disagrees with `effort` (`--effort` will be omitted)
 */
export function antigravityAgentDiagnostics(config) {
  const agy = agentsFor(config, 'antigravity');
  const given = agentsGivenFor(config, 'antigravity');
  const unapplied = [];
  const conflicts = [];
  const seen = new Set();
  const addUnapplied = (path, reason) => {
    if (seen.has(path)) return;
    seen.add(path);
    unapplied.push({ path, reason });
  };
  const roleOf = (path) => {
    const clean = path.replace(/^agents\.(?:antigravity\.)?/, '');
    if (clean.startsWith('dev.')) return { role: agy?.dev, field: clean.slice(4), isSubagent: true };
    const m = /^qa\.([^.]+)\.(.+)$/.exec(clean);
    if (m) return { role: agy?.qa?.[m[1]], field: m[2], isSubagent: true };
    return { role: null, field: clean, isSubagent: false };
  };
  given.forEach((path) => {
    const clean = path.replace(/^agents\.(?:antigravity\.)?/, '');
    if (clean === 'ladder') {
      const bad = (agy?.ladder ?? []).filter((n) => !ANTIGRAVITY_SUBAGENT_TIERS.includes(n));
      if (bad.length > 0) addUnapplied(path, `non-tier model name${bad.length === 1 ? '' : 's'} (${bad.join(', ')})`);
      return;
    }
    const { role, field, isSubagent } = roleOf(path);
    if (!isSubagent) return;
    if (field === 'effort') {
      addUnapplied(path, 'invoke_subagent does not accept per-subagent effort');
      return;
    }
    if (field === 'model' || field === 'floor' || field === 'ceiling') {
      const v = role?.[field];
      const allowed = field === 'model' ? [...ANTIGRAVITY_SUBAGENT_TIERS, AUTO] : ANTIGRAVITY_SUBAGENT_TIERS;
      if (v !== undefined && v !== null && !allowed.includes(v)) {
        addUnapplied(path, `"${v}" is not a native invoke_subagent tier (${ANTIGRAVITY_SUBAGENT_TIERS.join(', ')})`);
      }
    }
  });
  const mainModel = agy?.main?.model;
  const mainEffort = agy?.main?.effort;
  const suffix = extractEffortSuffix(mainModel);
  if (suffix && mainEffort && suffix !== mainEffort) {
    const mainPath = given.find((p) => /\.main\.effort$/.test(p)) ?? given.find((p) => /\.main\.model$/.test(p)) ?? 'agents.main';
    conflicts.push({
      path: mainPath,
      model: mainModel,
      suffix,
      effort: mainEffort,
      message: `${mainPath}: model "${mainModel}" already has effort suffix "-${suffix}", which conflicts with effort "${mainEffort}"; --effort will be omitted to avoid an agy CLI conflict`,
    });
  }
  return { unapplied, conflicts };
}
const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const LANGUAGE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
const GITHUB_LABEL_MAX = 50;

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cursor = obj;
  keys.slice(0, -1).forEach((key) => {
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function describeAllowed(allowed) {
  return allowed.map((v) => `"${v}"`).join(', ');
}

function checkType(setting, value, errors) {
  const { path } = setting;
  switch (setting.type) {
    case 'string':
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({ path, message: `${path} must be a non-empty string (got ${JSON.stringify(value)})` });
      }
      break;
    case 'string[]':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a list of non-empty strings (got ${JSON.stringify(value)})` });
      }
      break;
    case 'label-list':
      if (!Array.isArray(value)) {
        errors.push({ path, message: `${path} must be a list of runner labels, for example [self-hosted, linux-build] (got ${JSON.stringify(value)})` });
      } else if (value.length === 0) {
        errors.push({ path, message: `${path} needs at least one label; leave the setting out to use ubuntu-latest` });
      } else if (value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a list of non-empty strings (got ${JSON.stringify(value)})` });
      }
      break;
    case 'path-list':
      if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a file name or a list of file names (got ${JSON.stringify(value)})` });
      }
      break;
    case 'repo-path-list': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a list of paths inside the repository (got ${JSON.stringify(value)})` });
        break;
      }
      value.forEach((entry) => {
        const clean = entry.replace(/^\.\//, '').replace(/\/+$/, '');
        if (entry.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry) || clean.split('/').includes('..') || entry.startsWith('~')) {
          errors.push({ path, message: `${path}: "${entry}" leaves the repository; write a path inside it` });
        } else if (restrictedRule(clean) !== null) {
          errors.push({ path, message: `${path}: "${entry}" is a restricted file, which no agent or script reads` });
        } else if (hardRule(clean) !== null || hardRule(`${clean}/`) !== null) {
          errors.push({ path, message: `${path}: "${entry}" is a protected path (${hardRule(clean) ?? hardRule(`${clean}/`)}), which an unattended run never reads as part of a design system` });
        }
      });
      break;
    }
    case 'glob-list': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a list of paths or globs relative to the repository (got ${JSON.stringify(value)})` });
        break;
      }
      value.forEach((entry) => {
        if (entry.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry) || entry.startsWith('~') || entry.replace(/^\.\//, '').split('/').includes('..')) {
          errors.push({ path, message: `${path}: "${entry}" leaves the repository; write a path or glob inside it` });
        }
      });
      break;
    }
    case 'restricted-list':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a list of paths or globs relative to the repository (got ${JSON.stringify(value)})` });
        break;
      }
      invalidRestrictedEntries(value).forEach(({ entry, reason }) => errors.push({ path, message: `${path}: "${entry}" is not accepted: ${reason}` }));
      break;
    case 'repo-list': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        errors.push({ path, message: `${path} must be a list of repositories written owner/repo (got ${JSON.stringify(value)})` });
        break;
      }
      value.filter((v) => !REPO_RE.test(v)).forEach((v) => errors.push({ path, message: `${path}: "${v}" is not a repository; the form is owner/repo` }));
      value.filter((v, i) => value.indexOf(v) !== i).forEach((v) => errors.push({ path, message: `${path} lists "${v}" more than once` }));
      break;
    }
    case 'origin-list': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        errors.push({ path, message: `${path} must be a list of web origins written like https://staging.example.com (got ${JSON.stringify(value)})` });
        break;
      }
      value.filter((v) => !ORIGIN_RE.test(v)).forEach((v) => errors.push({ path, message: `${path}: "${v}" is not an origin; write the scheme, the host and optionally the port, with no path (https://staging.example.com)` }));
      break;
    }
    case 'enum':
      if (!setting.allowed.includes(value)) {
        errors.push({
          path,
          message: `${path} has invalid value ${JSON.stringify(value)}; allowed values: ${describeAllowed(setting.allowed)}`,
        });
      }
      break;
    case 'bool':
      if (typeof value !== 'boolean') errors.push({ path, message: `${path} must be true or false (got ${JSON.stringify(value)})` });
      break;
    case 'int':
      if (!Number.isInteger(value) || value < setting.min) {
        errors.push({ path, message: `${path} must be an integer >= ${setting.min} (got ${JSON.stringify(value)})` });
      }
      break;
    case 'number':
      if (typeof value !== 'number' || !(value > setting.exclusiveMin)) {
        errors.push({ path, message: `${path} must be a number > ${setting.exclusiveMin} (got ${JSON.stringify(value)})` });
      }
      break;
    default:
      break;
  }
}

function collectStrings(value, path, out) {
  if (typeof value === 'string') out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => collectStrings(v, path ? `${path}.${k}` : k, out));
  }
}

/**
 * Validate a parsed configuration object.
 * Returns { ok, errors, warnings, config } where config has defaults applied.
 */
export function validateConfig(raw, { knownTargets = null, knownChecks = null } = {}) {
  const errors = [];
  const warnings = [];
  const user = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ path: '', message: 'relevo.yml must be a map of settings' });
  }

  // Unknown top-level keys and unknown keys inside groups (catches typos).
  Object.keys(user).forEach((key) => {
    if (!KNOWN_TOP.has(key)) errors.push({ path: key, message: `unknown setting "${key}"` });
  });
  GROUPS.forEach((group) => {
    const value = user[group];
    if (value === undefined || value === null) return;
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push({ path: group, message: `${group} must be a map` });
      return;
    }
    const known = new Set(SETTINGS.filter((s) => s.path.startsWith(`${group}.`)).map((s) => s.path.split('.')[1]));
    Object.keys(value).forEach((k) => {
      if (known.has(k)) return;
      // Relevo cannot verify what a runner is, so it offers no such key: a runner is assumed to persist.
      const message = `${group}.${k}` === 'runner.ephemeral'
        ? 'unknown setting "runner.ephemeral": Relevo does not ask whether a runner is ephemeral, it assumes every runner persists between jobs'
        : `unknown setting "${group}.${k}"`;
      errors.push({ path: `${group}.${k}`, message });
    });
  });

  if (user.design && typeof user.design === 'object' && user.design.system !== undefined) {
    const system = user.design.system;
    if (system === null || typeof system !== 'object' || Array.isArray(system)) errors.push({ path: 'design.system', message: 'design.system must be a map' });
    else Object.keys(system).filter((k) => !['tokens', 'components', 'references'].includes(k)).forEach((k) => errors.push({ path: `design.system.${k}`, message: `unknown setting "design.system.${k}"` }));
  }

  // Per-setting checks and defaults.
  const config = {};
  // Which agent builds in the cloud decides which spending limit applies: it is read before the settings are checked.
  const asked = getPath(user, 'agent.build');
  const build = ['claude', 'antigravity'].includes(asked) ? asked : 'claude';
  SETTINGS.forEach((setting) => {
    const value = getPath(user, setting.path);
    if (value === undefined || value === null) {
      if (setting.requiredFor ? setting.requiredFor === build : setting.required) {
        errors.push({ path: setting.path, message: `${setting.path} is required: ${setting.missing ?? 'it has no default'}` });
        return;
      }
      setPath(config, setting.path, structuredClone(setting.default));
      return;
    }
    if (setting.rejectedFor === build) {
      errors.push({ path: setting.path, message: `${setting.path} has no effect with agent.build "${build}": ${setting.rejection}` });
      return;
    }
    // A single file name is the same as a list of one.
    const given = setting.type === 'path-list' && typeof value === 'string' ? [value] : value;
    checkType(setting, given, errors);
    setPath(config, setting.path, given);
  });

  // The tracker and the provider go together: files issues are delivered by a local merge, never by a pull request.
  const localPair = { github: 'github', files: 'local' };
  if (localPair[config.tracker] !== config.git_provider
    && ['tracker', 'git_provider'].every((k) => ['github', 'files', 'local'].includes(getPath(config, k)))) {
    errors.push({ path: 'git_provider', message: `tracker "${config.tracker}" goes with git_provider "${localPair[config.tracker]}", not "${config.git_provider}": a files project has no pull requests and a github project has no local delivery` });
  }
  // A files project is one person: no reviewer, and the settings of a team are ignored (a warning, so the tracker can change without editing the file).
  if (config.tracker === 'files') {
    const reviewMode = getPath(user, 'review.mode');
    if (reviewMode === undefined || reviewMode === null) config.review.mode = 'none';
    else if (reviewMode !== 'none') errors.push({ path: 'review.mode', message: `review.mode "${reviewMode}" needs a reviewer, and a files project has one person: use "none"` });
    const ignored = ['team.members', 'team.spec_writer', 'team.approvers', 'limits.built_unreviewed_per_person', 'runner.labels', 'runner.build_labels']
      .filter((p) => getPath(user, p) !== undefined && getPath(user, p) !== null);
    const agentsGiven = getPath(user, 'limits.concurrent_agents');
    if (agentsGiven !== undefined && agentsGiven !== null && agentsGiven > 1) ignored.push('limits.concurrent_agents');
    ignored.forEach((p) => warnings.push({ path: p, message: `${p} is ignored with tracker "files": it describes a team, a queue or a runner, and a files project has one person building on this machine` }));
  }

  // Generated files need the command that regenerates them.
  if (config.integration.generated.length > 0 && !config.integration.regenerate) {
    errors.push({ path: 'integration.regenerate', message: 'integration.regenerate is required when integration.generated lists files: it is the command that regenerates them' });
  }

  // The model and the effort of each agent, with tool-scoped defaults. With Antigravity, `agents.main` and native
  // `invoke_subagent` tiers are applied; only unapplied fields and effort-suffix conflicts produce warnings.
  const agents = agentSettings(user, ['prototype', 'standard'].includes(config.depth) ? config.depth : 'standard', build);
  agents.errors.forEach((e) => errors.push(e));
  config.agents = agents.value;
  // Kept out of the enumerable settings: which keys the file set and per-tool resolutions for doctor, init, model-plan and go-local.
  Object.defineProperty(config, 'agents_given', { value: agents.given, enumerable: false, writable: true, configurable: true });
  Object.defineProperty(config, 'agents_by_tool', { value: agents.byTool, enumerable: false, writable: true, configurable: true });
  Object.defineProperty(config, 'agents_given_by_tool', { value: agents.givenByTool, enumerable: false, writable: true, configurable: true });
  if (build === 'antigravity') {
    const diag = antigravityAgentDiagnostics(config);
    if (diag.unapplied.length > 0) {
      const paths = diag.unapplied.map((u) => u.path);
      warnings.push({ path: 'agents', message: `${paths.join(', ')} ${paths.length === 1 ? 'is' : 'are'} not applied with this agent: Antigravity applies agents.main and native invoke_subagent tiers (${ANTIGRAVITY_SUBAGENT_TIERS.join(', ')}), not per-subagent effort or custom subagent model IDs` });
    }
    diag.conflicts.forEach((c) => warnings.push({ path: c.path, message: c.message }));
  }

  // Platforms: the registry, or the legacy shortcut turned into one entry.
  const normalized = normalizePlatforms({ platform: user.platform, platforms: user.platforms }, { knownTargets });
  errors.push(...normalized.errors);
  config.platforms = normalized.platforms;
  if (knownChecks) {
    Object.entries(config.platforms).forEach(([name, entry]) => {
      const valid = knownChecks(entry.stack);
      if (!valid) return;
      Object.keys(entry.checks ?? {}).filter((c) => !valid.includes(c)).forEach((c) => {
        errors.push({ path: `platforms.${name}.checks.${c}`, message: `platforms.${name}.checks has unknown command "${c}"; the stack "${entry.stack}" defines: ${valid.join(', ')}` });
      });
    });
  }

  // Labels: renameable, unique, within GitHub's length limit.
  const labels = user.labels;
  config.labels = {};
  if (labels !== undefined && labels !== null) {
    if (typeof labels !== 'object' || Array.isArray(labels)) {
      errors.push({ path: 'labels', message: 'labels must be a map of label key to label name' });
    } else {
      Object.entries(labels).forEach(([key, name]) => {
        if (key === 'qa-failed') {
          errors.push({ path: `labels.${key}`, message: `the label key "qa-failed" is now "build-failed"; rename it under labels` });
        } else if (!LABEL_KEYS.includes(key)) {
          errors.push({ path: `labels.${key}`, message: `unknown label key "${key}"; allowed keys: ${describeAllowed(LABEL_KEYS)}` });
        } else if (typeof name !== 'string' || name.trim() === '' || name.length > GITHUB_LABEL_MAX) {
          errors.push({ path: `labels.${key}`, message: `labels.${key} must be a non-empty string of at most ${GITHUB_LABEL_MAX} characters` });
        } else {
          config.labels[key] = name;
        }
      });
      const names = Object.values(config.labels);
      if (new Set(names).size !== names.length) {
        errors.push({ path: 'labels', message: 'label names must be unique' });
      }
    }
  }

  // Language: any language tag; only some have message catalogs.
  const lang = config.language;
  if (typeof lang === 'string') {
    if (!LANGUAGE_RE.test(lang)) {
      errors.push({ path: 'language', message: `language must look like "en" or "pt-BR" (got ${JSON.stringify(lang)})` });
    } else if (!SUPPORTED_LANGUAGES.includes(lang.split('-')[0])) {
      warnings.push({
        path: 'language',
        message: `no message catalog for "${lang}"; messages fall back to "en" (available: ${SUPPORTED_LANGUAGES.join(', ')})`,
      });
    }
  }

  // Cross-setting rules.
  if (config.review.mode === 'roles' && config.team.approvers.length === 0) {
    errors.push({ path: 'team.approvers', message: 'team.approvers must list at least one person when review.mode is "roles"' });
  }
  if (config.trust === 'public' && config.agent.build === 'antigravity') {
    errors.push({ path: 'trust', message: 'trust "public" cannot be used with agent.build "antigravity" yet: its allow list is a prefix list and its run has no tool-level limits (docs/security.md)' });
  }
  if (config.trust === 'public' && config.run.full_output) {
    errors.push({ path: 'run.full_output', message: 'run.full_output cannot be used with trust "public": the output of the agent may hold secrets that the redactor does not know, and the artifacts of a public repository are readable by anyone (docs/security.md)' });
  }
  if (config.trust === 'public' && config.review.mode === 'none') {
    errors.push({ path: 'review.mode', message: 'trust "public" needs a human review of generated code: review.mode cannot be "none"' });
  }
  if (config.review.mode === 'peer' || config.review.mode === 'roles') {
    const eligible = config.team.members.filter((m) => m !== config.team.spec_writer);
    if (eligible.length < 2) {
      warnings.push({
        path: 'team.members',
        message: 'review.mode needs a second person to review: team.members should list at least 2 people besides the spec writer',
      });
    }
  }

  // Credentials must never live in this file (checked on every value and key).
  const strings = [];
  collectStrings(user, '', strings);
  strings.forEach(({ path, value }) => {
    if (findCredentials(value, { strict: true }).length > 0) {
      errors.push({
        path,
        message: `${path || 'value'} looks like a credential; move it to the repository secret store, never to relevo.yml`,
      });
    }
  });
  const flatKeys = [];
  (function walk(obj, prefix) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.entries(obj).forEach(([k, v]) => {
      flatKeys.push({ key: k, path: prefix ? `${prefix}.${k}` : k });
      walk(v, prefix ? `${prefix}.${k}` : k);
    });
  }(user, ''));
  flatKeys.forEach(({ key, path }) => {
    // A setting of this file whose name only contains the word (limits.run_max_tokens) is not a credential.
    if (/(api[_-]?key|secret|password|token)/i.test(key) && !SETTINGS.some((s) => s.path === path)) {
      errors.push({
        path,
        message: `${path} looks like a credential setting; move it to the repository secret store, never to relevo.yml`,
      });
    }
  });

  return { ok: errors.length === 0, errors, warnings, config };
}

/** The runner labels of the build job of `go` and of every other job: `build` is runner.build_labels when set, else runner.labels. */
export function effectiveRunners(config) {
  const other = [...config.runner.labels];
  return { build: config.runner.build_labels ? [...config.runner.build_labels] : [...other], other };
}

/** Parse relevo.yml text and validate it. Parse errors are returned as errors. */
export function loadConfig(text, options = {}) {
  let raw;
  try {
    raw = parse(text);
  } catch (err) {
    if (err instanceof YamlLiteError) {
      return { ok: false, errors: [{ path: '', message: `relevo.yml is not valid: ${err.message}` }], warnings: [], config: null };
    }
    throw err;
  }
  return validateConfig(raw, options);
}

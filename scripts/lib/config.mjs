// Schema, defaults and validation for relevo.yml.
// Implements openspec/specs/configuration/spec.md.

import { parse, YamlLiteError } from './yaml-lite.mjs';
import { LABEL_KEYS } from './labels.mjs';
import { SUPPORTED_LANGUAGES } from './messages.mjs';
import { findCredentials } from './scan.mjs';
import { normalizePlatforms } from './platforms.mjs';

// One entry per supported setting. `required: true` means there is no default.
export const SETTINGS = [
  { path: 'branches.base', type: 'string', default: 'dev' },
  { path: 'branches.release', type: 'string', default: 'main' },
  { path: 'tracker', type: 'enum', allowed: ['github'], default: 'github' },
  { path: 'git_provider', type: 'enum', allowed: ['github'], default: 'github' },
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
  { path: 'limits.building_alert_hours', type: 'int', min: 1, default: 3 },
  // The cost limit is the one a Claude run can enforce; an Antigravity run has none, so it takes a token limit instead.
  { path: 'limits.run_max_cost', type: 'number', exclusiveMin: 0, required: true, default: null, requiredFor: 'claude', missing: 'unattended runs must always have a cost limit (amount in US dollars per run)', rejectedFor: 'antigravity', rejection: 'the agent has no cost limit; set limits.run_max_tokens instead, and note that the quota of the Google Cloud project that owns the key is the ceiling that really holds' },
  { path: 'limits.run_max_tokens', type: 'int', min: 1000, default: null, required: true, requiredFor: 'antigravity', missing: 'unattended runs must always have a limit, and for this agent it is a number of tokens per run', rejectedFor: 'claude', rejection: 'the run is limited by limits.run_max_cost' },
  { path: 'agent.build', type: 'enum', allowed: ['claude', 'antigravity'], default: 'claude' },
  { path: 'qa.retries', type: 'int', min: 0, default: 1 },
  { path: 'qa.rules_from', type: 'path-list', default: [] },
  { path: 'skills.allow_scripts', type: 'string[]', default: [] },
  { path: 'links', type: 'repo-list', default: [] },
  { path: 'evidence.policy', type: 'enum', allowed: ['attach_to_pr', 'local_only'], default: 'attach_to_pr' },
  { path: 'digest.issue', type: 'int', min: 1, default: null },
  { path: 'language', type: 'string', default: 'en' },
  { path: 'design.images', type: 'bool', default: false },
  { path: 'trust', type: 'enum', allowed: ['private-team', 'public'], default: 'private-team' },
];

const GROUPS = new Set(SETTINGS.filter((s) => s.path.includes('.')).map((s) => s.path.split('.')[0]));
const TOP_SCALARS = new Set(SETTINGS.filter((s) => !s.path.includes('.')).map((s) => s.path));
const KNOWN_TOP = new Set([...GROUPS, ...TOP_SCALARS, 'labels', 'platform', 'platforms']);
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
    case 'path-list':
      if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
        errors.push({ path, message: `${path} must be a file name or a list of file names (got ${JSON.stringify(value)})` });
      }
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
      if (!known.has(k)) errors.push({ path: `${group}.${k}`, message: `unknown setting "${group}.${k}"` });
    });
  });

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
        if (!LABEL_KEYS.includes(key)) {
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

// Stack profiles. Implements the "platforms" specification: a profile is a Markdown file whose header scripts read
// and whose body the agents read; the repository can add to the plugin's profile but never weaken it.
//
// The filesystem is injected (`read(path) -> text | null`) so the logic is tested without a repository.

import { parse, YamlLiteError } from './yaml-lite.mjs';

export const ROLES = ['dev', 'qa', 'issue', 'review'];
const HEADER_KEYS = new Set(['stack', 'commands', 'generated', 'tools', 'requires_skills', 'skills', 'targets']);
const STACK_RE = /^[a-z][a-z0-9-]*$/;

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '');
const unique = (list) => [...new Set(list)];

const emptyProfile = (stack) => ({
  stack,
  commands: {},
  generated: [],
  tools: [],
  requires_skills: [],
  skills: Object.fromEntries(ROLES.map((r) => [r, []])),
  targets: {},
  body: '',
});

/**
 * Read the text of a profile file. Returns { profile, errors }.
 * The header is the block between the first two `---` lines; the body is the rest.
 */
export function parseProfile(text) {
  const errors = [];
  const match = String(text ?? '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/);
  if (!match) return { profile: null, errors: ['the profile must start with a header between two "---" lines'] };
  let raw;
  try {
    raw = parse(match[1]);
  } catch (err) {
    if (err instanceof YamlLiteError) return { profile: null, errors: [`the profile header is not valid: ${err.message}`] };
    throw err;
  }
  if (!isMap(raw)) return { profile: null, errors: ['the profile header must be a map'] };

  Object.keys(raw).filter((k) => !HEADER_KEYS.has(k)).forEach((k) => errors.push(`unknown header key "${k}"; allowed: ${[...HEADER_KEYS].join(', ')}`));
  if (typeof raw.stack !== 'string' || !STACK_RE.test(raw.stack)) errors.push('the header needs "stack" with the name of the stack');

  const profile = emptyProfile(raw.stack);
  if (raw.commands !== undefined) {
    if (!isMap(raw.commands) || Object.values(raw.commands).some((v) => typeof v !== 'string' || v.trim() === '')) errors.push('"commands" must map a name to a command');
    else profile.commands = { ...raw.commands };
  }
  ['generated', 'tools', 'requires_skills'].forEach((key) => {
    if (raw[key] === undefined) return;
    if (!isStringList(raw[key])) errors.push(`"${key}" must be a list of names`);
    else profile[key] = unique(raw[key]);
  });
  if (raw.skills !== undefined) {
    if (!isMap(raw.skills)) errors.push('"skills" must map a role to a list of skill names');
    else {
      Object.entries(raw.skills).forEach(([role, list]) => {
        if (!ROLES.includes(role)) errors.push(`"skills" has unknown role "${role}"; allowed: ${ROLES.join(', ')}`);
        else if (!isStringList(list)) errors.push(`"skills.${role}" must be a list of skill names`);
        else profile.skills[role] = unique(list);
      });
    }
  }
  if (raw.targets !== undefined) {
    if (!isMap(raw.targets) || Object.values(raw.targets).some((v) => typeof v !== 'string')) errors.push('"targets" must map a target to the tool it needs (empty when none)');
    else profile.targets = { ...raw.targets };
  }
  profile.body = (match[2] ?? '').trim();
  return { profile: errors.length ? null : profile, errors };
}

/**
 * Add the repository's profile to the plugin's. Lists are joined, bodies follow each other, and a value the
 * plugin already sets is kept (the difference is reported in `ignored`). With no plugin profile the repository's
 * is the whole profile.
 */
export function mergeProfiles(plugin, repository) {
  if (!plugin && !repository) return null;
  if (!plugin) return { ...repository, layers: ['repository'], ignored: [] };
  if (!repository) return { ...plugin, layers: ['plugin'], ignored: [] };

  const out = structuredClone(plugin);
  const ignored = [];
  ['generated', 'tools', 'requires_skills'].forEach((key) => { out[key] = unique([...plugin[key], ...repository[key]]); });
  ROLES.forEach((role) => { out.skills[role] = unique([...plugin.skills[role], ...repository.skills[role]]); });
  ['commands', 'targets'].forEach((key) => {
    Object.entries(repository[key]).forEach(([name, value]) => {
      if (!(name in plugin[key])) out[key][name] = value;
      else if (plugin[key][name] !== value) ignored.push({ key: `${key}.${name}`, value, kept: plugin[key][name] });
    });
  });
  out.body = [plugin.body, repository.body].filter(Boolean).join('\n\n');
  return { ...out, layers: ['plugin', 'repository'], ignored };
}

/** Apply `platforms.<name>.checks` of relevo.yml: the only way to replace a command. */
export function applyChecks(profile, checks = {}) {
  const out = structuredClone(profile);
  out.commands = { ...profile.commands, ...checks };
  out.overridden = Object.keys(checks);
  return out;
}

export const pluginProfilePath = (pluginRoot, stack) => `${pluginRoot}/stacks/${stack}.md`;
export const repositoryProfilePath = (stack) => `.relevo/stacks/${stack}.md`;

/** Where a profile for `stack` can be defined, for the messages. */
export const profileLocations = (stack) => `stacks/${stack}.md in the plugin or ${repositoryProfilePath(stack)} in the repository`;

function readProfile(read, path) {
  const text = read(path);
  if (text === null || text === undefined) return { profile: null, errors: [] };
  const r = parseProfile(text);
  return { profile: r.profile, errors: r.errors.map((e) => `${path}: ${e}`) };
}

/**
 * Resolve the profile of one platform entry ({ stack, path, targets, checks }).
 * Returns { ok: true, profile } or { ok: false, errors }.
 */
export function resolveProfile({ platform, pluginRoot, read }) {
  const plugin = readProfile(read, pluginProfilePath(pluginRoot, platform.stack));
  const repository = readProfile(read, repositoryProfilePath(platform.stack));
  const errors = [...plugin.errors, ...repository.errors];
  if (errors.length > 0) return { ok: false, errors };
  const merged = mergeProfiles(plugin.profile, repository.profile);
  if (!merged) return { ok: false, errors: [`no profile for stack "${platform.stack}": define one in ${profileLocations(platform.stack)}`] };
  const profile = applyChecks(merged, platform.checks ?? {});
  profile.stack = platform.stack;
  return { ok: true, profile };
}

/**
 * Lookups for the validation of relevo.yml: the targets and the commands a stack defines, or null when no profile
 * can be read (then nothing is checked against it; `doctor` reports the missing profile).
 */
export function profileLookups({ pluginRoot, read }) {
  const of = (stack) => {
    const r = resolveProfile({ platform: { stack }, pluginRoot, read });
    return r.ok ? r.profile : null;
  };
  return {
    knownTargets: (stack) => { const p = of(stack); return p ? Object.keys(p.targets) : null; },
    knownChecks: (stack) => { const p = of(stack); return p ? Object.keys(p.commands) : null; },
  };
}

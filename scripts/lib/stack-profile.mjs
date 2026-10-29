// Stack profiles. Implements the "platforms" specification: a profile is a Markdown file whose header scripts read
// and whose body the agents read; the repository can add to the plugin's profile but never weaken it.
//
// The filesystem is injected (`read(path) -> text | null`) so the logic is tested without a repository.

import { parse, YamlLiteError } from './yaml-lite.mjs';

export const ROLES = ['dev', 'qa', 'issue', 'review'];
const HEADER_KEYS = new Set(['stack', 'commands', 'generated', 'tools', 'requires_skills', 'skills', 'targets', 'review']);
const REVIEW_KEYS = new Set(['log', 'test', 'serve']);
const SERVE_KEYS = new Set(['command', 'url', 'env']);
// A server the agent starts is reached on this machine only.
const LOCAL_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:(\d+|\{port\}))?(\/\S*)?$/;
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
  review: {},
  body: '',
  questions: '',
  reviewBody: '',
});

export const QUESTIONS_HEADING = 'Questions for the issue writer';
export const REVIEW_HEADING = 'Review';

/** Split the section "## <heading>" (up to the next heading of level 2) out of a body. */
function splitSection(text, heading) {
  const lines = String(text).split('\n');
  const start = lines.findIndex((l) => /^##\s+/.test(l) && l.replace(/^##\s+/, '').trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return { body: text, section: '' };
  let end = lines.findIndex((l, i) => i > start && /^##\s+/.test(l));
  if (end === -1) end = lines.length;
  return {
    body: [...lines.slice(0, start), ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    section: lines.slice(start + 1, end).join('\n').trim(),
  };
}

/** Split the section "## Questions for the issue writer" out of a body. */
export function splitQuestions(text) {
  const { body, section } = splitSection(text, QUESTIONS_HEADING);
  return { body, questions: section };
}

/** Split the section "## Review" out of a body: only a review reads it. */
export function splitReview(text) {
  const { body, section } = splitSection(text, REVIEW_HEADING);
  return { body, review: section };
}

// What the text a repository wrote for a review cannot ask for: the rules the review keeps whatever the file says.
const FIXED_RULES = [
  { rule: 'skip the audit', re: /\b(skip|omit|ignore|bypass|disable|salta\w*|omite\w*|omitir)\b[^.\n]{0,40}\b(audit|auditor[ií]a)\b/i },
  { rule: 'mark lines without proof', re: /\b(mark|set|record|marca\w*)\b[^.\n]{0,30}\b(all|every|todas?|cada)\b[^.\n]{0,30}\b(ok|passed|confirmed|confirmad\w+)\b/i },
  { rule: 'skip the confirmation of the person', re: /\b(without|no need|sin)\b[^.\n]{0,40}\b(person|user|persona|usuario)\b[^.\n]{0,25}\b(confirm|confirmation|agree|agreement|confirmaci[oó]n)/i },
  { rule: 'read an environment file', re: /\b(read|cat|open|print|show|lee\w*)\b[^.\n]{0,30}\.env(?!\.example)\b/i },
  { rule: 'suggest a waiver', re: /\b(suggest|propose|offer|recommend|sugier\w*)\b[^.\n]{0,30}\bwaiv\w*/i },
  { rule: 'open the pull request without the agreement', re: /\b(open|create)\b[^.\n]{0,15}\b(pull request|PR)\b[^.\n]{0,20}\b(automatically|directly|without)\b/i },
  { rule: 'patch code in a review', re: /\b(fix|patch|edit|change)\b[^.\n]{0,25}\b(code|source)\b[^.\n]{0,20}\bduring (the )?review\b/i },
];

/** The lines of a text that ask for what a review never changes: [{ rule, line }]. */
export function fixedRuleWarnings(text) {
  const out = [];
  String(text ?? '').split('\n').forEach((line, i) => {
    FIXED_RULES.forEach(({ rule, re }) => {
      const m = re.exec(line);
      // "never read .env" keeps the rule; only a line that asks for the opposite is reported.
      if (m && !/\b(never|not|no|nunca|jam[aá]s)\W+(\w+\W+){0,2}$/i.test(line.slice(0, m.index))) out.push({ rule, line: i + 1, text: line.trim().slice(0, 160) });
    });
  });
  return out;
}

/** Validate the `review` block of a header. Returns { value, errors }. */
function parseReviewBlock(raw) {
  const errors = [];
  if (!isMap(raw)) return { value: {}, errors: ['"review" must be a map'] };
  const value = {};
  Object.keys(raw).filter((k) => !REVIEW_KEYS.has(k)).forEach((k) => errors.push(`unknown key "review.${k}"; allowed: ${[...REVIEW_KEYS].join(', ')}`));
  ['log', 'test'].forEach((key) => {
    if (raw[key] === undefined) return;
    if (typeof raw[key] !== 'string' || raw[key].trim() === '') errors.push(`"review.${key}" must be a non-empty string`);
    else value[key] = raw[key];
  });
  if (raw.serve !== undefined) {
    const serve = raw.serve;
    if (!isMap(serve)) errors.push('"review.serve" must be a map with "command" and "url"');
    else {
      const before = errors.length;
      Object.keys(serve).filter((k) => !SERVE_KEYS.has(k)).forEach((k) => errors.push(`unknown key "review.serve.${k}"; allowed: ${[...SERVE_KEYS].join(', ')}`));
      if (typeof serve.command !== 'string' || serve.command.trim() === '') errors.push('"review.serve" needs a "command"');
      if (typeof serve.url !== 'string' || serve.url.trim() === '') errors.push('"review.serve" needs a "url"');
      else if (!LOCAL_URL_RE.test(serve.url)) errors.push(`"review.serve.url" must be on localhost, 127.0.0.1 or [::1] (got "${serve.url}"); {port} stands for the port the agent chooses`);
      if (serve.env !== undefined && (!isMap(serve.env) || Object.values(serve.env).some((v) => v !== null && typeof v === 'object'))) errors.push('"review.serve.env" must map a variable name to a value');
      if (errors.length === before) value.serve = { command: serve.command, url: serve.url, ...(serve.env ? { env: { ...serve.env } } : {}) };
    }
  }
  return { value, errors };
}

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
  if (raw.review !== undefined) {
    const r = parseReviewBlock(raw.review);
    errors.push(...r.errors);
    profile.review = r.value;
  }
  // The questions for the issue writer and the section Review are kept apart from the body: dev and qa never receive them.
  const noQuestions = splitQuestions((match[2] ?? '').trim());
  const noReview = splitReview(noQuestions.body);
  profile.body = noReview.body;
  profile.questions = noQuestions.questions;
  profile.reviewBody = noReview.review;
  return { profile: errors.length ? null : profile, errors };
}

/**
 * Add the repository's profile to the plugin's. Lists are joined, bodies follow each other, and a value the
 * plugin already sets is kept (the difference is reported in `ignored`). With no plugin profile the repository's
 * is the whole profile.
 */
export function mergeProfiles(plugin, repository) {
  if (!plugin && !repository) return null;
  if (!plugin) return { ...repository, layers: ['repository'], ignored: [], reviewReplaced: [] };
  if (!repository) return { ...plugin, layers: ['plugin'], ignored: [], reviewReplaced: [] };

  const out = structuredClone(plugin);
  const ignored = [];
  // The review block says how the review is driven, not what gates the code, so the repository's keys replace the plugin's.
  const reviewReplaced = [];
  Object.entries(repository.review).forEach(([key, value]) => {
    if (key in plugin.review && JSON.stringify(plugin.review[key]) !== JSON.stringify(value)) reviewReplaced.push(`review.${key}`);
    out.review[key] = value;
  });
  ['generated', 'tools', 'requires_skills'].forEach((key) => { out[key] = unique([...plugin[key], ...repository[key]]); });
  ROLES.forEach((role) => { out.skills[role] = unique([...plugin.skills[role], ...repository.skills[role]]); });
  ['commands', 'targets'].forEach((key) => {
    Object.entries(repository[key]).forEach(([name, value]) => {
      if (!(name in plugin[key])) out[key][name] = value;
      else if (plugin[key][name] !== value) ignored.push({ key: `${key}.${name}`, value, kept: plugin[key][name] });
    });
  });
  out.body = [plugin.body, repository.body].filter(Boolean).join('\n\n');
  out.questions = [plugin.questions, repository.questions].filter(Boolean).join('\n\n');
  out.reviewBody = [plugin.reviewBody, repository.reviewBody].filter(Boolean).join('\n\n');
  return { ...out, layers: ['plugin', 'repository'], ignored, reviewReplaced };
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
  // What the repository's text asked for that the review will not do; the review and doctor report it.
  profile.reviewWarnings = fixedRuleWarnings(repository.profile?.reviewBody);
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

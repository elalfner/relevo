// Stack profiles. Implements the "platforms" specification: a profile is a Markdown file whose header scripts read
// and whose body the agents read; the repository can add to the plugin's profile but never weaken it (it may only
// switch off a skill of the plugin by name, `skills.disable`, and replace a key of the review block).
//
// The filesystem is injected (`read(path) -> text | null`) so the logic is tested without a repository.

import { parse, YamlLiteError } from './yaml-lite.mjs';
import { isRestricted } from './restricted-paths.mjs';
import { isGenericApi } from './review-adapters.mjs';

export const ROLES = ['dev', 'qa', 'issue', 'review'];
const HEADER_KEYS = new Set(['stack', 'commands', 'generated', 'tools', 'installed', 'requires_skills', 'skills', 'skills_when_installed', 'targets', 'review', 'interface']);
// The kind of interface a stack builds, for the interface rules: none when the key is missing.
export const INTERFACE_KINDS = ['mobile', 'web', 'none'];
const REVIEW_KEYS = new Set(['log', 'test', 'serve', 'adapter', 'needs', 'expected_errors']);
// An expected error is a plain substring of a Postgres message the project's own tests provoke on purpose. The characters are
// the ones that are safe in a command line and in a report; the words are the signals the audit never excuses.
export const EXPECTED_ERROR_RE = /^[A-Za-z0-9][A-Za-z0-9 _.:,'/-]{2,99}$/;
const NEVER_EXCUSED = ['fatal', 'panic', 'deadlock detected', 'deadlock', 'out of memory', 'error', 'http', 'response', 'internal server'];
const FIVE_HUNDRED_RE = /\b5\d\d\b/;
/** Why an entry of review.expected_errors is invalid, or null. */
export function expectedErrorProblem(entry) {
  if (typeof entry !== 'string' || !EXPECTED_ERROR_RE.test(entry)) return 'a plain text of 3 to 100 characters (letters, digits, space and _ . : , \' / -), starting with a letter or a digit';
  const low = entry.toLowerCase().trim();
  if (low.length < 3) return 'at least 3 characters';
  if (FIVE_HUNDRED_RE.test(low)) return 'not a server error status (500 or above)';
  if (NEVER_EXCUSED.some((w) => low.includes(w) || (low.length >= 3 && w.includes(low)))) return 'not one of the signals a review never excuses (FATAL, PANIC, deadlock, out of memory, ERROR, an HTTP status of 500 or above)';
  return null;
}
// The only kind of review adapter a repository profile can declare: the others need tools the plugin drives itself.
const DECLARABLE_ADAPTERS = ['api'];
// A name the repository chose for a tool or a Compose service: no path, no space, no shell character.
const TOOL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SERVE_KEYS = new Set(['command', 'url', 'env']);
// A server the agent starts is reached on this machine only.
const LOCAL_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:(\d+|\{port\}))?(\/\S*)?$/;
const STACK_RE = /^[a-z][a-z0-9-]*$/;
// The one key of `skills` that is not a role: names of the plugin's skills that the repository switches off.
const SKILLS_DISABLE = 'disable';

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStringList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '');
const unique = (list) => [...new Set(list)];

const emptyProfile = (stack) => ({
  stack,
  commands: {},
  generated: [],
  tools: [],
  // Paths, relative to the folder of the platform, that exist once the dependencies are installed.
  installed: [],
  requires_skills: [],
  skills: Object.fromEntries(ROLES.map((r) => [r, []])),
  skillsDisable: [],
  skillsWhenInstalled: Object.fromEntries(ROLES.map((r) => [r, []])),
  targets: {},
  interface: 'none',
  review: {},
  securityReview: '',
  body: '',
  questions: '',
  reviewBody: '',
});

export const QUESTIONS_HEADING = 'Questions for the issue writer';
export const SECURITY_REVIEW_HEADING = 'Security review';
export const LENSES = ['spec', 'security', 'code', 'interface'];
// The sections of the body that the `code` lens reads.
export const CODE_LENS_HEADINGS = ['Architecture', 'What the auditor looks for in the diff'];
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

/** Split the section "## Security review" out of a body: only the security lens reads it. */
export function splitSecurityReview(text) {
  const { body, section } = splitSection(text, SECURITY_REVIEW_HEADING);
  return { body, securityReview: section };
}

/** The `## Heading` sections of a body, in order: [{ heading, text }]. */
export function bodySections(body) {
  const out = [];
  let current = null;
  String(body ?? '').split('\n').forEach((line) => {
    const m = /^## (.+?)\s*$/.exec(line);
    if (m) { current = { heading: m[1], lines: [] }; out.push(current); return; }
    if (current) current.lines.push(line);
  });
  return out.map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }));
}

/**
 * The part of a profile one QA lens reads, as text. `spec` and `interface` read no stack section (the first compares the code
 * with the specification, the second gets its rules from the interface knowledge); `code` reads the architecture and what the
 * auditor looks for; `security` reads the section Security review. A stack without a section gives an empty text.
 */
export function lensText(profile, lens) {
  if (!LENSES.includes(lens)) throw new Error(`unknown lens "${lens}"; allowed: ${LENSES.join(', ')}`);
  if (lens === 'security') return profile.securityReview ?? '';
  if (lens === 'code') return bodySections(profile.body).filter((s) => CODE_LENS_HEADINGS.includes(s.heading)).map((s) => `## ${s.heading}\n\n${s.text}`).join('\n\n');
  return '';
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

// The log of a container: `docker:<name>`, where {project_id} stands for the project_id of supabase/config.toml.
const DOCKER_LOG_RE = /^docker:[A-Za-z0-9_.{}-]+$/;
// A review runs its tests against what is local. A test command that names one of these reaches a remote project.
const REMOTE_TEST_RE = /(^|\s)(--linked|--db-url(=\S*)?|link|push|pull)(\s|$)/;
// The log of the services of a Docker Compose project: `compose:` and comma-separated service names, every service when none.
const COMPOSE_LOG_RE = /^compose:([A-Za-z0-9][A-Za-z0-9._-]*(,[A-Za-z0-9][A-Za-z0-9._-]*)*)?$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const ADDRESS_RE = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s/?#'"`]*/g;

/** The `scheme://host` addresses of a command whose host is not spelled out as a local one (a variable, a remote name). */
function nonLocalAddresses(text) {
  return (String(text).match(ADDRESS_RE) ?? []).filter((address) => {
    let authority = address.slice(address.indexOf('://') + 3);
    authority = authority.slice(authority.lastIndexOf('@') + 1);
    const host = authority.startsWith('[') ? authority.slice(0, authority.indexOf(']') + 1) : authority.split(':')[0];
    return !LOCAL_HOSTS.has(host.toLowerCase());
  });
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
    else if (key === 'log' && raw.log.startsWith('docker:') && !DOCKER_LOG_RE.test(raw.log)) errors.push(`"review.log" names a container as docker:<name> (got "${raw.log}"); {project_id} stands for the project_id of supabase/config.toml`);
    else if (key === 'log' && raw.log.startsWith('compose:') && !COMPOSE_LOG_RE.test(raw.log)) errors.push(`"review.log" names the services of a Compose project as compose:<service>,<service> (got "${raw.log}"); a service name has letters, digits, dots, underscores and hyphens, and none means every service`);
    else if (key === 'test' && REMOTE_TEST_RE.test(raw.test)) errors.push(`"review.test" must not target a remote database (got "${raw.test}"): a review runs against the local containers only, without --linked, --db-url, link, push or pull`);
    else value[key] = raw[key];
  });
  if (raw.adapter !== undefined) {
    if (!DECLARABLE_ADAPTERS.includes(raw.adapter)) errors.push(`"review.adapter" must be ${DECLARABLE_ADAPTERS.map((a) => `"${a}"`).join(' or ')}, the only adapter a profile can declare (got "${raw.adapter}"); device and browser reviews stay in the plugin`);
    else value.adapter = raw.adapter;
  }
  if (raw.needs !== undefined) {
    if (!isStringList(raw.needs)) errors.push('"review.needs" must be a list of tool names, such as [nhost, docker]');
    else if (raw.needs.some((n) => !TOOL_NAME_RE.test(n))) errors.push(`"review.needs" lists names of tools, never a path or a command (got ${JSON.stringify(raw.needs)}); a name has letters, digits, dots, underscores and hyphens`);
    else value.needs = unique(raw.needs);
  }
  if (raw.expected_errors !== undefined) {
    const list = raw.expected_errors;
    if (!Array.isArray(list) || list.length === 0) errors.push('"review.expected_errors" must be a list of texts, such as [permiso_denegado, bitacora_inmutable]');
    else {
      const bad = list.map((e) => [e, expectedErrorProblem(e)]).filter(([, why]) => why);
      bad.forEach(([e, why]) => errors.push(`"review.expected_errors" has the entry ${JSON.stringify(e)}: it must be ${why}`));
      if (bad.length === 0) value.expected_errors = unique(list);
    }
  }
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
  ['generated', 'tools', 'installed', 'requires_skills'].forEach((key) => {
    if (raw[key] === undefined) return;
    if (!isStringList(raw[key])) errors.push(`"${key}" must be a list of names`);
    else profile[key] = unique(raw[key]);
  });
  // A profile only adds, and it cannot weaken the list of restricted files: a path it names for the agents to treat or
  // read (generated files, the review log) is never one of them.
  profile.installed.filter((entry) => entry.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entry) || entry.split(/[\\/]/).includes('..')).forEach((entry) => errors.push(`"installed" lists "${entry}", which is not a path inside the folder of the platform`));
  profile.generated.filter((entry) => isRestricted(entry)).forEach((entry) => errors.push(`"generated" lists "${entry}", a restricted file: the base list cannot be reduced by a profile`));
  if (raw.interface !== undefined) {
    if (!INTERFACE_KINDS.includes(raw.interface)) errors.push(`"interface" must be one of: ${INTERFACE_KINDS.join(', ')}`);
    else profile.interface = raw.interface;
  }
  if (raw.skills !== undefined) {
    if (!isMap(raw.skills)) errors.push('"skills" must map a role to a list of skill names');
    else {
      Object.entries(raw.skills).forEach(([role, list]) => {
        if (role === SKILLS_DISABLE) {
          if (!isStringList(list)) errors.push(`"skills.${SKILLS_DISABLE}" must be a list of skill names`);
          else profile.skillsDisable = unique(list);
        } else if (!ROLES.includes(role)) errors.push(`"skills" has unknown role "${role}"; allowed: ${ROLES.join(', ')}, ${SKILLS_DISABLE}`);
        else if (!isStringList(list)) errors.push(`"skills.${role}" must be a list of skill names`);
        else profile.skills[role] = unique(list);
      });
    }
  }
  // Skills that depend on the project: used when their folder is on the base branch, skipped without a trace when not.
  if (raw.skills_when_installed !== undefined) {
    if (!isMap(raw.skills_when_installed)) errors.push('"skills_when_installed" must map a role to a list of skill names');
    else {
      Object.entries(raw.skills_when_installed).forEach(([role, list]) => {
        if (!ROLES.includes(role)) errors.push(`"skills_when_installed" has unknown role "${role}"; allowed: ${ROLES.join(', ')}`);
        else if (!isStringList(list)) errors.push(`"skills_when_installed.${role}" must be a list of skill names`);
        else profile.skillsWhenInstalled[role] = unique(list);
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
    if (r.value.log && !r.value.log.startsWith('docker:') && !r.value.log.startsWith('compose:') && isRestricted(r.value.log)) errors.push(`"review.log" names "${r.value.log}", a restricted file: the base list cannot be reduced by a profile`);
  }
  // The questions for the issue writer and the section Review are kept apart from the body: dev and qa never receive them.
  const noQuestions = splitQuestions((match[2] ?? '').trim());
  const noReview = splitReview(noQuestions.body);
  const noSecurity = splitSecurityReview(noReview.body);
  profile.body = noSecurity.body;
  profile.securityReview = noSecurity.securityReview;
  profile.questions = noQuestions.questions;
  profile.reviewBody = noReview.review;
  return { profile: errors.length ? null : profile, errors };
}

/**
 * Add the repository's profile to the plugin's. Lists are joined, bodies follow each other, and a value the
 * plugin already sets is kept (the difference is reported in `ignored`). `skills.disable` of the repository removes
 * skills of the plugin from every role (`skillsDisabled`); a required skill, or a name no plugin list has, stays and is
 * reported in `skillsDisableIgnored`. `pluginSkills` keeps what the plugin lists, so a skill's origin is known. With no
 * plugin profile the repository's is the whole profile.
 */
export function mergeProfiles(plugin, repository) {
  if (!plugin && !repository) return null;
  const noDisable = { skillsDisabled: [], skillsDisableIgnored: [] };
  if (!plugin) {
    const { skillsDisable, ...rest } = repository;
    return { ...rest, pluginSkills: Object.fromEntries(ROLES.map((r) => [r, []])), pluginSkillsWhenInstalled: Object.fromEntries(ROLES.map((r) => [r, []])), skillsDisabled: [], skillsDisableIgnored: skillsDisable.map((name) => ({ name, reason: 'matches nothing' })), layers: ['repository'], ignored: [], reviewReplaced: [] };
  }
  if (!repository) {
    const { skillsDisable, ...rest } = plugin;
    return { ...rest, pluginSkills: structuredClone(plugin.skills), pluginSkillsWhenInstalled: structuredClone(plugin.skillsWhenInstalled), ...noDisable, layers: ['plugin'], ignored: [], reviewReplaced: [] };
  }

  const out = structuredClone(plugin);
  delete out.skillsDisable;
  const ignored = [];
  // The review block says how the review is driven, not what gates the code, so the repository's keys replace the plugin's.
  const reviewReplaced = [];
  Object.entries(repository.review).forEach(([key, value]) => {
    // The plugin ships the adapter of its stacks: the repository cannot relabel how they are reviewed.
    if (key === 'adapter' || key === 'needs') {
      ignored.push({ key: `review.${key}`, value: Array.isArray(value) ? value.join(', ') : value, kept: 'the review adapter of the plugin for this stack' });
      return;
    }
    if (key in plugin.review && JSON.stringify(plugin.review[key]) !== JSON.stringify(value)) reviewReplaced.push(`review.${key}`);
    out.review[key] = value;
  });
  ['generated', 'tools', 'installed', 'requires_skills'].forEach((key) => { out[key] = unique([...plugin[key], ...repository[key]]); });
  ROLES.forEach((role) => { out.skills[role] = unique([...plugin.skills[role], ...repository.skills[role]]); });
  ROLES.forEach((role) => { out.skillsWhenInstalled[role] = unique([...plugin.skillsWhenInstalled[role], ...repository.skillsWhenInstalled[role]]); });
  // The repository may switch off a skill of the plugin by name, never a required one.
  const pluginNames = new Set(ROLES.flatMap((r) => [...plugin.skills[r], ...plugin.skillsWhenInstalled[r]]));
  const required = new Set(out.requires_skills);
  const skillsDisabled = [];
  const skillsDisableIgnored = [];
  repository.skillsDisable.forEach((name) => {
    if (required.has(name)) skillsDisableIgnored.push({ name, reason: 'required' });
    else if (!pluginNames.has(name)) skillsDisableIgnored.push({ name, reason: 'matches nothing' });
    else skillsDisabled.push(name);
  });
  ROLES.forEach((role) => {
    out.skills[role] = out.skills[role].filter((n) => !skillsDisabled.includes(n));
    out.skillsWhenInstalled[role] = out.skillsWhenInstalled[role].filter((n) => !skillsDisabled.includes(n));
  });
  // What the plugin's profile lists (and the repository did not switch off): the skills it recommends by default.
  const pluginSkills = Object.fromEntries(ROLES.map((r) => [r, plugin.skills[r].filter((n) => !skillsDisabled.includes(n))]));
  const pluginSkillsWhenInstalled = Object.fromEntries(ROLES.map((r) => [r, plugin.skillsWhenInstalled[r].filter((n) => !skillsDisabled.includes(n))]));
  ['commands', 'targets'].forEach((key) => {
    Object.entries(repository[key]).forEach(([name, value]) => {
      if (!(name in plugin[key])) out[key][name] = value;
      else if (plugin[key][name] !== value) ignored.push({ key: `${key}.${name}`, value, kept: plugin[key][name] });
    });
  });
  if (plugin.interface === 'none' && repository.interface !== 'none') out.interface = repository.interface;
  else if (repository.interface !== 'none' && repository.interface !== plugin.interface) ignored.push({ key: 'interface', value: repository.interface, kept: plugin.interface });
  out.body = [plugin.body, repository.body].filter(Boolean).join('\n\n');
  out.questions = [plugin.questions, repository.questions].filter(Boolean).join('\n\n');
  out.reviewBody = [plugin.reviewBody, repository.reviewBody].filter(Boolean).join('\n\n');
  // A repository adds to the security review of the plugin and removes nothing from it.
  out.securityReview = [plugin.securityReview, repository.securityReview].filter(Boolean).join('\n\n');
  return { ...out, pluginSkills, pluginSkillsWhenInstalled, skillsDisabled, skillsDisableIgnored, layers: ['plugin', 'repository'], ignored, reviewReplaced };
}

/** Apply `platforms.<name>.checks` of relevo.yml: the only way to replace a command. */
export function applyChecks(profile, checks = {}) {
  const out = structuredClone(profile);
  out.commands = { ...profile.commands, ...checks };
  out.overridden = Object.keys(checks);
  return out;
}

/**
 * What the repository's profile asked for and the plugin did not accept, as warnings that a person reads without running doctor:
 * one per ignored `commands.<name>`. A command that `platforms.<name>.checks` replaces is left out, since the repository's value is moot.
 * Returns [{ key, command, asked, kept, text }]; `platformName` fills the example of the way out.
 */
export function commandWarnings(profile, platformName = '<name>') {
  const replaced = new Set(profile?.overridden ?? []);
  return (profile?.ignored ?? [])
    .filter((x) => x.key.startsWith('commands.') && !replaced.has(x.key.slice('commands.'.length)))
    .map((x) => {
      const command = x.key.slice('commands.'.length);
      return { key: x.key, command, asked: x.value, kept: x.kept, text: `the repository profile sets ${x.key} to "${x.value}", which is ignored: the plugin keeps "${x.kept}". A profile cannot replace a command; set platforms.${platformName}.checks.${command} in relevo.yml to replace it` };
    });
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

/** What a declared `api` adapter needs of the merged profile: its two commands, no targets, and nothing that is not local. */
function declaredAdapterErrors(merged, stack) {
  // The generic api adapter is declared by the repository's profile or shipped by the plugin (the table says so).
  if (merged.review.adapter !== 'api' && !isGenericApi(stack)) return [];
  const errors = [];
  ['log', 'test'].forEach((key) => {
    if (merged.review[key] === undefined) errors.push(`"review.${key}" is missing: a declared "api" adapter needs "review.log" and "review.test"`);
  });
  if (Object.keys(merged.targets).length > 0) errors.push('"review.adapter" is set on a stack that defines targets: a declared adapter is for a stack with no targets');
  ['test', 'log'].forEach((key) => {
    const text = merged.review[key];
    if (text === undefined) return;
    if (REMOTE_TEST_RE.test(text)) errors.push(`"review.${key}" must not target a remote project (got "${text}"): a declared adapter runs against what is local, without --linked, --db-url, link, push or pull`);
    const remote = nonLocalAddresses(text);
    if (remote.length > 0) errors.push(`"review.${key}" must reach only localhost, 127.0.0.1 or [::1] (got "${remote[0]}"): a host that is remote, or that a variable decides, cannot be shown to be local`);
  });
  return errors;
}

/**
 * Resolve the profile of one platform entry ({ stack, path, targets, checks }).
 * Returns { ok: true, profile } or { ok: false, errors }.
 */
export function resolveProfile({ platform, pluginRoot, read }) {
  const plugin = readProfile(read, pluginProfilePath(pluginRoot, platform.stack));
  const repository = readProfile(read, repositoryProfilePath(platform.stack));
  const errors = [...plugin.errors, ...repository.errors];
  if (plugin.profile?.skillsDisable.length > 0) errors.push(`${pluginProfilePath(pluginRoot, platform.stack)}: "skills.${SKILLS_DISABLE}" belongs in the repository's profile, not in the plugin's`);
  ['adapter', 'needs', 'expected_errors'].forEach((key) => {
    if (plugin.profile?.review[key] !== undefined) errors.push(`${pluginProfilePath(pluginRoot, platform.stack)}: "review.${key}" belongs in the repository's profile, not in the plugin's`);
  });
  if (errors.length > 0) return { ok: false, errors };
  const merged = mergeProfiles(plugin.profile, repository.profile);
  if (!merged) return { ok: false, errors: [`no profile for stack "${platform.stack}": define one in ${profileLocations(platform.stack)}`] };
  const declaredErrors = declaredAdapterErrors(merged, platform.stack);
  if (declaredErrors.length > 0) return { ok: false, errors: declaredErrors.map((e) => `${repositoryProfilePath(platform.stack)}: ${e}`) };
  const profile = applyChecks(merged, platform.checks ?? {});
  profile.stack = platform.stack;
  // The list of expected errors is read by the audit of a declared adapter only; on any other stack it is dropped and reported.
  profile.reviewIgnoredKeys = [];
  if (profile.review.expected_errors !== undefined && profile.review.adapter !== 'api' && !isGenericApi(platform.stack)) {
    profile.ignored = [...(profile.ignored ?? []), { key: 'review.expected_errors', value: profile.review.expected_errors.join(', '), kept: 'the audit of the plugin for this stack, which has no list of expected errors' }];
    profile.reviewIgnoredKeys.push('review.expected_errors');
    delete profile.review.expected_errors;
  }
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
    // A stack of the repository may leave analyze, test and format to relevo.yml, so they are valid even undefined.
    knownChecks: (stack) => {
      const p = of(stack);
      if (!p) return null;
      const own = p.layers.length === 1 && p.layers[0] === 'repository';
      return own ? [...new Set([...Object.keys(p.commands), 'analyze', 'test', 'format'])] : Object.keys(p.commands);
    },
  };
}

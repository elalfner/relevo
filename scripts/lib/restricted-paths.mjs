// Files that no agent and no script of Relevo reads. Implements "Restricted files are not read by an agent" and the
// requirements around it of the security specification. It is the opposite direction of protected-paths.mjs, which says
// what a diff may write: here the question is "may anything read it?", so there is no soft tier and no `Allow-paths:`
// escape, and the list only grows (the base plus `restricted_paths` of relevo.yml).
//
// Everything here compares path NAMES. Nothing in this module opens a restricted file.

import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { matchesGlob, platformFolders } from './protected-paths.mjs';
import { parse } from './yaml-lite.mjs';

/** The reason a run ends with when a restricted file reaches its output. */
export const RESTRICTED_REASON = 'restricted file in the diff';

// A pattern without `/` matches at any depth, like .gitignore; one that ends in `/` is a folder anchored at the root.
export const BASE_PATTERNS = [
  // environment files
  '.env', '.env.*',
  // private keys and certificates
  '*.pem', '*.key', '*.p12', '*.pfx', '*.p8', '*.ppk', '*.keystore', '*.jks',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
  // credential files of package managers and of the shell
  '.npmrc', '.netrc', '.pypirc', '.git-credentials', '.pgpass', '.htpasswd',
  // service configuration of mobile apps
  'google-services.json', 'GoogleService-Info.plist', 'key.properties',
  // a folder for secrets
  'secrets/',
];

// Files that stay readable although a base pattern covers them: the skills and the stacks read them for the names of
// the variables. The exception is by name, never by pattern, and it applies to the base list only.
export const EXEMPT_NAMES = ['.env.example'];

// Where an agent tool takes a glob but cannot be told "except the example file", `.env.*` is written out as the
// variants that projects use, so that the example stays readable.
const ENV_VARIANTS = ['local', 'development', 'production', 'staging', 'test', 'testing', 'dev', 'prod', 'qa', 'ci', 'preview'];
const ENV_EXPANSION = ['.env.*.local', ...ENV_VARIANTS.map((v) => `.env.${v}`)];

// One name for every spelling: `a//b`, `a/./b` and `a/x/../b` are `a/b`. A path that climbs out (`../x`) keeps its `..`, so
// it is judged by its name; the leading slashes are dropped, as everywhere in this module.
const clean = (path) => {
  const p = String(path ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (p === '') return '';
  const n = posix.normalize(p).replace(/^\/+/, '');
  return n === '.' ? '' : n;
};
const baseName = (path) => clean(path).split('/').pop();

/**
 * The list in force: the base, the `secrets/` folder of every platform below the root, and the project's own entries
 * (`restricted_paths`). `config` is a validated configuration; nothing can take an entry away.
 */
export function restrictedList(config = {}) {
  const platformSecrets = platformFolders(config?.platforms).map((folder) => `${folder}/secrets/`);
  const own = (config?.restricted_paths ?? []).map(clean).filter(Boolean);
  return [...new Set([...BASE_PATTERNS, ...platformSecrets, ...own])];
}

const validEntries = (entries) => {
  const bad = new Set(invalidRestrictedEntries(entries).map((b) => b.entry));
  return entries.filter((e) => !bad.has(e));
};

const unquote = (s) => s.trim().replace(/\s+#.*$/, '').replace(/^(["'])(.*)\1$/, '$2').trim();

/** The entries under `restricted_paths:` read from the raw lines: an inline `[a, b]` or a block of `- x` items. */
function entriesFromLines(text) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^restricted_paths:/.test(l));
  if (at === -1) return [];
  const inline = lines[at].slice('restricted_paths:'.length).replace(/\s+#.*$/, '').trim();
  if (inline.startsWith('[')) return inline.replace(/^\[|\]\s*$/g, '').split(',').map(unquote).filter(Boolean);
  if (inline !== '') return [unquote(inline)].filter(Boolean);
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (!item) break;
    out.push(unquote(item[1]));
  }
  return out.filter(Boolean);
}

/**
 * The list in force from the text of relevo.yml, even when the file does not validate: the valid entries of
 * `restricted_paths` and the platform folders are taken from the parsed text, and only the entries that are not allowed
 * (absolute, `..`, `~`, `!`) are dropped. A mistake elsewhere in the file must never make a restriction stop applying: when
 * the parser rejects the file, the entries are read from the lines of `restricted_paths:`.
 */
export function restrictedListFromText(text) {
  let raw = null;
  try {
    raw = parse(String(text ?? ''));
  } catch {
    // The parser rejects a construct of the file elsewhere: read the entries of `restricted_paths` from the lines.
    return restrictedList({ restricted_paths: validEntries(entriesFromLines(String(text ?? ''))) });
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return restrictedList();
  const given = [].concat(raw.restricted_paths ?? []).filter((e) => typeof e === 'string' && e.trim() !== '');
  const platforms = raw.platforms !== null && typeof raw.platforms === 'object' && !Array.isArray(raw.platforms) ? raw.platforms : {};
  return restrictedList({ restricted_paths: validEntries(given), platforms });
}

/** The pattern of the list that covers `path`, or null. The example file is not covered by a base pattern. */
export function restrictedRule(path, list = BASE_PATTERNS) {
  const p = clean(path);
  if (!p) return null;
  const exempt = EXEMPT_NAMES.includes(baseName(p));
  return list.find((pattern) => matchesGlob(p, pattern) && !(exempt && BASE_PATTERNS.includes(pattern))) ?? null;
}

export const isRestricted = (path, list = BASE_PATTERNS) => restrictedRule(path, list) !== null;

/** Check a set of paths. Returns { ok, violations: [{ path, rule }] }. */
export function checkRestricted(paths, list = BASE_PATTERNS) {
  const violations = [];
  [...new Set((paths ?? []).map(clean).filter(Boolean))].forEach((path) => {
    const rule = restrictedRule(path, list);
    if (rule) violations.push({ path, rule });
  });
  return { ok: violations.length === 0, violations };
}

/** The name inside a quoted path of git: C-style escapes, octal bytes (UTF-8) included. */
export function unquoteGit(text) {
  const simple = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '"': 34, '\\': 92 };
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const octal = c === '\\' ? /^[0-7]{3}/.exec(text.slice(i + 1)) : null;
    if (octal) {
      bytes.push(parseInt(octal[0], 8));
      i += 3;
    } else if (c === '\\' && text[i + 1] in simple) {
      bytes.push(simple[text[i + 1]]);
      i += 1;
    } else bytes.push(...Buffer.from(c));
  }
  return Buffer.from(bytes).toString('utf8');
}

/** The paths of a unified diff that are restricted: [{ path, rule }]. Only the headers are read, never the added lines. */
export function restrictedInDiff(diffText, list = BASE_PATTERNS) {
  const paths = [];
  let previous = '';
  String(diffText ?? '').split('\n').forEach((line) => {
    // Git quotes a name with unusual characters ("cl\303\251.pem"): the quoted form is read back to the real name.
    const header = /^diff --git (?:"a\/(?:[^"\\]|\\.)*"|a\/.+?) (?:"b\/((?:[^"\\]|\\.)*)"|b\/(.+))$/.exec(line);
    // The `+++ b/<path>` line only counts right after a `--- ` line: an added line whose text is "++ x" looks the same.
    const plus = previous.startsWith('--- ') ? /^\+\+\+ (?:"b\/((?:[^"\\]|\\.)*)"|b\/(.+))$/.exec(line) : null;
    const found = header ?? plus;
    if (found) paths.push(found[1] !== undefined ? unquoteGit(found[1]) : found[2].trim());
    previous = line;
  });
  return checkRestricted(paths, list).violations;
}

/** Split paths into those that may be read or published and those left out: { kept, left }. */
export function filterRestricted(paths, list = BASE_PATTERNS) {
  const kept = [];
  const left = [];
  (paths ?? []).forEach((path) => (isRestricted(path, list) ? left : kept).push(path));
  return { kept, left };
}

/** What a script prints when it left restricted files out. Names only. */
export const leftOutText = (left) => (left.length === 0 ? '' : `left out ${left.length} restricted file${left.length === 1 ? '' : 's'} (${left.join(', ')}): Relevo never reads or publishes them`);

export class RestrictedPathError extends Error {
  constructor(path, rule) {
    super(`${path} is a restricted file (${rule}): Relevo never reads or publishes it`);
    this.name = 'RestrictedPathError';
    this.path = path;
    this.rule = rule;
  }
}

/** Throws when a script is about to open or publish a restricted file. Call it before the file is opened. */
export function assertNotRestricted(path, list = BASE_PATTERNS) {
  const rule = restrictedRule(path, list);
  if (rule) throw new RestrictedPathError(String(path), rule);
}

export function formatRestricted(violations) {
  return violations.map((v) => `${v.path}  ${RESTRICTED_REASON} (${v.rule}): no agent or script of Relevo reads or publishes it`).join('\n');
}

/** Entries of `restricted_paths` that are not allowed: [{ entry, reason }]. The list can only grow. */
export function invalidRestrictedEntries(entries) {
  const out = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') return;
    const e = entry.trim().replace(/\\/g, '/');
    if (e.startsWith('!')) out.push({ entry, reason: 'the base list cannot be reduced: an entry that starts with "!" would lift a restricted file' });
    else if (e.startsWith('/') || /^[A-Za-z]:\//.test(e) || e.startsWith('~')) out.push({ entry, reason: 'it must be relative to the repository, not an absolute path' });
    else if (e.split('/').includes('..')) out.push({ entry, reason: 'it leaves the repository' });
  });
  return out;
}

// ---------------------------------------------------------------- what an agent is told

/** The globs of the list as an agent tool takes them: the example file is left out of what `.env.*` covers. */
export function denyPatterns(list = BASE_PATTERNS) {
  const out = list.flatMap((pattern) => (pattern === '.env.*' ? ENV_EXPANSION : [pattern]));
  return [...new Set(out)];
}

// `root` is where the settings resolve a relative path from. A project settings file is at the root of the project, so
// `./` is right; a settings file outside the repository (the workflow's) needs the absolute folder, written `/<folder>`
// after the `/` that the folder already starts with.
const anchored = (path, root) => (root ? `/${root}/${path}` : `./${path}`);

function pathOf(pattern, root) {
  if (pattern.endsWith('/')) return { kind: 'folder', path: anchored(pattern.replace(/\/+$/, ''), root) };
  if (pattern.includes('/')) return { kind: 'file', path: anchored(pattern, root) };
  return { kind: 'any', path: `**/${pattern}` };
}

/** The `Read(...)` rules for `permissions.deny` or `--disallowedTools` of Claude Code. */
export function claudeReadRules(list = BASE_PATTERNS, { root = null } = {}) {
  return denyPatterns(list).map((pattern) => {
    const { kind, path } = pathOf(pattern, root);
    return `Read(${kind === 'folder' ? `${path}/**` : path})`;
  });
}

// The entries of `sandbox.filesystem.denyRead`: a name at any depth gets a leading double star, a folder or a path is anchored.
export function claudeDenyRead(list = BASE_PATTERNS, { root = null } = {}) {
  return denyPatterns(list).map((pattern) => pathOf(pattern, root).path);
}

/**
 * The two Claude Code controls together, because each covers what the other does not: `Read` rules stop the file tools
 * and the file commands Claude Code recognizes in a shell; the sandbox stops every process but not the `Read` tool.
 * The sandbox is NOT switched on unless `enabled` is asked for: whether the cloud build still fetches, comments, labels
 * and pushes with it on has not been shown, so the cloud renders the denials and leaves `sandbox.enabled` unset, and a
 * person who enables the sandbox gets them. `failIfUnavailable` only matters when it is enabled, so it is written only
 * then; it stays false until a run shows that the sandbox starts on the runner.
 */
export const SANDBOX_FAIL_IF_UNAVAILABLE = false;
export function claudeSettings(list = BASE_PATTERNS, { root = null, enabled = false } = {}) {
  const sandbox = { filesystem: { denyRead: claudeDenyRead(list, { root }) } };
  return {
    permissions: { deny: claudeReadRules(list, { root }) },
    sandbox: enabled ? { enabled: true, failIfUnavailable: SANDBOX_FAIL_IF_UNAVAILABLE, ...sandbox } : sandbox,
  };
}

/**
 * The `read_file(...)` rules of Antigravity for the restricted files that exist in the tree: one rule for each, by
 * absolute path, because the tool matches no glob (a bare name matches only at the root and `**` matches nothing).
 * `files` are paths relative to `root`.
 */
export function agyReadDenials(files, list = BASE_PATTERNS, root = process.cwd()) {
  const base = String(root).replace(/\/+$/, '');
  return [...new Set((files ?? []).map(clean).filter((f) => isRestricted(f, list)))].sort().map((f) => `read_file(${base}/${f})`);
}

// Folders that are never walked: dependencies and build output, which are large and hold no file of the project.
const SKIPPED_FOLDERS = new Set(['.git', 'node_modules', 'vendor', '.dart_tool', 'build']);

/**
 * The restricted files that exist under `root`, found by name: the directories are listed, no file is opened.
 * `readdir(path) -> [{ name, isDirectory }]` is injected for the tests.
 */
export function findRestrictedFiles(root, list = BASE_PATTERNS, { readdir = (dir) => readdirSync(dir, { withFileTypes: true }).map((d) => ({ name: d.name, isDirectory: d.isDirectory() })) } = {}) {
  const found = [];
  const walk = (relative) => {
    let entries;
    try {
      entries = readdir(relative ? join(root, relative) : root);
    } catch {
      return;
    }
    entries.forEach(({ name, isDirectory }) => {
      const path = relative ? `${relative}/${name}` : name;
      if (isDirectory) {
        if (!SKIPPED_FOLDERS.has(name)) walk(path);
      } else if (isRestricted(path, list)) found.push(path);
    });
  };
  walk('');
  return found.sort();
}

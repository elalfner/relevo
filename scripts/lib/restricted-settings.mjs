// The read denials of restricted files in the settings of an agent on a person's machine. `init` proposes them and merges
// them in after a yes; `doctor` checks that they are there. Implements "Init proposes the read denials for local use" and
// "Doctor checks the read denials by path name" of the init-doctor specification.
//
// Everything compares path names against the text of a settings file. Nothing here opens a restricted file.

import { matchesGlob } from './protected-paths.mjs';
import { BASE_PATTERNS, agyReadDenials, claudeDenyRead, claudeReadRules, isRestricted } from './restricted-paths.mjs';

export const CLAUDE_SETTINGS = '.claude/settings.json';
export const CLAUDE_PROJECT_FILES = ['.claude/settings.json', '.claude/settings.local.json'];
export const CLAUDE_USER_FILE = '.claude/settings.json';
export const AGY_USER_FILE = '.gemini/antigravity-cli/settings.json';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** What `init` proposes for the project settings of Claude Code, with the root of the project as the base of paths. */
export function claudeProposal(list = BASE_PATTERNS) {
  return { deny: claudeReadRules(list), denyRead: claudeDenyRead(list) };
}

/** The entries of the proposal that `settings` (a parsed object) does not have yet: { deny, denyRead }. */
export function missingClaudeEntries(settings, list = BASE_PATTERNS) {
  const want = claudeProposal(list);
  const have = (path) => new Set(path.reduce((acc, key) => (isObject(acc) ? acc[key] : undefined), settings) ?? []);
  const deny = have(['permissions', 'deny']);
  const denyRead = have(['sandbox', 'filesystem', 'denyRead']);
  return { deny: want.deny.filter((r) => !deny.has(r)), denyRead: want.denyRead.filter((r) => !denyRead.has(r)) };
}

/**
 * The text of `.claude/settings.json` with the missing denials added at the end of their lists. Every other key, and
 * every entry that is already there, keeps its place. `text` is null when the file does not exist; text that is not a
 * JSON object throws, so a broken file is never rewritten. The sandbox is not switched on: that is the person's choice.
 */
export function mergeClaudeDenials(text, list = BASE_PATTERNS) {
  const settings = text === null ? {} : JSON.parse(text);
  if (!isObject(settings)) throw new Error(`${CLAUDE_SETTINGS} is not a JSON object`);
  if (settings.permissions !== undefined && !isObject(settings.permissions)) throw new Error('permissions in .claude/settings.json is not an object');
  if (settings.permissions?.deny !== undefined && !Array.isArray(settings.permissions.deny)) throw new Error('permissions.deny in .claude/settings.json is not a list');
  if (settings.sandbox !== undefined && !isObject(settings.sandbox)) throw new Error('sandbox in .claude/settings.json is not an object');
  if (settings.sandbox?.filesystem !== undefined && !isObject(settings.sandbox.filesystem)) throw new Error('sandbox.filesystem in .claude/settings.json is not an object');
  if (settings.sandbox?.filesystem?.denyRead !== undefined && !Array.isArray(settings.sandbox.filesystem.denyRead)) throw new Error('sandbox.filesystem.denyRead in .claude/settings.json is not a list');
  const missing = missingClaudeEntries(settings, list);
  if (missing.deny.length === 0 && missing.denyRead.length === 0) return text;
  const permissions = { ...(settings.permissions ?? {}), deny: [...(settings.permissions?.deny ?? []), ...missing.deny] };
  const filesystem = { ...(settings.sandbox?.filesystem ?? {}), denyRead: [...(settings.sandbox?.filesystem?.denyRead ?? []), ...missing.denyRead] };
  const sandbox = { ...(settings.sandbox ?? {}), filesystem };
  return `${JSON.stringify({ ...settings, permissions, ...(missing.denyRead.length > 0 || settings.sandbox ? { sandbox } : {}) }, null, 2)}\n`;
}

/** The exact text `init` shows before it writes: the entries it adds, as they will stand in the file. */
export function claudeProposalText(missing) {
  return JSON.stringify({ permissions: { deny: missing.deny }, sandbox: { filesystem: { denyRead: missing.denyRead } } }, null, 2);
}

// ---------------------------------------------------------------- does a settings file cover a path?

/** The folder form of a rule without wildcards (`secrets`) covers what is under it, like a line of .gitignore. */
function ruleCovers(pattern, relative, absolute) {
  let g = pattern.trim();
  let target = relative;
  let anchored = false;
  if (g.startsWith('//')) {
    target = absolute;
    g = g.slice(1);
  } else if (g.startsWith('~/')) return false;
  else {
    // `./name` and `/name` are anchored at the root; a bare name, like a line of .gitignore, matches at any depth.
    anchored = /^\.?\//.test(g);
    g = g.replace(/^\.?\//, '');
  }
  if (!g) return false;
  if (matchesGlob(target, g) && !(anchored && !g.includes('/') && target.includes('/'))) return true;
  return !/[*?]/.test(g) && target.replace(/^\/+/, '').startsWith(`${g.replace(/\/+$/, '').replace(/^\/+/, '')}/`);
}

/** Does a parsed Claude Code settings object deny `Read` of the path? `root` is the folder of the repository. */
export function claudeCovers(settings, path, root) {
  const deny = isObject(settings) && isObject(settings.permissions) && Array.isArray(settings.permissions.deny) ? settings.permissions.deny : [];
  const absolute = `${String(root).replace(/\/+$/, '')}/${path}`;
  return deny.some((rule) => {
    const m = /^Read\((.*)\)$/.exec(String(rule));
    return m !== null && ruleCovers(m[1], path, absolute);
  });
}

/** Does a parsed Antigravity settings object deny `read_file` of the absolute path, by its path, a folder or `*`? */
export function agyCovers(settings, absolute) {
  const deny = isObject(settings) && isObject(settings.permissions) && Array.isArray(settings.permissions.deny) ? settings.permissions.deny : [];
  return deny.some((rule) => {
    const m = /^read_file\((.*)\)$/.exec(String(rule));
    if (m === null) return false;
    const target = m[1].replace(/\/+$/, '');
    return target === '*' || target === absolute || (target.startsWith('/') && absolute.startsWith(`${target}/`));
  });
}

/** The text of the Antigravity settings with the `read_file` rules added to `permissions.deny`, after the existing ones. */
export function mergeAgyDenials(text, rules) {
  const settings = text === null ? {} : JSON.parse(text);
  if (!isObject(settings)) throw new Error('the Antigravity settings are not a JSON object');
  if (settings.permissions !== undefined && !isObject(settings.permissions)) throw new Error('permissions in the Antigravity settings is not an object');
  if (settings.permissions?.deny !== undefined && !Array.isArray(settings.permissions.deny)) throw new Error('permissions.deny in the Antigravity settings is not a list');
  const have = new Set(settings.permissions?.deny ?? []);
  const add = rules.filter((r) => !have.has(r));
  if (add.length === 0) return text;
  return `${JSON.stringify({ ...settings, permissions: { ...(settings.permissions ?? {}), deny: [...(settings.permissions?.deny ?? []), ...add] } }, null, 2)}\n`;
}

// ---------------------------------------------------------------- the facts `doctor` and `init` share

function parse(text) {
  if (text === null || text === undefined) return { absent: true };
  try {
    const value = JSON.parse(text);
    return isObject(value) ? { value } : { unreadable: true };
  } catch {
    return { unreadable: true };
  }
}

/**
 * What the settings say about the restricted files, by name. `read(path)` returns the text of a file of the repository,
 * `readUser(path)` that of a file in the home folder (both null when absent); `present` are the restricted files that
 * exist in the working folder and `tracked` the ones git versions, both found by name. Returns:
 *   present, tracked
 *   claude { unreadable: [files], uncovered: [paths], missing: { deny, denyRead } (against the project settings) }
 *   antigravity { used, unreadable, uncovered: [paths] }
 */
export function restrictedFacts({ list = BASE_PATTERNS, root, read, readUser = () => null, present = [], tracked = [], antigravity = false }) {
  const projectFiles = CLAUDE_PROJECT_FILES.map((file) => ({ file, ...parse(read(file)) }));
  const user = { file: `~/${CLAUDE_USER_FILE}`, ...parse(readUser(CLAUDE_USER_FILE)) };
  const sources = [...projectFiles, user];
  const files = present.filter((path) => isRestricted(path, list));
  const claude = {
    unreadable: sources.filter((s) => s.unreadable).map((s) => s.file),
    uncovered: files.filter((path) => !sources.some((s) => s.value && claudeCovers(s.value, path, root))),
    missing: missingClaudeEntries(projectFiles[0].value ?? {}, list),
  };
  const agy = parse(readUser(AGY_USER_FILE));
  const agyUncovered = antigravity ? files.filter((path) => !(agy.value && agyCovers(agy.value, `${String(root).replace(/\/+$/, '')}/${path}`))) : [];
  return {
    root,
    present: files,
    tracked: tracked.filter((path) => isRestricted(path, list)),
    claude,
    antigravity: {
      used: antigravity,
      unreadable: Boolean(agy.unreadable),
      uncovered: agyUncovered,
      rules: agyReadDenials(agyUncovered, list, root),
    },
  };
}

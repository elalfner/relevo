// Extra skills per role. Implements the "role-skills" specification: a skill is given to an agent only when it
// is trustworthy, and the reason a skill was left out is always reported.
//
// `git(args) -> stdout` is injected (it throws when the command fails) so the logic is tested without a repository.

import { createHash } from 'node:crypto';
import { ROLES } from './stack-profile.mjs';

export const SKILL_DIRS = ['.agents/skills', '.claude/skills'];

/**
 * Where to look for a skill of a platform: its own folder first, then the root. A platform whose folder is `.` (or
 * that has none) looks only at the root.
 */
export function skillDirsFor(platformPath) {
  const folder = String(platformPath ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (folder === '' || folder === '.') return [...SKILL_DIRS];
  return [...SKILL_DIRS.map((d) => `${folder}/${d}`), ...SKILL_DIRS];
}
export const SIZE_BUDGET_BYTES = 20 * 1024;
const SCRIPT_EXTENSIONS = ['.sh', '.bash', '.js', '.mjs', '.cjs', '.ts', '.py', '.rb', '.php', '.ps1'];
const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

/** The roles whose lists apply to `role`: `fix` uses those of `dev` and `qa`. */
export const rolesFor = (role) => (role === 'fix' ? ['dev', 'qa'] : [role]);

/** Does a skill folder hold anything that can run? `files` are paths relative to the folder. */
export function hasScripts(files) {
  return files.some((f) => {
    const parts = f.split('/');
    return parts.slice(0, -1).includes('scripts') || SCRIPT_EXTENSIONS.some((ext) => parts[parts.length - 1].toLowerCase().endsWith(ext));
  });
}

/** Does the frontmatter of a SKILL.md reserve the skill for the person? */
export function reservedForPerson(skillMd) {
  const head = String(skillMd ?? '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  return head ? /^disable-model-invocation:\s*true\s*$/m.test(head[1]) : false;
}

/** Entries of `git ls-tree -r` for a path: [{ mode, path }]. */
function listTree(git, ref, dir) {
  let out;
  try {
    out = git(['ls-tree', '-r', ref, '--', dir]);
  } catch {
    return [];
  }
  return String(out).split('\n').filter(Boolean).map((line) => {
    const [meta, path] = line.split('\t');
    return { mode: meta.split(' ')[0], path };
  });
}

/**
 * Decide whether one skill can be given to an agent.
 * Returns { name, path, scripts } when it can, or { name, left_out: true, reason }.
 */
export function resolveSkill({ name, git, baseRef, allowScripts = [], dirs = SKILL_DIRS }) {
  const out = (reason) => ({ name, left_out: true, reason });
  if (!NAME_RE.test(name)) return out('invalid name');

  let sawLink = false;
  for (const dir of dirs) {
    const folder = `${dir}/${name}`;
    const entries = listTree(git, baseRef, folder);
    if (entries.length === 0) continue;
    if (entries.some((e) => e.mode === '120000')) {
      sawLink = true;
      continue; // a link is followed only through the folder it points to, which is one of `dirs`
    }
    const files = entries.map((e) => e.path.slice(folder.length + 1));
    const skillMd = `${folder}/SKILL.md`;
    if (!files.includes('SKILL.md')) return out('no SKILL.md on the base branch');
    let text;
    try {
      text = git(['show', `${baseRef}:${skillMd}`]);
    } catch {
      return out('no SKILL.md on the base branch');
    }
    if (reservedForPerson(text)) return out('reserved for the person');
    const scripts = hasScripts(files);
    if (scripts && !allowScripts.includes(name)) return out('has scripts and is not allowed');
    return { name, path: skillMd, scripts };
  }
  return out(sawLink ? 'is a link to a folder that is not on the base branch' : 'not on the base branch');
}

/** Resolve the skills of a role (or of `fix`) from a resolved profile. */
export function resolveRoleSkills({ role, profile, git, baseRef, allowScripts = [], dirs = SKILL_DIRS }) {
  if (![...ROLES, 'fix'].includes(role)) throw new Error(`unknown role "${role}"; allowed: ${[...ROLES, 'fix'].join(', ')}`);
  const names = [...new Set(rolesFor(role).flatMap((r) => profile.skills[r] ?? []))];
  // A skill the plugin's profile lists is a default one; the repository's own are the person's choice.
  const defaults = new Set(rolesFor(role).flatMap((r) => profile.pluginSkills?.[r] ?? []));
  return names.map((name) => ({ ...resolveSkill({ name, git, baseRef, allowScripts, dirs }), ...(defaults.has(name) ? { default: true } : {}) }));
}

/** Sum of the sizes (bytes) of the skills handed to one role, and whether it is over the budget. */
export function skillBudget(sizes) {
  const bytes = sizes.reduce((a, b) => a + b, 0);
  return { bytes, over: bytes > SIZE_BUDGET_BYTES };
}

/**
 * The hash `skills-lock.json` keeps for a skill folder: SHA-256 over its files, sorted by path without regard to
 * case, each contributing its relative path and then its content. `files` is [{ path, content }].
 * (Found by reproducing the `computedHash` of a lock file written by the skills installer.)
 */
export function folderHash(files) {
  const h = createHash('sha256');
  [...files].sort((a, b) => (a.path.toLowerCase() < b.path.toLowerCase() ? -1 : a.path.toLowerCase() > b.path.toLowerCase() ? 1 : 0)).forEach((f) => {
    h.update(f.path);
    h.update(f.content);
  });
  return h.digest('hex');
}

/** Names of the skills whose folder hash differs from the one in the lock file. `hashes` maps name to hash (or null when the folder is absent). */
export function lockDifferences(lock, hashes) {
  const skills = lock && typeof lock === 'object' && lock.skills && typeof lock.skills === 'object' ? lock.skills : {};
  return Object.entries(skills)
    .filter(([name, entry]) => hashes[name] !== undefined && hashes[name] !== null && entry?.computedHash && hashes[name] !== entry.computedHash)
    .map(([name]) => name);
}

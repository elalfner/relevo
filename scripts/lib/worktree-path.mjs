// Where the worktree of an issue lives: next to the repository, never inside it. Shared by `go-local` and
// `go-worktree` so that the two cannot name it differently.

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

export const WORKTREES_FOLDER = '.relevo-worktrees';

/** The worktree of an issue: `<parent of the repository>/.relevo-worktrees/<repository>-<issue>`. Pure. */
export function worktreePath(repoRoot, issue) {
  return join(dirname(repoRoot), WORKTREES_FOLDER, `${basename(repoRoot)}-${issue}`);
}

export const STATE_FOLDER = '.state';

/** The state folder of the build of an issue: `<parent of the repository>/.relevo-worktrees/.state/<repository>-<issue>`. Pure. */
export function stateDir(repoRoot, issue) {
  return join(dirname(repoRoot), WORKTREES_FOLDER, STATE_FOLDER, `${basename(repoRoot)}-${issue}`);
}

/**
 * The progress folder of this process: `RELEVO_PROGRESS_DIR` when it is set; otherwise, when the working directory is inside
 * a worktree of `.relevo-worktrees/<repository>-<issue>` whose state folder exists, that folder; otherwise null. Never throws.
 */
export function progressDir({ env = process.env, cwd = process.cwd(), exists = existsSync } = {}) {
  try {
    if (env?.RELEVO_PROGRESS_DIR) return env.RELEVO_PROGRESS_DIR;
    const parts = resolve(cwd).split(sep);
    const at = parts.lastIndexOf(WORKTREES_FOLDER);
    const name = at === -1 ? undefined : parts[at + 1];
    if (!name || name === STATE_FOLDER || !/^.+-\d+$/.test(name)) return null;
    const dir = join(parts.slice(0, at + 1).join(sep) || sep, STATE_FOLDER, name);
    return exists(dir) ? dir : null;
  } catch {
    return null;
  }
}

/** Empties and creates a state folder, so a new build replaces the state of the last one. True when it is there; never throws. */
export function resetStateDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

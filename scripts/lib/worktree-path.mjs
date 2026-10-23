// Where the worktree of an issue lives: next to the repository, never inside it. Shared by `go-local` and
// `go-worktree` so that the two cannot name it differently.

import { basename, dirname, join } from 'node:path';

export const WORKTREES_FOLDER = '.relevo-worktrees';

/** The worktree of an issue: `<parent of the repository>/.relevo-worktrees/<repository>-<issue>`. Pure. */
export function worktreePath(repoRoot, issue) {
  return join(dirname(repoRoot), WORKTREES_FOLDER, `${basename(repoRoot)}-${issue}`);
}

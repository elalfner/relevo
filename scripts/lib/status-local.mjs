// The builds that are running on this machine, for `status`. Implements "Status shows the builds of this machine" of the status
// specification. It reads the state folders beside the worktrees and never writes or interrupts anything.

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { STATE_FOLDER, WORKTREES_FOLDER, stateDir, worktreePath } from './worktree-path.mjs';

/**
 * [{ issue, phase, group, tasks, minutes, lastChangeMinutes }] for the builds of the repository at `repoRoot` that have a state
 * folder, a worktree and no end: the ones that are running. `state.snapshot` is injected (see `realState` of build-state.mjs).
 * Never throws.
 */
export function readLocalBuilds({ repoRoot, state, now = Date.now() }) {
  try {
    const folder = join(dirname(repoRoot), WORKTREES_FOLDER, STATE_FOLDER);
    if (!existsSync(folder)) return [];
    const prefix = `${basename(repoRoot)}-`;
    return readdirSync(folder)
      .map((name) => ({ name, issue: name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)) ? Number(name.slice(prefix.length)) : null }))
      .filter((e) => e.issue !== null)
      .map((e) => {
        const worktree = worktreePath(repoRoot, e.issue);
        if (!existsSync(worktree)) return null;
        const snapshot = state.snapshot({ dir: stateDir(repoRoot, e.issue), worktree, changeId: null, now });
        if (!snapshot || snapshot.ended) return null;
        return {
          issue: e.issue, phase: snapshot.phase, group: snapshot.group, tasks: snapshot.tasks, minutes: snapshot.minutes,
          lastChangeMinutes: snapshot.lastChange === null ? null : Math.max(0, Math.floor((now - snapshot.lastChange) / 60000)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.issue - b.issue);
  } catch {
    return [];
  }
}

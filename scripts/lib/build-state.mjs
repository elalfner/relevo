// The state of a build on a machine, computed on read from the progress folder and the worktree. Implements "The state of
// a local build is kept beside the worktrees" and "The progress of a local build can be read while it runs" of the
// execution-modes specification. Nothing here keeps a loop: the snapshot is built when somebody looks.
//
// Files of the folder written here: `build.json` ({ issue, changeId, startedAt }), `ended.json` ({ status, at }),
// `totals.json` (what the run used) and `snapshot.json` (the last snapshot, written at the end, which keeps the tasks
// once the worktree is removed). The rest are written by the scripts that already write them.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { groupInProgress, readGroups } from './group-progress.mjs';
import { readLensLog, readClass } from './phase-log.mjs';
import { currentPhase, readAnnouncement, readTreeFacts } from './progress.mjs';
import { readLedger } from './run-budget.mjs';
import { resetStateDir } from './worktree-path.mjs';

const readJson = (dir, name) => {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch {
    return null;
  }
};
function writeJson(dir, name, value) {
  try {
    const file = join(dir, name);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

/** The start of a build: its issue, the id of its change when known, and the time. Never throws. */
export const writeBuildStart = (dir, { issue, changeId = null, now = Date.now() }) => writeJson(dir, 'build.json', { issue: Number(issue), changeId, startedAt: now });
/** Adds the id of the change to what `build.json` holds (an interactive build learns it when it plans). */
export function writeChangeId(dir, changeId) {
  const current = readJson(dir, 'build.json') ?? {};
  return writeJson(dir, 'build.json', { ...current, changeId });
}
export const writeBuildEnd = (dir, { status, now = Date.now() }) => writeJson(dir, 'ended.json', { status, at: now });
export const writeTotals = (dir, totals) => writeJson(dir, 'totals.json', totals);
export const writeSnapshot = (dir, snapshot) => (snapshot ? writeJson(dir, 'snapshot.json', snapshot) : false);
export const readSnapshot = (dir) => (dir ? readJson(dir, 'snapshot.json') : null);

/** The newest modification time of the files of the folder, in ms, or null. */
function newestChange(dir) {
  let newest = null;
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.tmp') || name === 'snapshot.json') continue;
    try {
      const at = statSync(join(dir, name)).mtimeMs;
      if (newest === null || at > newest) newest = at;
    } catch {
      // a file that went away is not a change
    }
  }
  return newest === null ? null : Math.round(newest);
}

/**
 * The snapshot of a build, or null when the issue has no folder. `git(args) -> stdout` is run in the worktree.
 * { issue, changeId, phase, group, tasks, startedAt, lastChange, minutes, lenses, agents, outcome, totals, ended }
 */
export function buildSnapshot({ dir, worktree, git, base = null, branch = null, now = Date.now(), changeId = null }) {
  try {
    if (!dir || !existsSync(dir)) return null;
    const build = readJson(dir, 'build.json') ?? {};
    const id = changeId ?? build.changeId ?? null;
    const alive = Boolean(worktree) && existsSync(worktree);
    const facts = alive ? readTreeFacts({ cwd: worktree, changeId: id, base, branch, git }) : { hasChange: false, tasks: null, committed: false };
    const tasks = alive ? facts.tasks : readSnapshot(dir)?.tasks ?? null;
    const startedAt = Number.isFinite(build.startedAt) ? build.startedAt : null;
    const ended = readJson(dir, 'ended.json');
    return {
      issue: Number.isInteger(build.issue) ? build.issue : null,
      changeId: id,
      phase: currentPhase({ announced: readAnnouncement(dir), facts }),
      group: groupInProgress(readGroups(dir)),
      tasks,
      startedAt,
      lastChange: newestChange(dir),
      minutes: startedAt === null ? null : Math.max(0, Math.floor((now - startedAt) / 60000)),
      lenses: readLensLog(dir),
      agents: readLedger(dir),
      outcome: readClass(dir),
      totals: readJson(dir, 'totals.json'),
      ended: ended && Number.isInteger(ended.status) ? { status: ended.status, at: Number.isFinite(ended.at) ? ended.at : null } : null,
    };
  } catch {
    return null;
  }
}

/** The real files and git for `go-local.mjs`: what `runLocal` takes as `state`. */
export const realState = {
  prepare: resetStateDir,
  snapshot: ({ dir, worktree, changeId, now }) => buildSnapshot({
    dir, worktree, changeId, now, git: (args) => execFileSync('git', args, { cwd: worktree, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  }),
  start: writeBuildStart,
  end: writeBuildEnd,
  totals: writeTotals,
  save: writeSnapshot,
  read: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
};

// What the working tree looked like when the agent was about to start. The install step of a build (`flutter pub get`,
// `npm ci`) can rewrite a lockfile, and a rescue or a checkpoint that finds that file changed would take it for work of
// the agent: the safe commit refuses a dependency file the issue did not list, and refuses the whole commit with it,
// so the real work would be lost with it. The baseline records, for each file that already differed from the commit
// before the agent started, a fingerprint of its content. Afterwards a file whose content is still that fingerprint was
// not touched by the agent and is left out. A file the agent changed again has another fingerprint and stays in, so the
// scans judge it as they judge any change.
//
// Kept under $RELEVO_PROGRESS_DIR, outside the working tree. A restricted file is never opened: it has no fingerprint,
// so it is never left out. Anything unreadable gives an empty baseline, which leaves everything in (the safe side).
//
// `git(args) -> stdout` is injected so the logic can be tested; it throws when git fails.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { changedPaths } from './rescue-work.mjs';
import { isRestricted } from './restricted-paths.mjs';

const FILE = 'tree-baseline.json';

/** A fingerprint of the content of a path now, or null when it cannot be told (restricted, unreadable). A deleted file is `gone`. */
export function fingerprint(git, path, restricted) {
  if (isRestricted(path, restricted)) return null;
  try {
    return git(['hash-object', '--', path]).trim() || null;
  } catch {
    return 'gone';
  }
}

/** { path: fingerprint } for every file that differs from the commit right now. */
export function takeBaseline(git, restricted) {
  const paths = changedPaths(git(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  const baseline = {};
  for (const path of paths) {
    const print = fingerprint(git, path, restricted);
    if (print) baseline[path] = print;
  }
  return baseline;
}

export function saveBaseline(dir, baseline) {
  if (!dir) return false;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, FILE), JSON.stringify(baseline));
    return true;
  } catch {
    return false;
  }
}

/** The saved baseline, or {} when there is none or it cannot be read. Only string fingerprints are kept. */
export function loadBaseline(dir) {
  if (!dir) return {};
  try {
    const raw = JSON.parse(readFileSync(join(dir, FILE), 'utf8'));
    return Object.fromEntries(Object.entries(raw).filter(([path, print]) => typeof path === 'string' && typeof print === 'string'));
  } catch {
    return {};
  }
}

/** The paths the agent changed: those not in the baseline, or whose content is no longer the one recorded. */
export function changedSince(paths, baseline, git, restricted) {
  return paths.filter((path) => {
    const before = baseline?.[path];
    if (!before) return true;
    return fingerprint(git, path, restricted) !== before;
  });
}

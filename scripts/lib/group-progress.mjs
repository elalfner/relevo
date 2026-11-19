// The group in progress of a build, kept in the progress folder by the two scripts that know the groups: `task-groups.mjs`
// records how many there are, `checkpoint.mjs` records the one it committed. Implements "The progress shows the group in
// progress" of the go specification. Best effort: nothing here throws, and a folder that cannot be written is no error.

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'groups.json';
const whole = (v) => (Number.isInteger(v) && v > 0 ? v : null);

function write(dir, value) {
  try {
    if (!dir) return false;
    const file = join(dir, FILE);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

/** A run with `of` groups starts: none is committed yet. A resumed run counts its own groups, from 1. */
export const recordGroups = (dir, of) => whole(of) !== null && write(dir, { of, done: 0 });

/** The checkpoint of group `k` of `of` was committed. */
export const recordCheckpointed = (dir, k, of) => whole(of) !== null && Number.isInteger(k) && k >= 0 && write(dir, { of, done: k });

/** { of, done } as recorded, or null when nothing valid is there. */
export function readGroups(dir) {
  try {
    if (!dir) return null;
    const data = JSON.parse(readFileSync(join(dir, FILE), 'utf8'));
    const of = whole(data.of);
    const done = Number.isInteger(data.done) && data.done >= 0 ? data.done : null;
    return of !== null && done !== null ? { of, done } : null;
  } catch {
    return null;
  }
}

/** { group, of }: the last committed plus one, capped at the total; null when nothing was recorded. */
export function groupInProgress(groups) {
  return groups ? { group: Math.min(groups.done + 1, groups.of), of: groups.of } : null;
}

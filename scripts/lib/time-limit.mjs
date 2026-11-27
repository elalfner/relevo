// When a build must stop for time. `limits.run_max_minutes` stops the start of another agent (the soft limit); what is
// already running has until the hard stop: the limit plus a fixed margin, and in a cloud job no later than a few minutes
// before the job is cut. Implements "A build has a hard stop for what is already running" of the go specification.
//
// The state is in the progress folder of the build. Anything that cannot be read makes the clock inactive: nothing is cut
// and no call is refused on a guess.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readClass, readPhaseLog } from './phase-log.mjs';

export const HARD_STOP_MARGIN_MINUTES = 10;
/** Minutes of the job that are left after the hard stop, to keep the work and report. */
export const JOB_RESERVE_MINUTES = 5;
/** A hard stop older than this belongs to a build that is gone: its folder no longer stops anything. */
const STALE_MS = 6 * 60 * 60 * 1000;

const FILE = 'limits.json';
const positive = (v) => (Number.isFinite(v) && v > 0 ? v : null);

function readStored(dir) {
  try {
    const file = join(dir, FILE);
    const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/** Keeps the minutes limit and the job deadline (epoch milliseconds) of the build; a value that is not given stays. */
export function writeRunLimits(dir, { run_max_minutes: minutes, job_deadline: deadline } = {}) {
  const next = { ...readStored(dir) };
  if (positive(minutes)) next.run_max_minutes = minutes;
  if (positive(deadline)) next.job_deadline = deadline;
  try {
    writeFileSync(join(dir, FILE), `${JSON.stringify(next)}\n`);
    return true;
  } catch {
    return false;
  }
}

/** The `timeout-minutes` of the `build` job in the text of the go workflow, or null when it cannot be read. */
export function buildTimeoutMinutes(text) {
  const lines = String(text ?? '').split('\n');
  const start = lines.findIndex((l) => /^ {2}build:\s*$/.test(l));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^ {2}\S[^:]*:\s*$/.test(lines[i])) return null; // the next job begins
    const m = /^\s+timeout-minutes:\s*(\d+)\s*(?:#.*)?$/.exec(lines[i]);
    if (m) return Number(m[1]);
  }
  return null;
}

/** The latest moment (epoch ms) the job leaves to a build that started at `jobStart`, or null. */
export function jobDeadline(jobStart, timeoutMinutes) {
  return positive(jobStart) && positive(timeoutMinutes) && timeoutMinutes > JOB_RESERVE_MINUTES
    ? jobStart + (timeoutMinutes - JOB_RESERVE_MINUTES) * 60000
    : null;
}

/**
 * The clock of the build in `dir`, or null when there is no running build to stop: no folder, no phase announced, no
 * limit known, an outcome already recorded, or a hard stop long gone.
 *   fallbackMinutes  the limit to use when the folder keeps none
 * Returns { soft, hard, maxMinutes } with `soft` and `hard` in epoch milliseconds.
 */
export function runClock({ dir, fallbackMinutes = null, now = Date.now() }) {
  try {
    if (!dir) return null;
    const phases = readPhaseLog(dir);
    if (!phases.length || readClass(dir)) return null;
    const stored = readStored(dir);
    const maxMinutes = positive(stored.run_max_minutes) ?? positive(fallbackMinutes);
    if (!maxMinutes) return null;
    const soft = phases[0].at + maxMinutes * 60000;
    const margin = soft + HARD_STOP_MARGIN_MINUTES * 60000;
    const hard = positive(stored.job_deadline) ? Math.min(margin, stored.job_deadline) : margin;
    return now - hard > STALE_MS ? null : { soft: Math.min(soft, hard), hard, maxMinutes };
  } catch {
    return null;
  }
}

// When each phase of a run began, kept in a file local to the run (under the progress folder, never in the working
// tree), and the class of the outcome. They feed the usage record: the seconds each phase took with its attempt, and
// how the run ended. Implements "The usage record carries the phases and the class of the outcome" of the go specification.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OUTCOME_CLASSES = ['built', 'inputs', 'policy', 'qa-non-fixable', 'qa-fixable-after-retries', 'conflict', 'limit', 'other'];

export const LENSES = ['spec', 'security', 'code', 'interface'];

const LOG = 'phases.jsonl';
const LENS_LOG = 'lenses.jsonl';
const whole = (v) => (Number.isInteger(v) && v > 0 ? v : null);

/** Appends the phase that begins now, unless it is the one already running (the same phase and attempt). */
export function recordPhase(dir, { phase, attempt = null, of = null }, now = Date.now()) {
  const entries = readPhaseLog(dir);
  const last = entries[entries.length - 1];
  if (last && last.phase === phase && last.attempt === whole(attempt)) return false;
  appendFileSync(join(dir, LOG), `${JSON.stringify({ phase, attempt: whole(attempt), of: whole(of), at: now })}\n`);
  return true;
}

/** The recorded phases in order; a line that is not valid is skipped. */
export function readPhaseLog(dir) {
  const file = dir ? join(dir, LOG) : null;
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((line) => {
    try {
      const e = JSON.parse(line);
      return typeof e.phase === 'string' && Number.isFinite(e.at) ? { phase: e.phase, attempt: whole(e.attempt), of: whole(e.of), at: e.at } : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/** [{ name, attempt, seconds }]: each phase lasts until the next begins, the last until `endMs`. */
export function phaseSeconds(entries, endMs) {
  return entries.map((e, i) => {
    const until = i + 1 < entries.length ? entries[i + 1].at : endMs;
    return { name: e.phase, ...(e.attempt ? { attempt: e.attempt } : {}), seconds: Math.max(0, Math.round((until - e.at) / 1000)) };
  });
}

export function writeClass(dir, outcomeClass) {
  if (!OUTCOME_CLASSES.includes(outcomeClass)) return false;
  writeFileSync(join(dir, 'class'), outcomeClass);
  return true;
}

/** The class `go` wrote, or null. */
export function readClass(dir) {
  try {
    const value = readFileSync(join(dir, 'class'), 'utf8').trim();
    return OUTCOME_CLASSES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Appends the lens that `go` launches now. The lenses have a log of their own, apart from the phases: they are not
 * phases of the run, and the progress comment and the daily digest know only the five phases.
 */
export function recordLens(dir, { lens, attempt = null }, now = Date.now()) {
  if (!LENSES.includes(lens)) return false;
  appendFileSync(join(dir, LENS_LOG), `${JSON.stringify({ lens, attempt: whole(attempt), at: now })}\n`);
  return true;
}

/** The recorded lenses in order; a line that is not valid is skipped. */
export function readLensLog(dir) {
  const file = dir ? join(dir, LENS_LOG) : null;
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((line) => {
    try {
      const e = JSON.parse(line);
      return LENSES.includes(e.lens) && Number.isFinite(e.at) ? { lens: e.lens, attempt: whole(e.attempt), at: e.at } : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * [{ name, attempt, seconds }]: a lens lasts until the next lens begins or the next phase is announced, whichever comes
 * first, and the last one until `endMs`. The seconds include the receipt check that precedes the lens after it.
 */
export function lensSeconds(lenses, phases, endMs) {
  return lenses.map((e, i) => {
    const ends = [endMs];
    if (i + 1 < lenses.length) ends.push(lenses[i + 1].at);
    const phase = phases.find((p) => p.at > e.at);
    if (phase) ends.push(phase.at);
    return { name: e.lens, ...(e.attempt ? { attempt: e.attempt } : {}), seconds: Math.max(0, Math.round((Math.min(...ends) - e.at) / 1000)) };
  });
}

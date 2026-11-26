// The marker of a build that was resumed and stopped again at a limit without finishing a task. Implements "A resume that finishes no
// task stops the loop" of the go specification.
//
// The comment of that stop carries `<!-- relevo:stalled {"turns":..,"minutes":..,"cost":..} -->` with the limits that were in force. The
// planner reads it from the last failure comment of a bot (a person who types a marker changes nothing) and refuses another resume until
// a limit of `relevo.yml` is higher (resume-gate.mjs). A newer failure comment has no marker, so a resume that did progress blocks nothing.
// The marker is built here from checked numbers, never from the text of the data.

import { HEADING } from './failure-comment.mjs';

const MARKER_RE = /<!-- relevo:stalled (\{[^\n]*?\}) -->/g;
const good = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** The marker for the limits in force. Throws when one is not a positive number. */
export function stalledMarker({ turns, minutes, cost }) {
  if (![turns, minutes, cost].every(good)) throw new Error('the stalled marker needs the turns, the minutes and the cost limits as positive numbers');
  return `<!-- relevo:stalled ${JSON.stringify({ turns, minutes, cost })} -->`;
}

/** The limits recorded by the last failure comment of a bot, or null (no marker, not a bot, not exactly one marker, a bad field). */
export function latestStalled(comments) {
  const list = Array.isArray(comments) ? comments : [];
  const last = [...list].reverse().find((c) => c?.user?.type === 'Bot' && HEADING.test(String(c.body ?? '').split('\n')[0]));
  if (!last) return null;
  const found = [...String(last.body ?? '').matchAll(MARKER_RE)];
  if (found.length !== 1) return null;
  let data;
  try {
    data = JSON.parse(found[0][1]);
  } catch {
    return null;
  }
  return [data?.turns, data?.minutes, data?.cost].every(good) ? { turns: data.turns, minutes: data.minutes, cost: data.cost } : null;
}

/**
 * Did a resumed run stop at a limit with no task finished? Unknown counts are never taken for a stall.
 *   resumed       whether the run continued from a branch
 *   doneAtStart   tasks of tasks.md checked when it started; doneAtEnd, when it stopped
 */
export function madeNoProgress({ resumed, reason, doneAtStart, doneAtEnd }) {
  if (resumed !== true || reason !== 'run limit reached') return false;
  if (!Number.isInteger(doneAtStart) || !Number.isInteger(doneAtEnd)) return false;
  return doneAtEnd <= doneAtStart;
}

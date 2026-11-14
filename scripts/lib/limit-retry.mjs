// What happens to an issue whose run stopped at a usage limit. Implements the capability `usage-limit-retry`.
// The retry time travels in a hidden marker of the comment that says when the issue will retry; the planner reads it to hold the
// issue and the final step of the go workflow reads it to count the retries.

import { limitReset } from './run-usage.mjs';

/** Minutes to wait before retry 1, 2 and 3 when the log does not say when the quota resets. The last is the shortest window the log names (5 hours). */
export const BACKOFF_MINUTES = [30, 120, 300];
/** How many times an issue goes back to the queue after a usage limit before a person is asked. */
export const MAX_RETRIES = BACKOFF_MINUTES.length;
/** A marker older than this is an earlier episode: it does not count toward the bound. */
export const EPISODE_MS = 24 * 3600 * 1000;
/** A known reset time is trusted to the minute: the retry starts one minute after it. */
export const RESET_MARGIN_MS = 60 * 1000;
/** The rescue states that leave the work safe (on the branch, or there was none): only these may retry. */
export const SAFE_RESCUE = ['kept', 'nothing'];

const MARKER_RE = /<!-- relevo:retry (\{[^\n]*?\}) -->/g;

/** The hidden marker for a comment: the retry time (ms since the epoch), the retry number and why that time. */
export function retryMarker({ at, attempt, reason }) {
  return `<!-- relevo:retry ${JSON.stringify({ at: new Date(at).toISOString(), attempt, reason })} -->`;
}

/**
 * The marker of one comment, or null. Only a comment of a bot counts, with exactly one marker whose fields are well formed
 * (a person who types a marker changes nothing). `created_at` travels with it for the 24-hour window.
 */
export function parseRetryMarker(comment) {
  if (comment?.user?.type !== 'Bot') return null;
  const found = [...String(comment.body ?? '').matchAll(MARKER_RE)];
  if (found.length !== 1) return null;
  let data;
  try {
    data = JSON.parse(found[0][1]);
  } catch {
    return null;
  }
  const at = typeof data?.at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(data.at) ? Date.parse(data.at) : NaN;
  if (!Number.isFinite(at) || !Number.isInteger(data.attempt) || data.attempt < 1 || data.attempt > MAX_RETRIES) return null;
  if (data.reason !== 'reset' && data.reason !== 'backoff') return null;
  const created = Date.parse(comment.created_at ?? '');
  return { at, attempt: data.attempt, reason: data.reason, created: Number.isFinite(created) ? created : null };
}

/** The last valid marker among the comments of an issue (oldest first, as GitHub lists them), or null. */
export function latestRetry(comments) {
  const list = (Array.isArray(comments) ? comments : []).map(parseRetryMarker).filter(Boolean);
  return list.length ? list[list.length - 1] : null;
}

/** The retries already made in this episode: the number of the last marker, or 0 when there is none or it is older than 24 hours. */
export function priorRetries(comments, now = Date.now()) {
  const last = latestRetry(comments);
  return last && last.created !== null && now - last.created <= EPISODE_MS ? last.attempt : 0;
}

/**
 * What to do with an issue whose run ended at a usage limit: { action: 'retry', at, reason, attempt, max } or
 * { action: 'stop', reason, attempt? }. `at` is the retry time in ms since the epoch.
 * A retry needs the work to be safe (`rescueState` kept or nothing), the comments to have been read (`comments` is an array) and
 * fewer than 3 retries already made. The time is the reset time of the log plus a minute when the log has a credible one, and
 * otherwise a back-off that grows with each retry: it is never guessed from anything else.
 */
export function decideRetry({ log, comments, rescueState, now = Date.now() }) {
  if (!SAFE_RESCUE.includes(rescueState)) return { action: 'stop', reason: 'work_not_kept' };
  if (!Array.isArray(comments)) return { action: 'stop', reason: 'unreadable' };
  const prior = priorRetries(comments, now);
  if (prior >= MAX_RETRIES) return { action: 'stop', reason: 'bound', attempt: prior, max: MAX_RETRIES };
  const attempt = prior + 1;
  const reset = limitReset(log, now);
  return reset !== null
    ? { action: 'retry', at: reset + RESET_MARGIN_MS, reason: 'reset', attempt, max: MAX_RETRIES }
    : { action: 'retry', at: now + BACKOFF_MINUTES[attempt - 1] * 60 * 1000, reason: 'backoff', attempt, max: MAX_RETRIES };
}

/** An issue state `limit_retry` as the planner reads it from the comments: { at, attempt, reason } or null. */
export function retryState(comments) {
  const last = latestRetry(comments);
  return last ? { at: last.at, attempt: last.attempt, reason: last.reason } : null;
}

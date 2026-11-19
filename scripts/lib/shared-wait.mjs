// The hidden marker of the comment that says an issue waits for a file shared with another issue.
// Implements "The wait for a shared file has a bound" of openspec/specs/go/spec.md: the time of the marker is when the
// wait began, so the planner needs no state of its own.

const MARKER_RE = /<!--\s*relevo:shared-wait\s+file=(\S+)\s+issue=(\d+)\s*-->/;

/** The marker for a wait on `file` because of issue `other`. */
export function sharedWaitMarker(file, other) {
  return `<!-- relevo:shared-wait file=${encodeURIComponent(file)} issue=${other} -->`;
}

/** The marker in a comment body, as { file, other }, or null. */
export function readSharedWaitMarker(body) {
  const m = String(body ?? '').match(MARKER_RE);
  if (!m) return null;
  try {
    return { file: decodeURIComponent(m[1]), other: Number.parseInt(m[2], 10) };
  } catch {
    return null;
  }
}

/** The last marker in the timeline of an issue, as { file, other, at }, or null: it is the wait that began last. */
export function lastSharedWait(timeline) {
  let found = null;
  (timeline ?? []).forEach((event) => {
    if (event.event !== 'commented') return;
    const marker = readSharedWaitMarker(event.body);
    if (marker) found = { ...marker, at: event.created_at ?? null };
  });
  return found;
}

// Queue re-evaluation. Implements "Queue re-evaluation" of openspec/specs/go/spec.md.
// The planner decides; this module only says which issues may be handed to a build run now.

/**
 * The decisions the queue is responsible for: those about issues that are already waiting (`queued` or `blocked`).
 * An issue that has just been marked `ready` belongs to the `go` workflow that the label itself started; if the
 * queue acted on it too, both would apply the same decision (a duplicated comment) or dispatch the same build.
 */
export function ownedByQueue(decisions, issues, names) {
  const waiting = new Set(issues.filter((i) => i.labels.includes(names.queued) || i.labels.includes(names.blocked)).map((i) => i.number));
  return decisions.filter((d) => waiting.has(d.issue));
}

/** Issue numbers whose decision is `start`, oldest first (the planner already sorted them). */
export function startable(decisions) {
  return decisions.filter((d) => d.action === 'start').map((d) => d.issue);
}

/** The unattended runs to dispatch: one per startable issue, never more than the free slots. */
export function toDispatch(decisions, { alreadyRunning = 0, limit }) {
  const free = Math.max(0, limit - alreadyRunning);
  return startable(decisions).slice(0, free);
}

/** The seconds to wait between two dispatches, so that the builds that start together do not reach the quota at once: 60, less when the whole dispatch would last over 5 minutes, and none for one build. */
export function staggerSeconds(count) {
  if (!Number.isInteger(count) || count <= 1) return 0;
  return Math.min(60, Math.floor(300 / (count - 1)));
}

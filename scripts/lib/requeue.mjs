// Queue re-evaluation. Implements "Queue re-evaluation" of openspec/specs/go/spec.md.
// The planner decides; this module only says which issues may be handed to a build run now.

// How old a `go` label must be before the queue takes it as unanswered: the `decide` job of the go workflow has a timeout of 10
// minutes, so a request older than this was not answered (the cloud was paused, or the run was lost).
export const UNANSWERED_MS = 15 * 60 * 1000;

/**
 * The decisions the queue is responsible for: those about issues that are already waiting (`queued` or `blocked`), and those about
 * a `ready` issue whose `go` label is older than 15 minutes, a request that nobody answered. A request that has just been made belongs
 * to the `go` workflow that the label itself started; if the queue acted on it too, both would apply the same decision (a duplicated
 * comment) or dispatch the same build. A `ready` issue with no `go` label is approved and waits for a decision: the queue leaves it.
 */
export function ownedByQueue(decisions, issues, names, now = Date.now()) {
  const unanswered = (i) => i.labels.includes(names.ready) && i.labels.includes(names.go)
    && Boolean(i.go_at) && now - Date.parse(i.go_at) > UNANSWERED_MS;
  const owned = new Set(issues
    .filter((i) => i.labels.includes(names.queued) || i.labels.includes(names.blocked) || unanswered(i))
    .map((i) => i.number));
  return decisions.filter((d) => owned.has(d.issue));
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

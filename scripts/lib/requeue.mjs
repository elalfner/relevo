// Queue re-evaluation. Implements "Queue re-evaluation" of openspec/changes/relevo-v1/specs/go/spec.md.
// The planner decides; this module only says which issues may be handed to a build run now.

/** Issue numbers whose decision is `start`, oldest first (the planner already sorted them). */
export function startable(decisions) {
  return decisions.filter((d) => d.action === 'start').map((d) => d.issue);
}

/** The unattended runs to dispatch: one per startable issue, never more than the free slots. */
export function toDispatch(decisions, { alreadyRunning = 0, limit }) {
  const free = Math.max(0, limit - alreadyRunning);
  return startable(decisions).slice(0, free);
}

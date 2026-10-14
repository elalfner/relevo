// Label set and state transitions.
// Implements openspec/changes/relevo-v1/specs/issue-lifecycle/spec.md.

// kind:
//   state   - lifecycle label; exactly one of the exclusive labels at a time
//   exit    - side exit that replaces the lifecycle label
//   overlay - added next to the current state, never replaces it
export const LABELS = [
  { key: 'ready', name: 'relevo:ready', color: '0e8a16', kind: 'state', description: 'Spec is finished; the agent may start' },
  { key: 'queued', name: 'relevo:queued', color: 'c5def5', kind: 'state', description: 'Waiting for capacity' },
  { key: 'building', name: 'relevo:building', color: 'fbca04', kind: 'state', description: 'The agent is building it' },
  { key: 'built', name: 'relevo:built', color: '1d76db', kind: 'state', description: 'Built and QA passed; waiting for the assignee' },
  { key: 'in-review', name: 'relevo:in-review', color: '5319e7', kind: 'state', description: 'Being reviewed on a device' },
  { key: 'pr-open', name: 'relevo:pr-open', color: '0075ca', kind: 'state', description: 'Pull request open; waiting for the peer' },
  { key: 'needs-spec', name: 'relevo:needs-spec', color: 'd93f0b', kind: 'exit', description: 'Spec is incomplete or defective; back to the spec writer' },
  { key: 'blocked', name: 'relevo:blocked', color: 'b60205', kind: 'exit', description: 'Waiting for a dependency to merge' },
  { key: 'qa-failed', name: 'relevo:qa-failed', color: 'e11d21', kind: 'exit', description: 'QA still rejected after the retries; branch is pushed' },
  { key: 'changes-requested', name: 'relevo:changes-requested', color: 'f9d0c4', kind: 'exit', description: 'The reviewer asked for changes' },
  { key: 'needs-reviewer', name: 'relevo:needs-reviewer', color: 'fef2c0', kind: 'overlay', description: 'No reviewer available or the review is overdue' },
];

export const LABEL_KEYS = LABELS.map((l) => l.key);

const EXCLUSIVE_KEYS = LABELS.filter((l) => l.kind !== 'overlay').map((l) => l.key);

/** Map each label key to its effective name, applying the `labels` overrides of relevo.yml. */
export function resolveLabelNames(overrides = {}) {
  const names = {};
  LABELS.forEach((l) => {
    names[l.key] = overrides[l.key] ?? l.name;
  });
  return names;
}

/** Label definitions with effective names, for creating labels in a repository. */
export function labelDefinitions(overrides = {}) {
  const names = resolveLabelNames(overrides);
  return LABELS.map((l) => ({ ...l, name: names[l.key] }));
}

/**
 * Compute the label changes needed to move an issue to `toKey`.
 * - state/exit labels are exclusive: moving to one removes any other exclusive label.
 * - overlay labels are only added.
 * Returns { add: [names], remove: [names] } using effective label names.
 */
export function transition(currentNames, toKey, overrides = {}) {
  if (!LABEL_KEYS.includes(toKey)) throw new Error(`unknown label key "${toKey}"`);
  const names = resolveLabelNames(overrides);
  const current = new Set(currentNames);
  const target = names[toKey];
  if (!EXCLUSIVE_KEYS.includes(toKey)) {
    return { add: current.has(target) ? [] : [target], remove: [] };
  }
  const remove = EXCLUSIVE_KEYS.filter((k) => k !== toKey)
    .map((k) => names[k])
    .filter((n) => current.has(n));
  return { add: current.has(target) ? [] : [target], remove };
}

/** Labels to remove when the issue is finished (every Relevo label). */
export function clearAll(currentNames, overrides = {}) {
  const names = new Set(Object.values(resolveLabelNames(overrides)));
  return { add: [], remove: currentNames.filter((n) => names.has(n)) };
}

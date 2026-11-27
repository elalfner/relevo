// Label set and state transitions.
// Implements openspec/specs/issue-lifecycle/spec.md.

// The description of a state, an exit and needs-reviewer says what it is and the next step of next-step.mjs, in at most 100
// characters (the limit of GitHub); tests/labels.test.mjs holds it to that table.
//
// kind:
//   state   - lifecycle label; exactly one of the exclusive labels at a time
//   exit    - side exit that replaces the lifecycle label
//   overlay - added next to the current state, never replaces it
export const LABELS = [
  { key: 'ready', name: 'relevo:ready', color: '0e8a16', kind: 'state', description: 'Spec ready. Next: /relevo:go <n>, or apply the go label; approving starts nothing' },
  { key: 'queued', name: 'relevo:queued', color: 'c5def5', kind: 'state', description: 'Waiting for capacity, a free agent and no file clash. Nothing to do' },
  { key: 'building', name: 'relevo:building', color: 'fbca04', kind: 'state', description: 'The agent is building it. Nothing to do' },
  { key: 'built', name: 'relevo:built', color: '1d76db', kind: 'state', description: 'Built and QA passed. Next: /relevo:review <n>, to review it on a device' },
  { key: 'in-review', name: 'relevo:in-review', color: '5319e7', kind: 'state', description: 'Being reviewed. Next: /relevo:review <n> to continue; if something fails, /relevo:fix <n>' },
  { key: 'pr-open', name: 'relevo:pr-open', color: '0075ca', kind: 'state', description: 'Pull request open. Next: /relevo:ship <n>, once someone else approves it' },
  { key: 'needs-spec', name: 'relevo:needs-spec', color: 'd93f0b', kind: 'exit', description: 'The spec needs work. Next: /relevo:issue <n>; the comment says the rest' },
  { key: 'blocked', name: 'relevo:blocked', color: 'b60205', kind: 'exit', description: 'Waiting for the issues it depends on to be merged. Nothing to do' },
  { key: 'build-failed', name: 'relevo:build-failed', color: 'e11d21', kind: 'exit', description: 'Build failed. Next: /relevo:go <n> --resume or /relevo:fix <n>; the comment says which' },
  { key: 'changes-requested', name: 'relevo:changes-requested', color: 'f9d0c4', kind: 'exit', description: 'The reviewer asked for changes. Next: /relevo:fix <n>' },
  { key: 'needs-reviewer', name: 'relevo:needs-reviewer', color: 'fef2c0', kind: 'overlay', description: 'No reviewer or review overdue. Next: the spec writer assigns one or asks someone; no command' },
  // A request, not a state: the ship workflow merges the pull request and always removes it.
  { key: 'ship', name: 'relevo:ship', color: '2ea44f', kind: 'overlay', description: 'Ship it: merge the approved pull request on GitHub' },
  // A request, not a state: start it before the others and without waiting for the assignee's review capacity.
  { key: 'urgent', name: 'relevo:urgent', color: 'ff7b00', kind: 'overlay', description: 'Start it first, even if the assignee has built issues waiting for review' },
  // A request, not a state: the cloud builds an approved issue; removed by the first decision of the cloud, whatever it is.
  { key: 'go', name: 'relevo:go', color: '0b6623', kind: 'overlay', description: 'Build it in the cloud: a request on a ready issue, removed when the cloud decides' },
  // A mark next to `building`: the build runs on a person's machine. Applied by the claim of a local build, removed when the issue leaves `building`.
  { key: 'local', name: 'relevo:local', color: 'bfd4f2', kind: 'overlay', description: 'Being built on a machine; applied by a local build, not by hand' },
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
 * - overlay labels are only added, except `local`: it marks a local build, so a move to any exclusive label other
 *   than `building` also removes it. A move to `building` does not add it: the claim of a local build does.
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
  const remove = [...EXCLUSIVE_KEYS.filter((k) => k !== toKey), ...(toKey === 'building' ? [] : ['local'])]
    .map((k) => names[k])
    .filter((n) => current.has(n));
  return { add: current.has(target) ? [] : [target], remove };
}

/** Labels to remove when the issue is finished (every Relevo label). */
export function clearAll(currentNames, overrides = {}) {
  const names = new Set(Object.values(resolveLabelNames(overrides)));
  return { add: [], remove: currentNames.filter((n) => names.has(n)) };
}

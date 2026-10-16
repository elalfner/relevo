// Which state an issue returns to after a successful fix.
// Implements "State is preserved" of openspec/specs/fix/spec.md.

import { LABELS, resolveLabelNames, transition } from './labels.mjs';

// state before the fix -> state after, and who is told
const OUTCOMES = {
  'in-review': { to: 'in-review', notify: null },
  built: { to: 'built', notify: null },
  'qa-failed': { to: 'built', notify: 'assignee' },
  'changes-requested': { to: 'pr-open', notify: 'reviewer' },
  'pr-open': { to: 'pr-open', notify: null },
};

const STATE_KEYS = LABELS.filter((l) => l.kind !== 'overlay').map((l) => l.key);

/**
 * Work out what a fix does to an issue's labels.
 * Returns { allowed, from, to, notify, labels } or { allowed: false, from, reason }.
 */
export function fixOutcome(currentNames, overrides = {}) {
  const names = resolveLabelNames(overrides);
  const from = STATE_KEYS.find((k) => currentNames.includes(names[k])) ?? null;
  if (!from) return { allowed: false, from, reason: 'the issue has no Relevo state label, so there is nothing to fix yet' };
  const outcome = OUTCOMES[from];
  if (!outcome) {
    return { allowed: false, from, reason: `a fix needs a branch with work to correct; the issue is "${from}" (go or the spec writer comes first)` };
  }
  const labels = outcome.to === from ? { add: [], remove: [] } : transition(currentNames, outcome.to, overrides);
  return { allowed: true, from, to: outcome.to, notify: outcome.notify, labels };
}

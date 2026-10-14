// State of one on-device review, and the rule that decides whether a pull request may be opened.
// Implements "Pull request only after verification" of openspec/changes/relevo-v1/specs/review/spec.md.

export const STATUSES = ['pending', 'ok', 'fail'];

export function newState(items) {
  return {
    items: items.map((i) => ({ id: i.id, title: i.title, status: 'pending', note: null })),
    captures: [],
    audit: null,
    agreed: false,
  };
}

/**
 * Reconcile the checklist after a fix changed the specification and the code.
 * Lines that were confirmed stay confirmed; lines that failed go back to pending so they are tested again;
 * new scenarios are added as pending. The log audit and the person's agreement no longer apply to the new code.
 */
export function syncState(state, items) {
  const before = new Map(state.items.map((i) => [i.title, i]));
  state.items = items.map((i) => {
    const old = before.get(i.title);
    const keep = old && old.status === 'ok';
    return { id: i.id, title: i.title, status: keep ? 'ok' : 'pending', note: null };
  });
  state.audit = null;
  state.agreed = false;
  return state;
}

export function setItem(state, id, status, note = null) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new Error(`there is no checklist item ${id}`);
  item.status = status;
  item.note = note;
  return state;
}

/**
 * May the pull request be opened? Only when the log audit passed, every checklist line is confirmed
 * working by the person, and the person agrees. Returns { open, reasons }.
 */
export function decidePr(state) {
  const reasons = [];
  if (!state.audit) reasons.push('the log audit has not run');
  else if (state.audit.verdict !== 'REVIEW PASSED') reasons.push('the log audit found problems');
  state.items.forEach((i) => {
    if (i.status === 'pending') reasons.push(`checklist item ${i.id} ("${i.title}") is not confirmed yet`);
    if (i.status === 'fail') reasons.push(`checklist item ${i.id} ("${i.title}") failed${i.note ? `: ${i.note}` : ''}`);
  });
  if (state.items.length === 0) reasons.push('there are no scenarios to verify');
  if (!state.agreed) reasons.push('the person has not agreed to open the pull request');
  return { open: reasons.length === 0, reasons };
}

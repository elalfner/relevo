// State of one on-device review, and the rule that decides whether a pull request may be opened.
// Implements "Pull request only after verification" of openspec/specs/review/spec.md.

export const STATUSES = ['pending', 'ok', 'fail'];

const same = (a, b) => a.class === b.class && a.excerpt === b.excerpt;

export function newState(items) {
  return {
    items: items.map((i) => ({ id: i.id, title: i.title, status: 'pending', note: null })),
    captures: [],
    audit: null,
    waivers: [],
    agreed: false,
  };
}

/**
 * Waive the n-th finding of the audit (numbered from 1, as the audit prints them) with a written reason.
 * Only the person calls this; an inconclusive audit and an empty reason are refused.
 * Returns the state with the verdict recomputed.
 */
export function waiveFinding(state, number, reason) {
  const why = String(reason ?? '').trim();
  if (!state.audit) throw new Error('the log audit has not run: there is nothing to waive');
  if (state.audit.verdict === 'REVIEW INCONCLUSIVE') throw new Error('an inconclusive audit cannot be waived: restart the app and repeat the steps');
  if (!why) throw new Error('a waiver needs a written reason: waive <number> <reason>');
  const finding = state.audit.findings[Number(number) - 1];
  if (!finding) throw new Error(`there is no finding ${number} in the audit (it has ${state.audit.findings.length})`);
  state.waivers ??= [];
  if (!state.waivers.some((w) => same(w, finding))) state.waivers.push({ class: finding.class, excerpt: finding.excerpt, reason: why });
  return applyWaivers(state);
}

/** Mark the findings that match a waiver and recompute the verdict: all waived is "REVIEW PASSED (with waivers)". */
export function applyWaivers(state) {
  const audit = state.audit;
  if (!audit || audit.verdict === 'REVIEW INCONCLUSIVE') return state;
  audit.findings.forEach((f) => {
    const w = (state.waivers ?? []).find((x) => same(x, f));
    if (w) {
      f.waived = true;
      f.reason = w.reason;
    } else {
      delete f.waived;
      delete f.reason;
    }
  });
  if (audit.findings.length > 0) audit.verdict = audit.findings.every((f) => f.waived) ? 'REVIEW PASSED (with waivers)' : 'REVIEW REJECTED';
  return state;
}

/** The markdown section of the pull request body and the report for the waived findings; empty when there are none. */
export function waivedSection(state) {
  const waived = (state.audit?.findings ?? []).filter((f) => f.waived);
  if (waived.length === 0) return '';
  return ['## Waived findings', '', ...waived.map((f) => `- **${f.class}**: \`${f.excerpt.replace(/`/g, "'")}\` — waived by the reviewer: ${f.reason}`), ''].join('\n');
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
  state.waivers = [];
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
  else if (state.audit.verdict === 'REVIEW INCONCLUSIVE') reasons.push('the log audit was inconclusive: it had no log of the app to judge, so it proves nothing');
  else if (!['REVIEW PASSED', 'REVIEW PASSED (with waivers)'].includes(state.audit.verdict)) reasons.push('the log audit found problems');
  state.items.forEach((i) => {
    if (i.status === 'pending') reasons.push(`checklist item ${i.id} ("${i.title}") is not confirmed yet`);
    if (i.status === 'fail') reasons.push(`checklist item ${i.id} ("${i.title}") failed${i.note ? `: ${i.note}` : ''}`);
  });
  if (state.items.length === 0) reasons.push('there are no scenarios to verify');
  if (!state.agreed) reasons.push('the person has not agreed to open the pull request');
  return { open: reasons.length === 0, reasons };
}

// State of one on-device review, and the rule that decides whether a pull request may be opened.
// Implements "Pull request only after verification" of openspec/specs/review/spec.md.

import { createHash } from 'node:crypto';

export const STATUSES = ['pending', 'ok', 'fail'];

const same = (a, b) => a.class === b.class && a.excerpt === b.excerpt;

export const AUTOPILOT_MODES = ['off', 'precheck', 'verify'];

export function newState(items, { autopilot = 'off' } = {}) {
  if (!AUTOPILOT_MODES.includes(autopilot)) throw new Error(`autopilot must be one of ${AUTOPILOT_MODES.join(', ')}`);
  return {
    autopilot,
    envConfirmed: false,
    items: items.map((i) => ({ id: i.id, title: i.title, status: 'pending', note: null, precheck: null, auto: null })),
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
    // A line confirmed by the person stays; one the agent verified automatically does not: the code under it changed.
    const keep = old && old.status === 'ok' && !old.auto;
    return { id: i.id, title: i.title, status: keep ? 'ok' : 'pending', note: null, precheck: null, auto: null };
  });
  state.audit = null;
  state.waivers = [];
  state.agreed = false;
  // The code changed, so the review script must be read by QA again.
  state.qaScript = null;
  return state;
}

export function setItem(state, id, status, note = null) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new Error(`there is no checklist item ${id}`);
  item.status = status;
  item.note = note;
  // What the person decides replaces what the agent recorded: a confirmation is theirs, a failure or a retest starts again.
  item.auto = null;
  if (status !== 'ok') item.precheck = null;
  return state;
}

/**
 * Throws unless the agent may drive the review: autopilot is not off and the person confirmed the data.
 * With `open`, the review must also not be agreed yet (the browser runner asks for it).
 */
export function assertDriving(state, { open = false } = {}) {
  const mode = state.autopilot ?? 'off';
  if (mode === 'off') throw new Error('the agent does not drive the review: review.autopilot is "off"');
  if (!state.envConfirmed) throw new Error('the person has not confirmed in writing that the app points to non-production data: run "confirm-env" after they do');
  if (open && state.agreed) throw new Error('the review is closed: the person already agreed to open the pull request');
  return mode;
}

/** The sha256 of a review script, as `qa-pass` records it and the runner compares it. */
export const scriptHash = (text) => createHash('sha256').update(String(text)).digest('hex');

/** QA passed this exact script; any later change to it needs a new pass. */
export function qaPass(state, path, text) {
  state.qaScript = { path, sha256: scriptHash(text) };
  return state;
}

/** Record a screenshot that was taken. Captures belong to the open review, so one after the agreement is refused. */
export function recordCapture(state, path) {
  if (state.agreed) throw new Error('the review is closed: captures are taken while the person tests, before the agreement');
  state.captures ??= [];
  if (!state.captures.includes(path)) state.captures.push(path);
  return state;
}

/** The person confirmed that the app under review does not point to production data. */
export function confirmEnv(state) {
  state.envConfirmed = true;
  return state;
}

/** The agent's own result for a line, apart from the person's confirmation. Modes precheck and verify only. */
export function precheckItem(state, id, result, note = null) {
  assertDriving(state);
  if (!['ok', 'fail'].includes(result)) throw new Error('a pre-check result is ok or fail');
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new Error(`there is no checklist item ${id}`);
  item.precheck = result;
  if (note) item.note = note;
  return state;
}

/** The agent marks a line as verified automatically, saying how. Mode verify only; the line becomes ok but stays labelled. */
export function autoItem(state, id, how) {
  const mode = assertDriving(state);
  if (mode !== 'verify') throw new Error(`a line can be verified automatically only when review.autopilot is "verify" (it is "${mode}")`);
  const why = String(how ?? '').trim();
  if (!why) throw new Error('say how the line was verified: auto <number> <the assertion, finder or log that proved it>');
  const item = state.items.find((i) => i.id === id);
  if (!item) throw new Error(`there is no checklist item ${id}`);
  item.status = 'ok';
  item.precheck = 'ok';
  item.auto = why;
  return state;
}

/** The "Verified automatically" section of the pull request body; empty when no line was. */
export function autoSection(state) {
  const lines = state.items.filter((i) => i.auto);
  if (lines.length === 0) return '';
  return ['## Verified automatically', '', ...lines.map((i) => `- ${i.id}. ${i.title}: ${i.auto}`), ''].join('\n');
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

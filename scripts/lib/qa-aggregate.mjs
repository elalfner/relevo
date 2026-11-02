// Decides the result of the QA lenses, in a script that fails closed. Implements "A script decides the result and it fails
// closed" and "The interface lens advises on the last attempt" of the qa-lenses specification.

import { ALWAYS } from './lens-plan.mjs';

export const CLASSES = ['fixable', 'input', 'spec', 'policy'];
const CLASS_RE = /^\s*(?:\*\*)?Class(?:\*\*)?\s*[:=]\s*`?([A-Za-z]+)`?/i;
const FINDING_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const DEVICE_HEADING_RE = /^\s*(?:#{1,6}\s*|\*\*)?Left for on-device review\b/i;

/** The first non-blank line of a report is exactly QA PASSED or QA REJECTED: returns 'PASSED', 'REJECTED' or null. */
export function verdictOf(text) {
  const first = String(text ?? '').split('\n').find((l) => l.trim() !== '');
  if (first === undefined) return null;
  const t = first.trim();
  return t === 'QA PASSED' ? 'PASSED' : t === 'QA REJECTED' ? 'REJECTED' : null;
}

/** { verdict, findings: [{ number, class, text }], device: [text] }. A finding without a valid class is `fixable`. */
export function parseReport(text) {
  const verdict = verdictOf(text);
  const findings = [];
  const device = [];
  let inDevice = false;
  let current = null;
  String(text ?? '').split('\n').slice(1).forEach((line) => {
    if (DEVICE_HEADING_RE.test(line)) { inDevice = true; current = null; return; }
    const item = FINDING_RE.exec(line);
    if (inDevice) {
      const bullet = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (bullet && bullet[1].trim().toLowerCase() !== 'none') device.push(bullet[1].trim());
      return;
    }
    if (item) { current = { number: Number(item[1]), class: 'fixable', text: item[2].trim() }; findings.push(current); return; }
    const cls = CLASS_RE.exec(line);
    if (cls && current) current.class = CLASSES.includes(cls[1].toLowerCase()) ? cls[1].toLowerCase() : 'fixable';
  });
  return { verdict, findings: verdict === 'REJECTED' ? findings : [], device };
}

/**
 * reports   { [lens]: text | null } for every active lens
 * plan      the output of planLenses
 * attempt   the number of this attempt (1 is the first)
 * retries   qa.retries; the last attempt is retries + 1
 * reasked   the lenses whose report was already asked for a second time
 * Returns { result, action, lenses, findings, advisory, invalid, reason }.
 *   action: 'done' | 'reask' (ask these lenses again, once) | 'stop' (a second invalid report: "lens report invalid")
 */
export function aggregate({ reports, plan, attempt, retries, reasked = [] }) {
  const last = retries === 0 || attempt >= retries + 1;
  const lenses = {};
  const findings = [];
  const advisory = [];
  const invalid = [];
  plan.forEach((p) => {
    if (!p.active) { lenses[p.lens] = { status: 'SKIPPED', reason: p.reason }; return; }
    const parsed = parseReport(reports[p.lens]);
    if (parsed.verdict === null) { invalid.push(p.lens); lenses[p.lens] = { status: 'INVALID' }; return; }
    const blocks = ALWAYS.includes(p.lens) || !last;
    lenses[p.lens] = { status: parsed.verdict, blocking: blocks, findings: parsed.findings.length };
    if (parsed.verdict === 'REJECTED') {
      if (blocks) parsed.findings.forEach((f) => findings.push({ lens: p.lens, ...f }));
      else parsed.findings.forEach((f) => advisory.push({ lens: p.lens, kind: 'finding', text: f.text }));
    }
    parsed.device.forEach((text) => advisory.push({ lens: p.lens, kind: 'device', text }));
  });
  if (invalid.length) {
    const again = invalid.filter((l) => !reasked.includes(l));
    // Fails closed: an invalid report is never read as a pass.
    if (again.length) return { result: null, action: 'reask', lenses, findings, advisory, invalid, reask: again, reason: 'a report has no valid first line' };
    return { result: null, action: 'stop', lenses, findings, advisory, invalid, reason: 'lens report invalid' };
  }
  const rejected = plan.some((p) => p.active && lenses[p.lens].status === 'REJECTED' && lenses[p.lens].blocking);
  return { result: rejected ? 'QA REJECTED' : 'QA PASSED', action: 'done', lenses, findings, advisory, invalid, reason: null };
}

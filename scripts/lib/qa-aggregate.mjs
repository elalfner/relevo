// Decides the result of the QA lenses, in a script that fails closed. Implements "A script decides the result and it fails
// closed" and "The interface lens advises on the last attempt" of the qa-lenses specification.

import { ALWAYS } from './lens-plan.mjs';
import { quoteMatches, ruleAt } from './rules-file.mjs';

export const CLASSES = ['fixable', 'input', 'spec', 'policy'];
const CLASS_RE = /^\s*(?:\*\*)?Class(?:\*\*)?\s*[:=]\s*`?([A-Za-z]+)`?/i;
const FINDING_RE = /^\s*(\d+)[.)]\s+(.*)$/;
// `Rule: <file>:<line> "<quoted text>"` (backticks and curly quotes accepted): a finding that cites the rule it breaks.
const RULE_RE = /\bRule\b\**\s*[:=]\s*\**\s*`?([^\s`"“”:]+):(\d+)`?\s*["“'`](.+?)["”'`]\s*\.?\s*$/i;
const DEVICE_HEADING_RE = /^\s*(?:#{1,6}\s*|\*\*)?Left for on-device review\b/i;

const squash = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Does the finding itself, outside its `Rule:` citation, repeat the quoted words? An empty quote never does. */
function namesQuote(text, quote) {
  const cut = RULE_RE.exec(text);
  const q = squash(quote);
  return q !== '' && squash(cut ? text.slice(0, cut.index) : text).includes(q);
}

/** The first non-blank line of a report is exactly QA PASSED or QA REJECTED: returns 'PASSED', 'REJECTED' or null. */
export function verdictOf(text) {
  const first = String(text ?? '').split('\n').find((l) => l.trim() !== '');
  if (first === undefined) return null;
  const t = first.trim();
  return t === 'QA PASSED' ? 'PASSED' : t === 'QA REJECTED' ? 'REJECTED' : null;
}

/**
 * { verdict, findings: [{ number, class, text, cites }], device: [text], orphans: [cite] }. A finding without a valid class is
 * `fixable`. A cite is { file, line, quote } from a `Rule:` line; one that belongs to no numbered finding (or that is in a report
 * with no findings, as in `QA PASSED`) is in `orphans`.
 */
export function parseReport(text) {
  const verdict = verdictOf(text);
  const findings = [];
  const device = [];
  const orphans = [];
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
    const cite = (l) => { const m = RULE_RE.exec(l); return m ? { file: m[1], line: Number(m[2]), quote: m[3].trim() } : null; };
    if (item) { current = { number: Number(item[1]), class: 'fixable', text: item[2].trim(), cites: [] }; findings.push(current); const c = cite(item[2]); if (c) current.cites.push(c); return; }
    const c = cite(line);
    if (c) { (current ? current.cites : orphans).push(c); return; }
    const cls = CLASS_RE.exec(line);
    if (cls && current) current.class = CLASSES.includes(cls[1].toLowerCase()) ? cls[1].toLowerCase() : 'fixable';
  });
  if (verdict !== 'REJECTED') findings.forEach((f) => orphans.push(...f.cites));
  return { verdict, findings: verdict === 'REJECTED' ? findings : [], device, orphans };
}

/**
 * reports   { [lens]: text | null } for every active lens
 * plan      the output of planLenses
 * attempt   the number of this attempt (1 is the first)
 * retries   qa.retries; the last attempt is retries + 1
 * reasked   the lenses whose report was already asked for a second time
 * rules     the lines of the rules files (parseRules of each), or [] when none was given: with them a `Rule:` citation of a hard
 *           rule is verified and blocks, whichever lens wrote it, on every attempt, and even in a `QA PASSED` report
 * Returns { result, action, lenses, findings, advisory, invalid, reason }.
 *   action: 'done' | 'reask' (ask these lenses again, once) | 'stop' (a second invalid report: "lens report invalid")
 */
export function aggregate({ reports, plan, attempt, retries, reasked = [], rules = [] }) {
  const last = retries === 0 || attempt >= retries + 1;
  const lenses = {};
  const findings = [];
  const advisory = [];
  const invalid = [];
  const unverified = [];
  const rejecting = new Set();
  // A citation is trusted only when its quote is on that line of a rules file; the rule is hard unless it is marked [advice].
  const check = (cite) => {
    const rule = ruleAt(rules, cite.file, cite.line);
    return rule && quoteMatches(rule, cite.quote) ? { rule, hard: !rule.advice } : null;
  };
  plan.forEach((p) => {
    if (!p.active) { lenses[p.lens] = { status: 'SKIPPED', reason: p.reason }; return; }
    const parsed = parseReport(reports[p.lens]);
    if (parsed.verdict === null) { invalid.push(p.lens); lenses[p.lens] = { status: 'INVALID' }; return; }
    const blocks = ALWAYS.includes(p.lens) || !last;
    lenses[p.lens] = { status: parsed.verdict, blocking: blocks, findings: parsed.findings.length };
    let hardRule = 0;
    if (parsed.verdict === 'REJECTED') {
      parsed.findings.forEach((f) => {
        const checked = f.cites.map((c) => ({ c, v: check(c) }));
        checked.filter((x) => !x.v && rules.length > 0).forEach((x) => unverified.push({ lens: p.lens, number: f.number, cited: `${x.c.file}:${x.c.line}`, quote: x.c.quote }));
        const hard = checked.find((x) => x.v?.hard);
        // A lens that always blocks keeps a finding blocking unless the finding names each advice rule it cites: a real problem
        // that carries an advice line on the side is not a note.
        const adviceOnly = !hard && checked.some((x) => x.v) && checked.every((x) => x.v && !x.v.hard)
          && (!ALWAYS.includes(p.lens) || checked.every((x) => namesQuote(f.text, x.c.quote)));
        const { cites, ...rest } = f;
        if (hard) { hardRule += 1; findings.push({ lens: p.lens, ...rest, rule: { file: hard.v.rule.file, line: hard.v.rule.line, text: hard.v.rule.text } }); rejecting.add(p.lens); }
        else if (blocks && !adviceOnly) { findings.push({ lens: p.lens, ...rest }); rejecting.add(p.lens); }
        else advisory.push({ lens: p.lens, kind: 'finding', text: f.text });
      });
      // A rejection that lists no finding cannot be read as a pass.
      if (blocks && parsed.findings.length === 0) rejecting.add(p.lens);
    }
    // A citation outside a numbered finding (a pass that carries one, for example) still counts: nothing is written off as a note.
    parsed.orphans.forEach((c) => {
      const v = check(c);
      if (!v) { if (rules.length) unverified.push({ lens: p.lens, number: null, cited: `${c.file}:${c.line}`, quote: c.quote }); return; }
      if (!v.hard) { advisory.push({ lens: p.lens, kind: 'finding', text: `${c.file}:${c.line} "${c.quote}" (advice)` }); return; }
      hardRule += 1;
      findings.push({ lens: p.lens, number: 0, class: 'fixable', text: `A rule of the project is broken: ${v.rule.file}:${v.rule.line} "${v.rule.text}" (cited in the report of the ${p.lens} lens)`, rule: { file: v.rule.file, line: v.rule.line, text: v.rule.text } });
      rejecting.add(p.lens);
    });
    if (hardRule) lenses[p.lens].hard_rule = hardRule;
    parsed.device.forEach((text) => advisory.push({ lens: p.lens, kind: 'device', text }));
  });
  if (invalid.length) {
    const again = invalid.filter((l) => !reasked.includes(l));
    // Fails closed: an invalid report is never read as a pass.
    if (again.length) return { result: null, action: 'reask', lenses, findings, advisory, invalid, reask: again, reason: 'a report has no valid first line' };
    return { result: null, action: 'stop', lenses, findings, advisory, invalid, reason: 'lens report invalid' };
  }
  const rejected = rejecting.size > 0;
  // A retry can only succeed when the developer agent can fix something: with every blocking finding needing an input, a
  // decision of the specification or something an unattended run may not do, `go` skips the retries.
  const nonFixable = findings.filter((f) => f.class !== 'fixable');
  const allNonFixable = rejected && findings.length > 0 && nonFixable.length === findings.length;
  return {
    result: rejected ? 'QA REJECTED' : 'QA PASSED', action: 'done', lenses, findings, advisory, invalid, unverified, reason: null,
    all_non_fixable: allNonFixable, first_non_fixable_class: nonFixable[0]?.class ?? null,
  };
}

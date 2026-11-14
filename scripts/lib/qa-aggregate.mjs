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

const ANCHOR_RE = /`([^`\n]+)`|"([^"\n]+)"|“([^”\n]+)”/g;
const PATH_LIKE = /[\\/]|\.[a-z0-9]{1,5}$/i;

/**
 * The words a finding quotes: spans in backticks or double quotes of 3 or more characters, as Map { squashed -> as written }.
 * What is inside the `Rule:` citation is left out, and so is a span that looks like a path: two lenses naming the same file is
 * not a disagreement.
 */
export function anchorsOf(text) {
  const cut = RULE_RE.exec(text);
  const body = cut ? String(text).slice(0, cut.index) : String(text ?? '');
  const out = new Map();
  for (const m of body.matchAll(ANCHOR_RE)) {
    const written = (m[1] ?? m[2] ?? m[3]).trim();
    const key = squash(written);
    if (key.length >= 3 && !PATH_LIKE.test(written)) out.set(key, written);
  }
  return out;
}

const shared = (a, b) => [...a].find(([k]) => b.has(k))?.[1] ?? null;

/**
 * Finds the blocking findings that reverse what another lens asked for. Returns { pairs } only when EVERY blocking finding is the
 * second side of a pair (no other thing is left for a retry to fix), otherwise null. A pair is: a blocking finding F of lens B
 * and a finding O of the previous attempt of another lens A, with a quoted span in common, where A no longer reports it (no
 * current finding of A shares a span with O), B had not reported it (no finding of B on the previous attempt shares a span with
 * F), neither lens is `security` and neither finding cites a rule. Anything it cannot tell is not a contradiction.
 */
function contradictionOf({ findings, rejecting, now, before, cited }) {
  if (findings.length === 0) return null;
  const known = (l) => now[l] && now[l].verdict !== null;
  if ([...rejecting].some((l) => !findings.some((f) => f.lens === l))) return null;
  const pairs = [];
  for (const f of findings) {
    if (f.lens === 'security' || f.rule || cited.has(f) || !known(f.lens)) return null;
    const mine = anchorsOf(f.text);
    if (mine.size === 0) return null;
    if ((before[f.lens]?.findings ?? []).some((o) => shared(mine, anchorsOf(o.text)))) return null;
    let pair = null;
    for (const [a, prev] of Object.entries(before)) {
      if (a === f.lens || a === 'security' || !known(a)) continue;
      for (const o of prev.findings) {
        const quoted = o.cites.length === 0 ? shared(mine, anchorsOf(o.text)) : null;
        if (quoted === null) continue;
        const addressed = !now[a].findings.some((c) => shared(anchorsOf(c.text), anchorsOf(o.text)));
        if (addressed) { pair = { first: { lens: a, number: o.number, text: o.text }, then: { lens: f.lens, number: f.number, text: f.text }, quoted }; break; }
      }
      if (pair) break;
    }
    if (!pair) return null;
    pairs.push(pair);
  }
  return { pairs };
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
 * previous  { [lens]: text | null } the reports of the previous attempt, or {} (and then no contradiction can be found)
 * Returns { result, action, lenses, findings, advisory, invalid, reason, contradiction }. `contradiction` is null or { pairs: [{
 *   first: { lens, number, text }, then: { lens, number, text }, quoted }] }: every blocking finding reverses what another lens
 *   asked for in the previous attempt and no longer asks for, so a retry cannot meet both (the result is still QA REJECTED).
 *   action: 'done' | 'reask' (ask these lenses again, once) | 'stop' (a second invalid report: "lens report invalid")
 */
export function aggregate({ reports, plan, attempt, retries, reasked = [], rules = [], previous = {} }) {
  const last = retries === 0 || attempt >= retries + 1;
  const lenses = {};
  const findings = [];
  const advisory = [];
  const invalid = [];
  const unverified = [];
  const rejecting = new Set();
  const now = {};
  const cited = new WeakSet();
  // A citation is trusted only when its quote is on that line of a rules file; the rule is hard unless it is marked [advice].
  const check = (cite) => {
    const rule = ruleAt(rules, cite.file, cite.line);
    return rule && quoteMatches(rule, cite.quote) ? { rule, hard: !rule.advice } : null;
  };
  plan.forEach((p) => {
    if (!p.active) { lenses[p.lens] = { status: 'SKIPPED', reason: p.reason }; return; }
    const parsed = parseReport(reports[p.lens]);
    now[p.lens] = parsed;
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
        else if (blocks && !adviceOnly) { const entry = { lens: p.lens, ...rest }; if (cites.length) cited.add(entry); findings.push(entry); rejecting.add(p.lens); }
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
  // Only from the second attempt, and only with the reports of the one before: without them nothing can be compared.
  const before = {};
  Object.entries(previous ?? {}).forEach(([l, t]) => { before[l] = parseReport(t); });
  const contradiction = rejected && attempt > 1 && !allNonFixable ? contradictionOf({ findings, rejecting, now, before, cited }) : null;
  return {
    result: rejected ? 'QA REJECTED' : 'QA PASSED', action: 'done', lenses, findings, advisory, invalid, unverified, reason: null, contradiction,
    all_non_fixable: allNonFixable, first_non_fixable_class: nonFixable[0]?.class ?? null,
  };
}

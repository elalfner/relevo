// Finds the places where an issue contradicts the project rules or its own scenarios, with no model. Implements "The check
// finds a draft that contradicts the project rules or itself" of the issue specification.
//
// The check is lexical and says nothing about which side wins (a person decides): it pairs a line of `Out of scope` with a
// rule that requires something, or with a scenario, when they share the same words, and quotes both lines so that anyone can
// confirm or dismiss the pair by reading them. A decision of the issue with `Overrides: <file>:<line>` records that the
// issue wins over that rule on purpose.

import { section } from './issue-sections.mjs';
import { withoutCode } from './issue-parse.mjs';
import { ruleAt } from './rules-file.mjs';

const STOP = new Set(('the and for with that this from are was were has have had not but all any can will shall must should may might its into onto than then them they their there these those each every always never only also such via per out of in on at by to a an is it as be or if no do does did so we you your our not more most some other which what when where who whom how why about over under after before between during without within would could').split(' ')
  .concat('covered cover covers later future issue issues another separate separately scope handled handle part version release phase todo see for el la los las un una unos unas de del y o en con por para que se su sus al lo es son ser como pero sin sobre entre este esta estos estas cada siempre nunca solo también otro otra otros otras cubierto tarea issue'.split(' ')));
// A phrase that says a line requires something. A prohibition agrees with an exclusion, so it is never a requirement.
const REQUIRE_RE = /\b(must|shall|required?|requires?|mandatory|always|every|each|need(?:s)? to|debe|deben|debes|obligatori[oa]s?|siempre|cada|requiere[n]?|todo[s]?|toda[s]?)\b/i;
const FORBID_RE = /\b(must not|mustn't|shall not|never|do not|don't|does not|doesn't|cannot|can't|nunca|jam[aá]s|no debe[n]?|no se debe[n]?|prohibid[oa]s?|forbidden)\b/i;

const clean = (t) => String(t).replace(/\([^)]*#\d+[^)]*\)/g, ' ').replace(/#\d+/g, ' ').replace(/`/g, '');
function stem(word) {
  let w = word;
  for (const suffix of ['iones', 'ción', 'ing', 'ed', 'es', 's']) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) { w = w.slice(0, -suffix.length); break; }
  }
  return w;
}
/** The content words of a line, as a set of crude stems. */
export function terms(text) {
  const words = clean(text).toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w));
  return new Set(words.map(stem));
}
const sharedTerms = (a, b) => [...a].filter((t) => b.has(t));
// Two content words in common, or every content word of a short exclusion ("export"), is the same subject.
function sameSubject(limit, other) {
  const shared = sharedTerms(limit, other);
  return shared.length >= 2 || (limit.size > 0 && limit.size <= 2 && shared.length === limit.size);
}

// "Any other change", "the rest": an exclusion of the remainder, which excludes what nothing else in the issue asks for, so it cannot contradict a rule or a scenario.
const REMAINDER_RE = /\b(?:other|others|else|otherwise|rest|remaining|anything|everything|otros?|otras?|dem[aá]s|resto|cualquier)\b/i;

const bulletText = (line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
const stepText = (line) => bulletText(line).replace(/\*\*|__/g, '').replace(/^(?:WHEN|GIVEN|THEN)[:\s]+/i, '').trim();
const WHEN_RE = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?(?:WHEN|GIVEN)(?:\*\*|__)?(?:\s|:)/i;
const THEN_RE = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?THEN(?:\*\*|__)?(?:\s|:)/i;

/** The lines of `Out of scope`: [{ text }] (one per bullet, or per non-blank line when there are no bullets). */
export function outOfScope(body) {
  const found = section(body, 'Out of scope');
  if (!found) return [];
  const lines = withoutCode(found.text).map((l) => l.trim()).filter((l) => l !== '' && !/^<!--/.test(l));
  return lines.map(bulletText).filter((t) => t !== '' && !/^(?:none|nothing|n\/a|ninguna?|nada|-)\.?$/i.test(t));
}

/** The complete scenarios, in order: [{ number, when, text }] (a WHEN line with the THEN lines that follow it). */
export function scenariosOf(body) {
  const found = section(body, 'Scenarios');
  const out = [];
  if (!found) return out;
  let current = null;
  withoutCode(found.text).forEach((line) => {
    if (WHEN_RE.test(line)) { current = { number: out.length + 1, when: stepText(line), then: [] }; out.push(current); return; }
    if (current && THEN_RE.test(line)) current.then.push(stepText(line));
  });
  return out.filter((s) => s.then.length > 0).map((s) => ({ number: s.number, when: s.when, text: [s.when, ...s.then].join(' ') }));
}

/** The `<file>:<line>` references of the `Overrides:` lines written inside a `### D<n>.` block of `Decisions`. */
export function overridesOf(body) {
  const found = section(body, 'Decisions');
  const refs = [];
  if (!found) return refs;
  let inDecision = false;
  withoutCode(found.text).forEach((line) => {
    if (/^###\s+/.test(line)) { inDecision = /^###\s+D\d+\./.test(line); return; }
    if (!inDecision) return;
    const m = /^\s*(?:[-*+]\s+)?Overrides:\s*(.+)$/i.exec(line);
    if (!m) return;
    [...m[1].matchAll(/`?([^\s`,;]+?):(\d+)`?/g)].forEach((r) => refs.push({ file: r[1], line: Number(r[2]) }));
  });
  return refs;
}

/**
 * body    the text of the issue
 * rules   the lines of the rules files (parseRules of each), or [] when the project has none
 * Returns { conflicts, problems }. A conflict is { kind: 'rule', limit, rule: { file, line, text } } or
 * { kind: 'scenario', limit, scenario: { number, when } }; `problems` lists an `Overrides:` that names a line that is not a
 * line of a rules file. A rule marked `[advice]`, a heading, a prohibition and a rule that an `Overrides:` names are skipped.
 */
export function findConflicts({ body, rules = [] }) {
  const overrides = overridesOf(body);
  const problems = [];
  if (rules.length) {
    overrides.forEach((o) => {
      const rule = ruleAt(rules, o.file, o.line);
      if (!rule) problems.push(`Overrides: ${o.file}:${o.line} is not a line of a rules file`);
    });
  }
  const overridden = (rule) => overrides.some((o) => o.file === rule.file && o.line === rule.line);
  const limits = outOfScope(body).map((text) => ({ text, terms: terms(text) })).filter((l) => l.terms.size > 0 && !REMAINDER_RE.test(l.text));
  const conflicts = [];
  const required = rules.filter((r) => !r.heading && !r.advice && REQUIRE_RE.test(r.text) && !FORBID_RE.test(r.text) && !overridden(r));
  limits.forEach((limit) => {
    required.forEach((rule) => {
      if (sameSubject(limit.terms, terms(rule.text))) conflicts.push({ kind: 'rule', limit: limit.text, rule: { file: rule.file, line: rule.line, text: rule.text } });
    });
    scenariosOf(body).forEach((s) => {
      if (sameSubject(limit.terms, terms(s.text))) conflicts.push({ kind: 'scenario', limit: limit.text, scenario: { number: s.number, when: s.when } });
    });
  });
  return { conflicts, problems };
}

const q = (t) => `"${String(t).replace(/\s+/g, ' ').trim()}"`;

/** One line for a person: both quoted lines, and the reminder that a person decides. */
export function conflictText(c) {
  if (c.kind === 'rule') return `Out of scope says ${q(c.limit)}, but the rule at ${c.rule.file}:${c.rule.line} says ${q(c.rule.text)}; decide which one wins: change the issue, or record a decision with "Overrides: ${c.rule.file}:${c.rule.line}"`;
  return `Out of scope says ${q(c.limit)}, but scenario ${c.scenario.number} (WHEN ${q(c.scenario.when)}) needs it; decide which one wins and change one of them`;
}

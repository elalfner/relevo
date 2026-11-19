// Reads a project rules file (`qa.rules_from`) into lines that can be quoted, and says which of them are advice.
// Implements "A violation of a hard rule blocks" of the go specification and "The check finds a draft that contradicts the
// project rules or itself" of the issue specification (openspec/changes/catch-rule-contradictions).
//
// A rule is a requirement unless it is marked `[advice]`: on its own line, or on a heading, which marks every line under
// it until the next heading of the same or a higher level.

export const ADVICE_RE = /\[advice\]/i;
const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * The lines of a rules file that hold text: [{ file, line, text, advice, heading }]. `line` counts from 1, as an editor
 * does. Blank lines and fenced code are left out, because nobody quotes them as a rule.
 */
export function parseRules(file, text) {
  const out = [];
  let inFence = false;
  let adviceLevel = null;
  String(text ?? '').split('\n').forEach((raw, i) => {
    if (FENCE_RE.test(raw)) { inFence = !inFence; return; }
    if (inFence || raw.trim() === '') return;
    const h = HEADING_RE.exec(raw);
    if (h) {
      const level = h[1].length;
      if (adviceLevel !== null && level <= adviceLevel) adviceLevel = null;
      if (adviceLevel === null && ADVICE_RE.test(h[2])) adviceLevel = level;
      out.push({ file, line: i + 1, text: raw.trim(), advice: adviceLevel !== null, heading: true });
      return;
    }
    out.push({ file, line: i + 1, text: raw.trim(), advice: adviceLevel !== null || ADVICE_RE.test(raw), heading: false });
  });
  return out;
}

const norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The entry of `<file>:<line>` among `rules`, or null. */
export const ruleAt = (rules, file, line) => rules.find((r) => r.file === file && r.line === Number(line)) ?? null;

/** Does the line of the rule hold the quoted text (whitespace and case ignored)? An empty quote never matches. */
export const quoteMatches = (rule, quote) => norm(quote) !== '' && norm(rule?.text).includes(norm(quote));

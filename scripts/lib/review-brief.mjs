// A short brief for the person who reviews a built issue, computed from the issue so the model does not rewrite it.
// Implements "The review starts with a short brief" of openspec/specs/review/spec.md.

import { parseIssueBody } from './issue-parse.mjs';
import { section } from './issue-sections.mjs';

export const MAX_SENTENCES = 2;
export const MAX_LINE = 160;

const LABELS = {
  en: {
    asked: 'Asked', outcome: 'Outcome', first: 'Check first', count: (s, e) => `To check: ${s} scenario(s), ${e} edge case(s)`,
    autopilot: 'The agent walks the lines below first; you confirm every line, and lines about appearance are never marked automatically.',
  },
  es: {
    asked: 'Se pidió', outcome: 'Resultado', first: 'Revisa primero', count: (s, e) => `Por revisar: ${s} escenario(s), ${e} caso(s) borde`,
    autopilot: 'El agente recorre primero las líneas de abajo; tú confirmas cada línea, y las líneas sobre apariencia nunca se marcan automáticamente.',
  },
};
const RISK_RE = /(?:Riskiest area, check it first|Zona más riesgosa, revísala primero):\s*(.+)/;

const clean = (text) => String(text ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
const cap = (text) => (text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1).trimEnd()}…` : text);

/** Up to `max` sentences of a text. */
export function firstSentences(text, max = MAX_SENTENCES) {
  const t = clean(text);
  if (!t) return '';
  return t.split(/(?<=[.!?])\s+/).slice(0, max).join(' ');
}

/**
 * issue  { number, title, body }
 * built  the text of the `built` comment, when there is one (the risk line is taken from it)
 * autopilot  review.autopilot; with precheck or verify a fixed note says the person still confirms every line
 * Returns the brief as a string of about five lines.
 */
export function reviewBrief({ issue, built = '', language = 'en', autopilot = 'off' }) {
  const L = LABELS[language === 'es' ? 'es' : 'en'];
  const parsed = parseIssueBody(issue.body);
  const lines = [`#${issue.number} ${clean(issue.title)}`];
  const asked = firstSentences(section(issue.body, 'Summary')?.text);
  if (asked) lines.push(`${L.asked}: ${asked}`);
  const outcome = clean(section(issue.body, 'Outcome')?.text);
  if (outcome) lines.push(`${L.outcome}: ${firstSentences(outcome, 1)}`);
  const risk = String(built).match(RISK_RE)?.[1];
  if (risk) lines.push(`${L.first}: ${clean(risk)}`);
  lines.push(L.count(parsed.scenarios, parsed.edgeCases));
  const note = ['precheck', 'verify'].includes(autopilot) ? `\n${L.autopilot}` : '';
  return `${lines.map(cap).join('\n')}${note}`;
}

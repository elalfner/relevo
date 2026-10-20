// Checks that every id of the agreement (D decisions, C constraints, A assumptions, Q open questions) went somewhere.
// Implements "Nothing from the agreement is lost on the way to the issue" of openspec/specs/issue/spec.md.
// It checks presence, not meaning: the table it feeds is what the person approves.

import { sections } from './issue-sections.mjs';

const ID_AT_START_RE = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?(?:#{1,6}\s+)?([DCAQ]\d+)\b/;

/** Ids listed in the agreement, in order, without repeats. */
export function agreementIds(text) {
  const ids = [];
  String(text ?? '').split('\n').forEach((line) => {
    const m = line.match(ID_AT_START_RE);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  });
  return ids;
}

/**
 * agreement  text of the agreement
 * issues     [{ name, body }]
 * discarded  ids the person marked as discarded
 * Returns { ok, found: [{ id, issue, section }], discarded: [id], missing: [id] }.
 */
export function coverage({ agreement, issues, discarded = [] }) {
  const ids = agreementIds(agreement);
  const skip = new Set(discarded.map((d) => d.trim()).filter(Boolean));
  const found = [];
  const dropped = [];
  const missing = [];
  ids.forEach((id) => {
    if (skip.has(id)) {
      dropped.push(id);
      return;
    }
    const re = new RegExp(`(?<![A-Za-z0-9])${id}(?![0-9])`);
    let place = null;
    issues.forEach((issue) => {
      if (place) return;
      const hit = sections(issue.body).find((s) => re.test(`${s.name}\n${s.text}`));
      if (hit) place = { id, issue: issue.name, section: hit.name };
    });
    if (place) found.push(place);
    else missing.push(id);
  });
  return { ok: missing.length === 0, found, discarded: dropped, missing };
}

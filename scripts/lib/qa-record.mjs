// The record of what QA stopped: one line per attempt in a log of the run, one hidden marker in the comment that ends it, and
// the figures that `relevo qa-report` and the digest add up. Implements the qa-record specification.
//
// Recording is an addition and never changes the result of a run: what cannot be written or read is left out. The figures
// come from the markers only, never from the visible text of a comment.

import { appendFileSync } from 'node:fs';
import { readFileSync } from './guarded-fs.mjs';
import { CLASSES } from './qa-aggregate.mjs';
import { redact } from './redact.mjs';

/** The kinds of correction that `fix` makes. Only `defect` is something QA could have caught. */
export const FIX_KINDS = ['defect', 'spec-gap', 'change', 'integration', 'unfinished'];
export const TEXT_CAP = 160;
export const TEXTS_KEPT = 20;

const MARKER_RE = /^<!-- relevo:qa-record (\{.*\}) -->[ \t\r]*$/gm;
// A lens or a class is a short name; anything else in a marker was not written by this file.
const NAME_RE = /^[a-z][a-z-]{0,23}$/;
const ROLES = ['OWNER', 'MEMBER', 'COLLABORATOR'];

/** One attempt of the aggregation (or a red gate) as the log keeps it. The texts are bounded when the marker is built. */
export function attemptOf({ gate = 'green', findings = [], advisory = [] } = {}) {
  return {
    gate,
    blocking: findings.map((f) => ({ lens: String(f.lens), class: CLASSES.includes(f.class) ? f.class : 'fixable', text: String(f.text ?? '') })),
    advisory: advisory.length,
  };
}

/** Appends one attempt to the log of the run. Returns false, and never throws, when it cannot be written. */
export function appendAttempt(path, attempt) {
  try {
    appendFileSync(path, `${JSON.stringify(attempt)}\n`);
    return true;
  } catch {
    return false;
  }
}

const isCount = (v) => Number.isInteger(v) && v >= 0;

function validRound(r) {
  return Boolean(r) && ['green', 'red'].includes(r.gate) && isCount(r.advisory) && Array.isArray(r.blocking)
    && r.blocking.every((f) => f && NAME_RE.test(f.lens) && CLASSES.includes(f.class) && (f.text === undefined || typeof f.text === 'string'));
}

/**
 * The attempts of a log, in order, or null when there is no record to trust: the file cannot be read, it is empty, or a line
 * of it is broken. A record with an attempt missing would count a later attempt as the first one, so it is not used at all.
 */
export function readLog(path) {
  try {
    const rounds = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    return rounds.length && rounds.every(validRound) ? rounds : null;
  } catch {
    return null;
  }
}

// Redacted before it is cut, so that a cut never leaves half of a secret in a shape the redactor no longer knows.
function safeText(text) {
  const line = redact(text).replace(/\s+/g, ' ').trim();
  return line.length > TEXT_CAP ? `${line.slice(0, TEXT_CAP - 1).trimEnd()}…` : line;
}

/**
 * The hidden marker of a run. `withText` false (a public repository) keeps counts, reviewers and classes only. At most
 * TEXTS_KEPT texts are kept, the earliest attempts first; `omitted` counts the findings left without one by that bound.
 */
export function recordMarker({ command, passed, rounds, kind = null, withText = false }) {
  let kept = 0;
  let omitted = 0;
  const record = {
    v: 1,
    command,
    passed: Boolean(passed),
    rounds: rounds.map((r) => ({
      gate: r.gate,
      blocking: r.blocking.map((f) => {
        const entry = { lens: f.lens, class: f.class };
        if (!withText) return entry;
        const text = safeText(f.text);
        if (!text) return entry;
        if (kept >= TEXTS_KEPT) { omitted += 1; return entry; }
        kept += 1;
        return { ...entry, text };
      }),
      advisory: r.advisory,
    })),
  };
  record.omitted = omitted;
  if (command === 'fix' && FIX_KINDS.includes(kind)) record.kind = kind;
  // JSON that cannot close the comment: < and > are escaped.
  return `<!-- relevo:qa-record ${JSON.stringify(record).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')} -->`;
}

/**
 * The record of a comment as the REST API gives it, or null. It counts from a bot or from a person with a role in the
 * repository (local builds are posted by people), and only when the comment holds exactly one valid marker.
 */
export function parseRecord(comment) {
  if (comment?.user?.type !== 'Bot' && !ROLES.includes(comment?.author_association)) return null;
  const found = [...String(comment.body ?? '').matchAll(MARKER_RE)];
  if (found.length !== 1) return null;
  let data;
  try {
    data = JSON.parse(found[0][1]);
  } catch {
    return null;
  }
  if (data?.v !== 1 || !['go', 'fix'].includes(data.command) || typeof data.passed !== 'boolean') return null;
  if (!Array.isArray(data.rounds) || !data.rounds.length || !data.rounds.every(validRound) || !isCount(data.omitted)) return null;
  if (data.kind !== undefined && !FIX_KINDS.includes(data.kind)) return null;
  const issue = Number(/\/issues\/(\d+)$/.exec(comment.issue_url ?? '')?.[1]) || null;
  return {
    issue,
    created_at: comment.created_at ?? null,
    command: data.command,
    passed: data.passed,
    kind: data.kind ?? null,
    omitted: data.omitted,
    // The text is shown in a terminal: control characters do not go through.
    rounds: data.rounds.map((r) => ({
      gate: r.gate,
      advisory: r.advisory,
      blocking: r.blocking.map((f) => ({ lens: f.lens, class: f.class, ...(f.text ? { text: f.text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ') } : {}) })),
    })),
  };
}

const stoppedSomething = (run) => run.rounds.some((r) => r.gate === 'red' || r.blocking.length > 0);

/**
 * The figures of a list of parsed records. Findings are those of the first attempt only: a later attempt may repeat one in
 * other words, so adding attempts would count it twice.
 */
export function summarizeRecords(records) {
  const first = new Map(); // "lens class" -> { lens, class, count, passed }
  records.forEach((run) => {
    run.rounds[0].blocking.forEach((f) => {
      const key = `${f.lens} ${f.class}`;
      const row = first.get(key) ?? { lens: f.lens, class: f.class, count: 0, passed: 0 };
      row.count += 1;
      if (run.passed) row.passed += 1;
      first.set(key, row);
    });
  });
  const fixes = records.filter((r) => r.command === 'fix');
  const kinds = {};
  [...FIX_KINDS, null].forEach((k) => {
    const n = fixes.filter((r) => r.kind === k).length;
    if (n) kinds[k ?? 'not said'] = n;
  });
  const findings = [...first.values()].sort((a, b) => b.count - a.count || a.lens.localeCompare(b.lens) || a.class.localeCompare(b.class));
  return {
    runs: records.length,
    builds: records.length - fixes.length,
    fixes: fixes.length,
    stopped: records.filter(stoppedSomething).length,
    findings,
    total: findings.reduce((n, f) => n + f.count, 0),
    totalPassed: findings.reduce((n, f) => n + f.passed, 0),
    kinds,
    defects: kinds.defect ?? 0,
  };
}

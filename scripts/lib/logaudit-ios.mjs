// Audit of the log of an iOS app read from the simulator with `log show --style ndjson`.
// Implements "The audit of an iOS review separates faults and the app's errors from system noise" of
// openspec/changes/ios-review-adapter/specs/review/spec.md. Pure functions: they read text and return data.

const MESSAGE_MAX = 200;

/** The entries of an ndjson text. A line that is not a JSON object with a message, or a type, is skipped. */
export function parseNdjson(text) {
  const entries = [];
  for (const line of String(text ?? '').split('\n')) {
    const l = line.trim();
    if (!l.startsWith('{')) continue;
    let entry;
    try {
      entry = JSON.parse(l);
    } catch {
      continue;
    }
    if (entry && typeof entry === 'object' && ('eventMessage' in entry || 'messageType' in entry)) entries.push(entry);
  }
  return entries;
}

const clip = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MESSAGE_MAX);
const isApple = (subsystem) => String(subsystem ?? '').startsWith('com.apple.');

/**
 * Audit the entries of one app.
 * - `Fault` is always a finding (it includes the runtime issues that SwiftUI reports).
 * - `Error` is system noise when its subsystem begins with `com.apple.`, and a finding otherwise.
 * - Any other type is not a finding.
 * Returns { status: 'inconclusive' | 'clean' | 'findings', entries, findings, ignored, counts }.
 * Identical findings are folded into one with a `count`.
 */
export function auditIosLog(text) {
  const entries = parseNdjson(text);
  const counts = {};
  for (const e of entries) counts[e.messageType ?? 'untyped'] = (counts[e.messageType ?? 'untyped'] ?? 0) + 1;
  if (entries.length === 0) {
    return { status: 'inconclusive', reason: 'the log has no entry of the app since the review started', entries: 0, findings: [], ignored: 0, counts };
  }
  const folded = new Map();
  let ignored = 0;
  for (const e of entries) {
    const type = e.messageType;
    if (type !== 'Fault' && type !== 'Error') continue;
    if (type === 'Error' && isApple(e.subsystem)) {
      ignored += 1;
      continue;
    }
    const message = clip(e.eventMessage);
    const key = `${type}|${e.subsystem ?? ''}|${message}`;
    const found = folded.get(key);
    if (found) found.count += 1;
    else folded.set(key, { level: type === 'Fault' ? 'fault' : 'error', subsystem: e.subsystem ?? '', category: e.category ?? '', message, time: e.timestamp ?? null, count: 1 });
  }
  const findings = [...folded.values()];
  return { status: findings.length ? 'findings' : 'clean', entries: entries.length, findings, ignored, counts };
}

/**
 * The audit of an iOS slice in the shape the review state keeps: { verdict, findings: [{ class, line, excerpt, count }],
 * counts, ignored, reason? }. A finding's class is `fault` or `error`; its excerpt is `[subsystem] message`, so a waiver
 * matches it as it matches the findings of the other adapters.
 */
export function iosReviewAudit(text) {
  const r = auditIosLog(text);
  if (r.status === 'inconclusive') return { verdict: 'REVIEW INCONCLUSIVE', reason: r.reason, findings: [], counts: {}, ignored: 0 };
  const findings = r.findings.map((f) => ({ class: f.level, line: 0, excerpt: `[${f.subsystem || 'no subsystem'}] ${f.message}`.slice(0, 200), count: f.count }));
  const counts = {};
  findings.forEach((f) => { counts[f.class] = (counts[f.class] ?? 0) + 1; });
  return { verdict: findings.length === 0 ? 'REVIEW PASSED' : 'REVIEW REJECTED', findings, counts, ignored: r.ignored };
}

/** Read the simulator log of a review source `{ source: 'simulator', udid, process, since }` and audit it. A simulator that cannot be read is inconclusive, never a pass. */
export function auditSimulatorSource(source, readLog) {
  let text;
  try {
    text = readLog({ udid: source.udid, since: source.since, processName: source.process });
  } catch (err) {
    const unreadable = /could not be read/.test(err.message);
    return { verdict: 'REVIEW INCONCLUSIVE', reason: unreadable ? `${err.message}: boot the simulator again, start the app and repeat the steps` : `the review state cannot be audited: ${err.message}`, findings: [], counts: {}, ignored: 0 };
  }
  return iosReviewAudit(text);
}

// Audit of the log of an iOS app read from the simulator with `log show --style ndjson`.
// Implements "The audit of an iOS review separates faults and the app's errors from system noise" of
// openspec/changes/ios-review-adapter/specs/review/spec.md. Pure functions: they read text and return data.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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
// A system image: under /System/Library/ or /usr/lib/, from the start of the path or directly after the root of a simulator runtime.
const SYSTEM_IMAGE = /^(?:\/.*\.simruntime\/Contents\/Resources\/RuntimeRoot)?\/(?:System\/Library|usr\/lib)\//;
const isSystemImage = (path) => !path.includes('/data/Containers/') && SYSTEM_IMAGE.test(path);
const fileName = (path) => path.slice(path.lastIndexOf('/') + 1);

/**
 * Audit the entries of one app.
 * - `Fault` is always a finding (it includes the runtime issues that SwiftUI reports).
 * - `Error` is system noise when its subsystem begins with `com.apple.`, or when it has no subsystem and a system image wrote
 *   it; otherwise it is a finding.
 * - Any other type is not a finding.
 * Returns { status: 'inconclusive' | 'clean' | 'findings', entries, findings, ignored, ignoredByImage, counts }.
 * Identical findings are folded into one with a `count`; an `Error` with no subsystem is also told apart by the image that
 * wrote it, and carries its file name as `image`. `ignored` counts all the system noise, and `ignoredByImage`
 * ([{ image, message, count }]) says which of it was ignored because of the image.
 */
export function auditIosLog(text) {
  const entries = parseNdjson(text);
  const counts = {};
  for (const e of entries) counts[e.messageType ?? 'untyped'] = (counts[e.messageType ?? 'untyped'] ?? 0) + 1;
  if (entries.length === 0) {
    return { status: 'inconclusive', reason: 'the log has no entry of the app since the review started', entries: 0, findings: [], ignored: 0, ignoredByImage: [], counts };
  }
  const folded = new Map();
  const byImage = new Map();
  let ignored = 0;
  for (const e of entries) {
    const type = e.messageType;
    if (type !== 'Fault' && type !== 'Error') continue;
    if (type === 'Error' && isApple(e.subsystem)) {
      ignored += 1;
      continue;
    }
    const message = clip(e.eventMessage);
    // Only an error with no subsystem is judged, and told apart, by the image that wrote it.
    const path = type === 'Error' && !e.subsystem ? String(e.senderImagePath ?? '') : '';
    const key = `${type}|${e.subsystem ?? ''}|${path}|${message}`;
    if (isSystemImage(path)) {
      ignored += 1;
      const seen = byImage.get(key);
      if (seen) seen.count += 1;
      else byImage.set(key, { image: fileName(path), message, count: 1 });
      continue;
    }
    const found = folded.get(key);
    if (found) found.count += 1;
    else folded.set(key, { level: type === 'Fault' ? 'fault' : 'error', subsystem: e.subsystem ?? '', ...(path ? { image: fileName(path) } : {}), category: e.category ?? '', message, time: e.timestamp ?? null, count: 1 });
  }
  const findings = [...folded.values()];
  return { status: findings.length ? 'findings' : 'clean', entries: entries.length, findings, ignored, ignoredByImage: [...byImage.values()], counts };
}

/**
 * The audit of an iOS slice in the shape the review state keeps: { verdict, findings: [{ class, line, excerpt, count }],
 * counts, ignored, ignoredByImage, reason? }. A finding's class is `fault` or `error`; its excerpt is `[subsystem] message`, or
 * `[no subsystem, image] message` for an error with no subsystem, so a waiver matches it as it matches the findings of the
 * other adapters.
 */
export function iosReviewAudit(text) {
  const r = auditIosLog(text);
  if (r.status === 'inconclusive') return { verdict: 'REVIEW INCONCLUSIVE', reason: r.reason, findings: [], counts: {}, ignored: 0, ignoredByImage: [] };
  const findings = r.findings.map((f) => ({ class: f.level, line: 0, excerpt: `[${f.subsystem || ['no subsystem', f.image].filter(Boolean).join(', ')}] ${f.message}`.slice(0, 200), count: f.count }));
  const counts = {};
  findings.forEach((f) => { counts[f.class] = (counts[f.class] ?? 0) + 1; });
  return { verdict: findings.length === 0 ? 'REVIEW PASSED' : 'REVIEW REJECTED', findings, counts, ignored: r.ignored, ignoredByImage: r.ignoredByImage };
}

export const defaultCrashDir = () => join(homedir(), 'Library', 'Logs', 'DiagnosticReports');

/** `2026-11-19 10:58:33.2326 -0600` (the `captureTime` of a crash report) as a Date, or null. */
function parseCaptureTime(text) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)? ([+-]\d{2})(\d{2})$/.exec(String(text ?? ''));
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3] ?? ''}${m[4]}:${m[5]}`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * The crash reports of the app that were captured after the review started, as findings of class `crash`.
 * A report is a `.ips` file under `~/Library/Logs/DiagnosticReports/` named `<executable>-<YYYY-MM-DD-HHMMSS>.ips`: its first
 * line is a JSON header and the rest a JSON body. The body's `captureTime` is when the app crashed (the file name is when the
 * report was written, some seconds later) and its `procPath` holds the UDID of the simulator that ran the app. A folder that
 * cannot be read gives no findings; the log audit still decides the verdict.
 */
export function findCrashReports({ dir = defaultCrashDir(), processName, since, udid, readDir = readdirSync, readFile = readFileSync }) {
  let names;
  try {
    names = readDir(dir);
  } catch {
    return [];
  }
  const start = new Date(String(since ?? '').replace(' ', 'T'));
  const found = [];
  for (const name of names) {
    if (!name.startsWith(`${processName}-`) || !name.endsWith('.ips')) continue;
    let body;
    try {
      body = JSON.parse(String(readFile(join(dir, name), 'utf8')).split('\n').slice(1).join('\n'));
    } catch {
      continue;
    }
    const at = parseCaptureTime(body.captureTime);
    if (!at || at < start) continue;
    if (udid && !String(body.procPath ?? '').includes(udid)) continue;
    const how = body.termination?.indicator || body.exception?.type || 'crashed';
    found.push({ class: 'crash', line: 0, excerpt: `[crash report] ${processName} ${how} at ${body.captureTime} (${name})`.slice(0, 200), count: 1, at });
  }
  return found.sort((a, b) => a.at - b.at).map(({ at, ...f }) => f);
}

/**
 * Read the simulator log of a review source `{ source: 'simulator', udid, process, since }` and audit it, then add the crash
 * reports of the app since the review started. A simulator that cannot be read is inconclusive, never a pass; a crash report
 * is a finding even when the log is empty, because an app that crashed leaves a quiet log.
 */
export function auditSimulatorSource(source, readLog, readCrashes = findCrashReports) {
  let audit;
  try {
    audit = iosReviewAudit(readLog({ udid: source.udid, since: source.since, processName: source.process }));
  } catch (err) {
    const unreadable = /could not be read/.test(err.message);
    audit = { verdict: 'REVIEW INCONCLUSIVE', reason: unreadable ? `${err.message}: boot the simulator again, start the app and repeat the steps` : `the review state cannot be audited: ${err.message}`, findings: [], counts: {}, ignored: 0, ignoredByImage: [] };
  }
  const crashes = readCrashes({ processName: source.process, since: source.since, udid: source.udid });
  if (crashes.length === 0) return audit;
  const counts = { ...audit.counts, crash: crashes.length };
  const { reason, ...rest } = audit;
  return { ...rest, verdict: 'REVIEW REJECTED', findings: [...audit.findings, ...crashes], counts };
}

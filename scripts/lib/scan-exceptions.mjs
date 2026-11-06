// Reviewed false positives of the credential scan. Implements "A reviewed false positive of the credential scan can be
// listed with a reason" of the go specification.
//
// The list is `.relevo/scan-exceptions.json`: { "exceptions": [{ "path", "pattern", "reason" }] }. An entry excuses a credential
// finding when the file matches `path` (a file or a glob of files) and the added line contains `pattern` as plain text; the
// line number never matters. Temporary markers are never excused. `.relevo/` is a protected path and the list is read from a
// commit, so an unattended run cannot change it.

import { matchesGlob } from './protected-paths.mjs';
import { addedLines, scanDiff } from './scan.mjs';

export const EXCEPTIONS_FILE = '.relevo/scan-exceptions.json';
export const MIN_PATTERN_LENGTH = 8;

/** Why an entry is refused, or null when it is acceptable. */
export function entryProblem(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'not an object';
  const { path, pattern, reason } = entry;
  if (typeof path !== 'string' || !path.trim()) return 'no path';
  if (typeof pattern !== 'string' || !pattern.trim()) return 'no pattern';
  if (typeof reason !== 'string' || !reason.trim()) return 'no reason';
  const p = path.trim().replace(/\\/g, '/');
  if (p.endsWith('/')) return 'the path is a folder';
  if (p.includes('**')) return 'the path is too broad (**)';
  if (p.split('/').pop() === '*') return 'the path names every file of a folder';
  if (pattern.trim().length < MIN_PATTERN_LENGTH) return `the pattern is shorter than ${MIN_PATTERN_LENGTH} characters`;
  return null;
}

/**
 * Read the text of the list. Returns { entries, refused: [{ index, path, problem }] }. A text that is missing or is not
 * valid gives no entries (the scan stays strict); an invalid text is reported in `refused`.
 */
export function parseExceptions(text) {
  if (text == null || !String(text).trim()) return { entries: [], refused: [] };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { entries: [], refused: [{ index: -1, path: EXCEPTIONS_FILE, problem: 'not valid JSON, so no exception applies' }] };
  }
  if (!data || !Array.isArray(data.exceptions)) return { entries: [], refused: [{ index: -1, path: EXCEPTIONS_FILE, problem: 'no "exceptions" list, so no exception applies' }] };
  const entries = [];
  const refused = [];
  data.exceptions.forEach((entry, index) => {
    const problem = entryProblem(entry);
    if (problem) refused.push({ index, path: typeof entry?.path === 'string' ? entry.path : '(no path)', problem });
    else entries.push({ path: entry.path.trim().replace(/\\/g, '/'), pattern: entry.pattern.trim(), reason: entry.reason.trim() });
  });
  return { entries, refused };
}

/**
 * Scan a diff and drop the credential findings that an entry excuses.
 * Returns { findings, applied: [{ path, reason }], refused }, where `applied` has one item per excused line.
 */
export function scanWithExceptions(diffText, exceptionsText) {
  const { entries, refused } = parseExceptions(exceptionsText);
  const all = scanDiff(diffText);
  if (entries.length === 0) return { findings: all, applied: [], refused };
  const texts = new Map(addedLines(diffText).map((l) => [`${l.file}:${l.line}`, l.text]));
  const applied = [];
  const excused = new Set();
  // A line is excused only when every finding on it is a credential that the same entry covers.
  const byLine = new Map();
  all.forEach((f) => byLine.set(`${f.file}:${f.line}`, [...(byLine.get(`${f.file}:${f.line}`) ?? []), f]));
  byLine.forEach((fs, key) => {
    if (fs.some((f) => f.kind !== 'credential')) return;
    const text = texts.get(key) ?? '';
    const entry = entries.find((e) => fs[0].file && matchesGlob(fs[0].file, e.path) && text.includes(e.pattern));
    if (!entry) return;
    excused.add(key);
    applied.push({ path: fs[0].file, reason: entry.reason });
  });
  return { findings: all.filter((f) => !excused.has(`${f.file}:${f.line}`)), applied, refused };
}

/** Lines that say what was excused and what was refused. Never contains the pattern or the secret. */
export function formatExceptionReport({ applied = [], refused = [] }) {
  const lines = [];
  if (applied.length > 0) {
    lines.push(`scan exceptions applied: ${applied.length}`);
    applied.forEach((a) => lines.push(`  ${a.path}  reviewed: ${a.reason}`));
  }
  refused.forEach((r) => lines.push(`scan exception refused: ${r.path}${r.index >= 0 ? ` (entry ${r.index + 1})` : ''}  ${r.problem}`));
  return lines.join('\n');
}

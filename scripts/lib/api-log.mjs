// The log files of an api review (Laravel): which files a setting names, how much of each existed when the review
// started, and what they received since. Implements "The audit of an api review reads the log since the review
// started" of openspec/specs/review/spec.md. Nothing is truncated or deleted: the log belongs to the person.

import { existsSync, openSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const segmentRe = (segment) => new RegExp(`^${segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);

/** The files a path or glob names, relative to `cwd`, sorted. A `*` or `?` works inside any one segment. */
export function expandLog(pattern, { cwd = '.' } = {}) {
  const walk = (base, segments) => {
    if (segments.length === 0) return [base];
    const [head, ...tail] = segments;
    const dir = join(cwd, base);
    if (!/[*?]/.test(head)) {
      const next = base ? `${base}/${head}` : head;
      return existsSync(join(cwd, next)) ? walk(next, tail) : [];
    }
    if (!existsSync(dir)) return [];
    const re = segmentRe(head);
    return readdirSync(dir).filter((n) => re.test(n)).sort().flatMap((n) => walk(base ? `${base}/${n}` : n, tail));
  };
  return walk('', String(pattern).split('/').filter(Boolean)).filter((f) => statSync(join(cwd, f)).isFile());
}

/** What the files named by `pattern` hold now: { pattern, offsets: { file: size } }. Recorded when the review starts. */
export function snapshotLog(pattern, { cwd = '.' } = {}) {
  const offsets = {};
  expandLog(pattern, { cwd }).forEach((f) => { offsets[f] = statSync(join(cwd, f)).size; });
  return { pattern, offsets };
}

function readFrom(file, start) {
  const size = statSync(file).size;
  const from = size < start ? 0 : start; // a file that shrank was rotated: read it from its start
  const length = size - from;
  if (length === 0) return '';
  const buffer = Buffer.alloc(length);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buffer, 0, length, from);
  } finally {
    closeSync(fd);
  }
  return buffer.toString('utf8');
}

/**
 * What the log files received since the snapshot: { text, files, unreadable: [{ file, reason }] }.
 * A file that appeared later is read from its start; a file of the snapshot that is gone, or that cannot be read, is reported.
 */
export function readSlice(snapshot, { cwd = '.' } = {}) {
  const files = expandLog(snapshot.pattern, { cwd });
  const unreadable = [];
  const parts = [];
  files.forEach((f) => {
    try {
      const text = readFrom(join(cwd, f), snapshot.offsets[f] ?? 0);
      if (text) parts.push(text.endsWith('\n') ? text : `${text}\n`);
    } catch (err) {
      unreadable.push({ file: f, reason: err.code ?? err.message });
    }
  });
  Object.keys(snapshot.offsets).filter((f) => !files.includes(f)).forEach((f) => unreadable.push({ file: f, reason: 'the file no longer exists (rotated or deleted)' }));
  return { text: parts.join(''), files, unreadable };
}

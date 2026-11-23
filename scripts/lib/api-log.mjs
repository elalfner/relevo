// The log files of an api review (Laravel): which files a setting names, how much of each existed when the review
// started, and what they received since. Implements "The audit of an api review reads the log since the review
// started" of openspec/specs/review/spec.md. Nothing is truncated or deleted: the log belongs to the person.

import { spawnSync } from 'node:child_process';
import { existsSync, openSync, readSync, closeSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOCKER_PREFIX = 'docker:';
const COMPOSE_PREFIX = 'compose:';

/** Is the log setting the log of a container (`docker:<name>`) and not a path or a glob? */
export const isDockerLog = (pattern) => String(pattern).startsWith(DOCKER_PREFIX);

/** Is the log setting the log of the services of a Docker Compose project (`compose:<service>,<service>`)? */
export const isComposeLog = (pattern) => String(pattern).startsWith(COMPOSE_PREFIX);

/** The service names a `compose:` setting lists; empty means every service of the project. */
export const servicesOf = (pattern) => String(pattern).slice(COMPOSE_PREFIX.length).split(',').map((n) => n.trim()).filter(Boolean);

/** The `project_id` of supabase/config.toml in `cwd`, or null. */
export function projectIdOf({ cwd = '.' } = {}) {
  const file = join(cwd, 'supabase', 'config.toml');
  if (!existsSync(file)) return null;
  const m = /^\s*project_id\s*=\s*["']([^"']+)["']/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1] : null;
}

/** The name of the container a `docker:` setting names, with `{project_id}` read from supabase/config.toml. */
export function containerOf(pattern, { cwd = '.' } = {}) {
  const name = String(pattern).slice(DOCKER_PREFIX.length);
  if (!name.includes('{project_id}')) return name;
  const id = projectIdOf({ cwd });
  if (!id) throw new Error('review.log names {project_id} but supabase/config.toml has no project_id: run from the folder of the platform');
  return name.replaceAll('{project_id}', id);
}

// A service's log can be far larger than the 1 MiB that spawnSync allows by default (ENOBUFS), so a read is allowed 256 MiB.
const MAX_BUFFER = 256 * 1024 * 1024;

const defaultRun = (command, args, { cwd } = {}) => {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, ...(cwd ? { cwd } : {}) });
  if (r.error) return { status: 127, stdout: '', stderr: r.error.message };
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

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

/**
 * What the files named by `pattern` hold now: { pattern, offsets: { file: size } }. Recorded when the review starts.
 * For `docker:<name>` it is { pattern, source: 'docker', container, since } instead.
 */
export function snapshotLog(pattern, { cwd = '.', now = () => new Date() } = {}) {
  // A container has no offsets: what it wrote since this moment is the slice. Nothing is cleared or restarted.
  // The services of a Compose project are read the same way, from the folder of the platform where the Compose file lives.
  if (isComposeLog(pattern)) return { pattern, source: 'compose', services: servicesOf(pattern), since: now().toISOString() };
  if (isDockerLog(pattern)) return { pattern, source: 'docker', container: containerOf(pattern, { cwd }), since: now().toISOString() };
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

const firstLine = (r, fallback) => String(r.stderr || r.stdout || fallback).trim().split('\n')[0];

/** Why a service could not be read; a buffer overflow says what to do and what it costs. */
function composeReason(service, r) {
  const why = firstLine(r, `docker compose exited ${r.status}`);
  if (!/ENOBUFS/.test(why)) return why;
  return `the log of ${service} since the review started is larger than the read allows (${why}); reset-log starts the window from now, and the runs recorded so far then stop proving it, so the tests run again`;
}

/**
 * The services of a Compose project are read one at a time, so that one large log does not hide the others. Only a read: nothing is
 * restarted or recreated. Any failure (no Compose file, the daemon is down, an unknown service, a log too large) is an unreadable
 * source named by its service.
 */
function readCompose(snapshot, { cwd, run }) {
  const label = `compose${snapshot.services.length > 0 ? `:${snapshot.services.join(',')}` : ''}`;
  let services = snapshot.services;
  if (services.length === 0) {
    const listed = run('docker', ['compose', 'config', '--services'], { cwd });
    if (listed.status !== 0) return { text: '', files: [], unreadable: [{ file: label, reason: firstLine(listed, `docker compose exited ${listed.status}`) }] };
    services = String(listed.stdout ?? '').split('\n').map((n) => n.trim()).filter(Boolean);
  }
  const parts = [];
  const unreadable = [];
  services.forEach((service) => {
    const r = run('docker', ['compose', 'logs', '--no-color', '--since', snapshot.since, service], { cwd });
    if (r.status !== 0) {
      // One service failing leaves the others readable; a single named service keeps the label of the setting.
      unreadable.push({ file: snapshot.services.length === 1 ? label : `compose:${service}`, reason: composeReason(service, r) });
      return;
    }
    const text = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (text) parts.push(text.endsWith('\n') ? text : `${text}\n`);
  });
  return { text: parts.join(''), files: [label], unreadable };
}

/**
 * What the log files received since the snapshot: { text, files, unreadable: [{ file, reason }] }.
 * A file that appeared later is read from its start; a file of the snapshot that is gone, or that cannot be read, is reported.
 */
export function readSlice(snapshot, { cwd = '.', run = defaultRun } = {}) {
  if (snapshot.source === 'docker') {
    // `docker logs` writes what the container wrote to stdout and stderr (Postgres logs to stderr).
    const r = run('docker', ['logs', '--since', snapshot.since, snapshot.container]);
    if (r.status !== 0) {
      const why = String(r.stderr || r.stdout || `docker exited ${r.status}`).trim().split('\n')[0];
      return { text: '', files: [], unreadable: [{ file: snapshot.container, reason: why }] };
    }
    return { text: `${r.stdout ?? ''}${r.stderr ?? ''}`, files: [snapshot.container], unreadable: [] };
  }
  if (snapshot.source === 'compose') return readCompose(snapshot, { cwd, run });
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

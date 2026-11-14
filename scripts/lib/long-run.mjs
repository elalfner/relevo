// The state of a long command run in the background by scripts/long-run.mjs, read from its files. Implements the
// "long-commands" specification. The folder of a run holds `spec.json` (what to run, written by `start`), `status.json`
// (written by the supervisor) and `log` (written by the operating system, not through the supervisor, so a killed
// supervisor or job leaves it readable).

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readFileSync } from './guarded-fs.mjs';

export const RUN_DIR = '.relevo-run';
/** The longest a `wait` lasts: under the 2 minutes after which the tool of the agent cuts a foreground command. */
export const MAX_WAIT_SECONDS = 110;
export const DEFAULT_WAIT_SECONDS = 90;
/** The exit codes of `status` and `wait`. */
export const EXIT = { passed: 0, failed: 1, running: 2, usage: 3, interrupted: 4 };
/** How long a started run may have no status file before it is called interrupted (the supervisor writes it at once). */
const START_GRACE_MS = 10_000;

export const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
export const runDir = (root, id) => resolve(root, RUN_DIR, id);

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
export const readSpec = (dir) => readJson(join(dir, 'spec.json'));

/** Is a process alive? EPERM means it exists and is not ours. */
export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; }
  // A killed process that nobody has reaped yet still answers, as a zombie: it is gone.
  try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}

/** The last `bytes` bytes of the log as text ('' when there is no log). */
export function logTail(dir, bytes = 8192) {
  const file = join(dir, 'log');
  if (!existsSync(file)) return '';
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  try {
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } finally { closeSync(fd); }
}

// A carriage return starts a new line: tools that redraw a progress line (flutter, npm) write many of them.
const clean = (s) => String(s).replace(/\r\n?/g, '\n').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/[^\t\n\x20-\x7e]/g, '');
/** The last non-empty line of a text, without colours or control characters, cut to `max` characters. */
export function lastLine(text, max = 160) {
  const line = clean(text).split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
/** The last `n` lines of a text, cleaned. */
export const tailLines = (text, n) => clean(text).split('\n').slice(-Math.max(1, Math.min(200, n)) - 1).join('\n').trimEnd();

/**
 * The state of a run: { state: 'unknown' | 'running' | 'passed' | 'failed' | 'interrupted', exit_code?, seconds, started_at }.
 * `interrupted` is a run whose supervisor is gone before it wrote its end: the log is still there.
 */
export function statusOf(dir, now = Date.now()) {
  const spec = readSpec(dir);
  if (!spec) return { state: 'unknown', seconds: 0 };
  const started = Date.parse(spec.started_at) || now;
  const st = readJson(join(dir, 'status.json'));
  if (!st) return { state: now - started < START_GRACE_MS ? 'running' : 'interrupted', seconds: Math.round((now - started) / 1000), started_at: spec.started_at };
  if (st.state === 'done') return { state: st.exit_code === 0 ? 'passed' : 'failed', exit_code: st.exit_code, seconds: Math.round((st.duration_ms ?? 0) / 1000), started_at: spec.started_at };
  return { state: alive(st.pid) ? 'running' : 'interrupted', seconds: Math.round((now - started) / 1000), started_at: spec.started_at };
}

const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

/** The one line that `status` and `wait` print. The first word is the state. */
export function statusLine(id, dir, st) {
  const log = join(dir, 'log');
  const bytes = existsSync(log) ? statSync(log).size : 0;
  const last = lastLine(logTail(dir, 2048));
  const tail = last ? ` | last: ${last}` : '';
  if (st.state === 'running') return `running ${st.seconds}s | ${id} | log ${size(bytes)}${tail}`;
  if (st.state === 'interrupted') return `interrupted after ${st.seconds}s | ${id} | the log is readable: ${log}${tail}`;
  return `${st.state} exit=${st.exit_code} ${st.seconds}s | ${id} | log ${size(bytes)}${tail}`;
}

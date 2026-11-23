// Where the Docker Compose project of a review is running from. Compose records the folder a project was started from in the label
// `com.docker.compose.project.working_dir` of its containers; a review run from another checkout exercises the code that instance runs.
// Only reads: `docker compose ps -q` and `docker inspect`. Implements "The Compose project in use is compared with the checkout under
// review" of openspec/specs/review/spec.md.

import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

const LABEL = '{{index .Config.Labels "com.docker.compose.project.working_dir"}}';
const lines = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Compare the working directory Compose recorded for the running project of `cwd` with `cwd`.
 * deps: capture(command, args, { cwd }) -> { status, stdout }, real(path) -> the path with links resolved,
 *       branchOf(dir) -> the branch checked out there, or null.
 * Returns { state: 'same' | 'other' | 'not-running' | 'unknown', ... }; 'other' carries { dirs, branches, cwd, cwdBranch }.
 */
export function composeWorkdir({ cwd }, { capture, real = (p) => p, branchOf = () => null }) {
  const ps = capture('docker', ['compose', 'ps', '-q'], { cwd });
  if (ps.status !== 0) return { state: 'unknown', detail: 'Docker did not say which containers the project runs' };
  const ids = lines(ps.stdout);
  if (ids.length === 0) return { state: 'not-running', detail: 'no running Compose project was found for this folder' };
  const inspected = capture('docker', ['inspect', '--format', LABEL, ...ids], { cwd });
  if (inspected.status !== 0) return { state: 'unknown', detail: 'Docker did not answer the inspection of the running containers' };
  const dirs = [...new Set(lines(inspected.stdout))];
  if (dirs.length === 0) return { state: 'unknown', detail: 'the running containers do not record the folder they were started from' };
  const here = real(cwd);
  const other = dirs.filter((d) => real(d) !== here);
  if (other.length === 0) return { state: 'same' };
  return { state: 'other', dirs: other, cwd, branches: Object.fromEntries(other.map((d) => [d, branchOf(d)])), cwdBranch: branchOf(cwd) };
}

/** The sentence for the person, or null when there is nothing to say. */
export function composeNote(result) {
  if (result.state === 'same') return null;
  if (result.state === 'not-running') return `${result.detail}`;
  if (result.state === 'unknown') return `could not tell where the Compose project runs from: ${result.detail}`;
  const branch = (b) => (b ? ` (branch ${b})` : '');
  const from = result.dirs.map((d) => `${d}${branch(result.branches[d])}`).join(', ');
  return `the Compose project is running from ${from}, not from ${result.cwd}${branch(result.cwdBranch)}: the tests exercise the code the instance runs, which may be another branch`;
}

/** The real dependencies: a read-only Docker and git. */
export const realComposeDeps = {
  capture: (command, args, { cwd } = {}) => {
    const r = spawnSync(command, args, { encoding: 'utf8', cwd, maxBuffer: 1024 * 1024 });
    return { status: r.error ? 127 : r.status, stdout: r.stdout ?? '' };
  },
  real: (p) => { try { return realpathSync(p); } catch { return p; } },
  branchOf: (dir) => {
    const r = spawnSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() || null : null;
  },
};

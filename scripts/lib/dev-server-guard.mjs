// Which processes listen on a port and where they run from, through lsof. A review does not switch branches under a
// dev server that runs from the working tree, because the server would lose its files.
// Implements "Review restores the base branch upon completion" of openspec/specs/review/spec.md.

import { sep } from 'node:path';

/** The pids listening on a TCP port; null when lsof cannot be run. `lsof(args)` returns { status, stdout }. */
export function listeners(port, lsof) {
  const r = lsof(['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN']);
  if (r.status === 127) return null;
  // lsof exits 1 with nothing printed when no process matches.
  return String(r.stdout ?? '').split('\n').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
}

/** The current folder of a process; null when lsof cannot tell. */
export function cwdOf(pid, lsof) {
  const r = lsof(['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  if (r.status !== 0) return null;
  const line = String(r.stdout ?? '').split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

/** The port of an http address, with the default of its scheme. */
export function portOf(url) {
  const u = new URL(url);
  return Number(u.port || (u.protocol === 'https:' ? 443 : 80));
}

/**
 * May the working tree switch branches? Looks at the processes listening on the port of `url`.
 * Returns { code, servers }: 0 none runs from the repository, 1 one does, 3 it cannot tell.
 * deps: lsof(args) -> { status, stdout }, realpath(path) -> path.
 */
export function guard({ url, repoRoot }, { lsof, realpath }) {
  const pids = listeners(portOf(url), lsof);
  if (pids === null) return { code: 3, servers: [], reason: 'lsof is not available, so the folder of the server cannot be known' };
  const root = realpath(repoRoot);
  const servers = pids.map((pid) => {
    const cwd = cwdOf(pid, lsof);
    let real = null;
    try {
      real = cwd ? realpath(cwd) : null;
    } catch { /* a folder that no longer exists is outside the repository */ }
    return { pid, cwd, inside: real !== null && (real === root || real.startsWith(`${root}${sep}`)) };
  });
  if (servers.some((s) => s.inside)) return { code: 1, servers, reason: 'a server of the address under review runs from the working tree' };
  if (servers.some((s) => s.cwd === null)) return { code: 3, servers, reason: 'the folder of a server on that port cannot be read' };
  return { code: 0, servers, reason: null };
}

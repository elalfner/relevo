// Dev servers the agent starts for a line that needs the app with another configuration. Each one runs in a process
// group of its own on a port that was free, is recorded, and is the only kind of server the agent may stop.
// Implements "Servers started by the agent are its own" and "Environment files of a reviewed app are never read" of
// openspec/specs/review/spec.md.

import { join } from 'node:path';
import { listeners } from './dev-server-guard.mjs';

export const EXIT = { refused: 1, busy: 3, envFiles: 4, noLsof: 5 };

// Example files hold no values the app loads.
const EXAMPLES = new Set(['.env.example', '.env.sample', '.env.template']);
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The environment files a dev server loads by itself, by name only: `.env` and `.env.*`, without the examples. */
export function envFiles(names) {
  return names.filter((n) => /^\.env(\..+)?$/.test(n) && !EXAMPLES.has(n)).sort();
}

/** The environment of the server: the current one with `set` applied and `unset` removed. */
export function serverEnv(base, { set = {}, unset = [] }) {
  const env = { ...base, ...set };
  unset.forEach((n) => { delete env[n]; });
  return env;
}

/** Parse `NAME=value` pairs of --set; throws on a bad name. */
export function parseSet(pairs) {
  return Object.fromEntries(pairs.map((p) => {
    const i = p.indexOf('=');
    const name = i === -1 ? p : p.slice(0, i);
    if (i === -1 || !NAME_RE.test(name)) throw new Error(`--set needs NAME=value (got ${p})`);
    return [name, p.slice(i + 1)];
  }));
}

const fail = (code, message) => ({ code, message });

/**
 * Start a server. deps: lsof(args), listDir() -> names in the project folder, spawn(command, env, logFile) -> pgid,
 * load() -> records, save(records), baseEnv, dir (the evidence folder, for the log).
 */
export function startServer({ port, set = {}, unset = [], command }, deps) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return fail(2, 'the port must be a number between 1024 and 65535');
  if (!command || command.length === 0) return fail(2, 'give the command that starts the server after --');
  const busy = listeners(port, deps.lsof);
  if (busy === null) return fail(EXIT.noLsof, 'lsof is not available, so a free port cannot be told apart: leave this line for the person');
  if (busy.length > 0) return fail(EXIT.busy, `port ${port} is busy (pid ${busy.join(', ')}): choose another; the server already there is not touched`);
  const files = envFiles(deps.listDir());
  if (unset.length > 0 && files.length > 0) {
    return fail(EXIT.envFiles, `a variable cannot be removed while ${files.join(', ')} exist${files.length === 1 ? 's' : ''}: the dev server loads them by itself. Pre-check this line by reading the code, or leave it for the person`);
  }
  const records = deps.load();
  const log = join(deps.dir ?? 'evidence', 'servers', `${port}.log`);
  // `{port}` stands for the port that was checked free: the `serve` command of a profile is written with it.
  const argv = command.map((token) => token.replaceAll('{port}', String(port)));
  const pgid = deps.spawn(argv, serverEnv(deps.baseEnv, { set, unset }), log);
  records.push({ port, pgid, command: argv.join(' '), set: Object.keys(set), unset });
  deps.save(records);
  return { code: 0, message: `started on port ${port} (process group ${pgid}); log in ${log}`, pgid };
}

/**
 * Confirm that the process listening on the port belongs to the recorded server; when it does not (the server moved
 * to another port, or failed), stop the recorded group and forget it.
 */
export function checkServer({ port }, deps) {
  const records = deps.load();
  const record = records.find((r) => r.port === port);
  if (!record) return fail(EXIT.refused, `no server started by this script is recorded on port ${port}`);
  const pids = listeners(port, deps.lsof) ?? [];
  if (pids.some((pid) => deps.pgidOf(pid) === record.pgid)) return { code: 0, message: `port ${port} is served by the recorded server` };
  deps.kill(record.pgid);
  deps.save(records.filter((r) => r !== record));
  return fail(EXIT.refused, `port ${port} is not served by the server that was started (it may have moved to another port): it was stopped`);
}

/** Stop recorded servers only: one port, or all of them. A port with no record stops nothing. */
export function stopServers({ port = null, all = false }, deps) {
  const records = deps.load();
  const chosen = all ? records : records.filter((r) => r.port === port);
  if (!all && chosen.length === 0) return fail(EXIT.refused, `no server started by this script is recorded on port ${port}: nothing was stopped`);
  chosen.forEach((r) => deps.kill(r.pgid));
  deps.save(records.filter((r) => !chosen.includes(r)));
  return { code: 0, message: chosen.length === 0 ? 'no server to stop' : `stopped ${chosen.map((r) => `port ${r.port}`).join(', ')}` };
}

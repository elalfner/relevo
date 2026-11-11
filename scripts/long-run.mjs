#!/usr/bin/env node
// Runs a command that takes minutes in the background, with a log and a status, so that it does not depend on the 2-minute
// limit of the tool the agent runs commands with. Usage:
//   node scripts/long-run.mjs start  --id <id> [--root dir] [--cwd dir] -- <command...>
//   node scripts/long-run.mjs start  --id <id> --check <analyze|test> --base <ref> [--platform name] [--config relevo.yml] [--root dir]
//   node scripts/long-run.mjs status --id <id> [--root dir] [--tail <lines>]
//   node scripts/long-run.mjs wait   --id <id> [--root dir] [--max-seconds <n>] [--tail <lines>]
// `start` returns at once. One command argument is run by `sh -c`; several are run as they are. `--check` takes the command
// from the stack profile, not from the caller, and when it ends with exit 0 on a diff that did not change while it ran it
// records the result for the validation gate, which then does not run it again. Nothing records a result without a run.
// `status` and `wait` print one line whose first word is running, passed, failed or interrupted; `wait` returns before
// --max-seconds (default 90, at most 110) whether or not the command finished. The files are under .relevo-run/<id>/, which
// git ignores; the log is written by the operating system, so it stays readable if this script or the job is killed.
//   exit 0: passed   exit 1: failed   exit 2: still running   exit 3: bad arguments or unknown id   exit 4: interrupted

import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_NAMES, checkKey, currentDiff, ensureExcluded, recordResult, resolveContext } from './lib/check-store.mjs';
import { DEFAULT_WAIT_SECONDS, EXIT, MAX_WAIT_SECONDS, RUN_DIR, logTail, readSpec, runDir, statusLine, statusOf, tailLines, validId } from './lib/long-run.mjs';

const SELF = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const sub = argv[0];
const dashdash = argv.indexOf('--');
const flags = dashdash === -1 ? argv.slice(1) : argv.slice(1, dashdash);
const rest = dashdash === -1 ? [] : argv.slice(dashdash + 1);
const opt = (n) => { const i = flags.indexOf(`--${n}`); return i === -1 ? undefined : flags[i + 1]; };
const fail = (m, code = EXIT.usage) => { console.error(m); process.exit(code); };
const writeAtomic = (file, data) => { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, `${JSON.stringify(data)}\n`); renameSync(tmp, file); };

if (sub === '_supervise') await supervise(argv[1]);
else if (!['start', 'status', 'wait'].includes(sub)) fail('usage: long-run.mjs start|status|wait --id <id> ... (see the header of the script)');
else {
  const id = opt('id');
  if (!validId(id)) fail('give --id <name> of lowercase letters, digits and hyphens (at most 40)');
  const root = resolve(opt('root') ?? '.');
  const dir = runDir(root, id);
  if (sub === 'start') start(root, dir, id);
  else report(id, dir, sub === 'wait');
}

function start(root, dir, id) {
  if (existsSync(dir) && statusOf(dir).state === 'running') fail(`${id} is already running: use status or wait`);
  const check = opt('check');
  const spec = { id, started_at: new Date().toISOString(), cwd: resolve(opt('cwd') ?? root) };
  if (check !== undefined) {
    if (!CHECK_NAMES.includes(check)) fail(`--check is one of ${CHECK_NAMES.join(', ')}`);
    if (!opt('base')) fail('--check needs --base <ref>, the base branch as go has it');
    if (rest.length) fail('--check takes its command from the profile: give no command');
    const ctx = resolveContext({ configPath: opt('config') ?? join(root, 'relevo.yml'), platformName: opt('platform') });
    if (!ctx.ok) fail(ctx.error);
    const command = ctx.profile.commands[check];
    if (!command) fail(`the profile of ${ctx.name} has no ${check} command`);
    Object.assign(spec, { check: { name: check, base: opt('base'), config: ctx.configPath, platform: ctx.name }, argv: ['sh', '-c', command], command, cwd: resolve(ctx.root, ctx.platform.path), root: ctx.root });
  } else {
    if (rest.length === 0) fail('give the command after --');
    Object.assign(spec, { argv: rest.length === 1 ? ['sh', '-c', rest[0]] : rest, command: rest.join(' ') });
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  ensureExcluded(root, RUN_DIR);
  writeAtomic(join(dir, 'spec.json'), spec);
  const child = spawn(process.execPath, [SELF, '_supervise', dir], { detached: true, stdio: 'ignore', cwd: root });
  child.unref();
  console.log(`started ${id} | log ${join(dir, 'log')} | next: node long-run.mjs wait --id ${id}`);
}

async function report(id, dir, waiting) {
  if (!readSpec(dir)) fail(`no run named ${id} under ${RUN_DIR}/`);
  const max = Math.max(1, Math.min(MAX_WAIT_SECONDS, Number(opt('max-seconds') ?? DEFAULT_WAIT_SECONDS) || DEFAULT_WAIT_SECONDS));
  const until = Date.now() + max * 1000;
  let st = statusOf(dir);
  while (waiting && st.state === 'running' && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1000));
    st = statusOf(dir);
  }
  console.log(statusLine(id, dir, st));
  const n = Number(opt('tail'));
  if (n > 0) console.log(tailLines(logTail(dir, 65536), n));
  process.exit(EXIT[st.state] ?? EXIT.usage);
}

// The detached process: runs the command with its output going straight to the log, writes the end, and records a
// check that passed on a diff that did not change.
async function supervise(dir) {
  const spec = readSpec(dir);
  if (!spec) process.exit(3);
  const fd = openSync(join(dir, 'log'), 'a');
  const t0 = Date.now();
  writeAtomic(join(dir, 'status.json'), { state: 'running', pid: process.pid });
  let before = null;
  let ctx = null;
  if (spec.check) {
    try {
      ctx = resolveContext({ configPath: spec.check.config, platformName: spec.check.platform });
      if (ctx.ok) before = currentDiff({ root: ctx.root, base: spec.check.base, profile: ctx.profile }).hash;
    } catch { before = null; }
  }
  const code = await new Promise((done) => {
    const c = spawn(spec.argv[0], spec.argv.slice(1), { cwd: spec.cwd, stdio: ['ignore', fd, fd] });
    c.on('error', (e) => { writeFileSync(fd, `\n${e.message}\n`); done(127); });
    c.on('close', (status, signal) => done(status ?? (signal ? 128 : 1)));
  });
  closeSync(fd);
  const duration_ms = Date.now() - t0;
  // The check is recorded before the end is written, so a `wait` that sees the end also sees the record.
  if (spec.check && before) {
    try {
      const after = currentDiff({ root: ctx.root, base: spec.check.base, profile: ctx.profile }).hash;
      if (after === before) recordResult(ctx.root, { key: checkKey({ hash: before, command: spec.command, path: ctx.platform.path }), name: spec.check.name, command: spec.command, exit_code: code, duration_ms, output: logTail(dir, 8192) });
    } catch { /* the gate then runs the check itself */ }
  }
  writeAtomic(join(dir, 'status.json'), { state: 'done', pid: process.pid, exit_code: code, duration_ms });
}

#!/usr/bin/env node
// Starts, checks and stops the dev servers the agent needs for lines that require another configuration. Usage:
//   node scripts/extra-server.mjs start --port 5174 [--set NAME=value ...] [--unset NAME ...] -- npx vite --port 5174 --strictPort
//   node scripts/extra-server.mjs check --port 5174     after web-preflight.mjs --wait: the port is served by that server
//   node scripts/extra-server.mjs stop --port 5174 | --all
// Each server runs in a process group of its own, logs to evidence/servers/<port>.log and is recorded in
// evidence/servers.json (override the folder with --dir). Only recorded servers are ever stopped, so the person's own
// server is never touched. The environment files are never read; their names only decide whether --unset can work.
//   exit 0: done   exit 1: not recorded, or the port is not served by the recorded server (it was stopped)
//   exit 2: bad arguments   exit 3: the port is busy   exit 4: --unset with environment files present   exit 5: no lsof

import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { checkServer, parseSet, startServer, stopServers } from './lib/extra-server.mjs';

const dash = process.argv.indexOf('--');
const argv = dash === -1 ? process.argv.slice(2) : process.argv.slice(2, dash);
const command = dash === -1 ? [] : process.argv.slice(dash + 1);
const [action] = argv;
const values = (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));
const usage = (message) => {
  if (message) console.error(message);
  console.error('usage: extra-server.mjs start --port <p> [--set NAME=value] [--unset NAME] -- <command>\n       extra-server.mjs check --port <p>\n       extra-server.mjs stop --port <p> | --all');
  process.exit(2);
};

const dir = values('dir')[0] ?? 'evidence';
const file = join(dir, 'servers.json');
const port = values('port')[0] === undefined ? null : Number(values('port')[0]);
const lsof = (args) => {
  const r = spawnSync('lsof', args, { encoding: 'utf8' });
  return { status: r.error ? 127 : r.status ?? 1, stdout: r.stdout ?? '' };
};
const deps = {
  lsof,
  dir,
  baseEnv: process.env,
  listDir: () => readdirSync(process.cwd()),
  load: () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []),
  save: (records) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${JSON.stringify(records, null, 2)}\n`);
  },
  spawn: (cmd, env, log) => {
    mkdirSync(join(dir, 'servers'), { recursive: true });
    const fd = openSync(log, 'a');
    const child = spawn(cmd[0], cmd.slice(1), { detached: true, stdio: ['ignore', fd, fd], env });
    child.unref();
    return child.pid;
  },
  pgidOf: (pid) => Number(spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim()),
  kill: (pgid) => {
    try {
      process.kill(-pgid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  },
};

let result;
try {
  if (action === 'start') {
    if (port === null) usage('start needs --port');
    result = startServer({ port, set: parseSet(values('set')), unset: values('unset'), command }, deps);
  } else if (action === 'check') {
    if (port === null) usage('check needs --port');
    result = checkServer({ port }, deps);
  } else if (action === 'stop') {
    if (port === null && !argv.includes('--all')) usage('stop needs --port or --all');
    result = stopServers({ port, all: argv.includes('--all') }, deps);
  } else usage();
} catch (error) {
  usage(error.message);
}
(result.code === 0 ? console.log : console.error)(result.message);
process.exit(result.code);

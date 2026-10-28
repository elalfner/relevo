#!/usr/bin/env node
// The progress of a cloud build, for the comment on the issue. Implements the progress requirements of the go specification.
//   node scripts/progress.mjs phase <planning|specification|development|qa|delivery> [--attempt n] [--of m]
//       announces the phase that `go` enters; used by the go skill
//   node scripts/progress.mjs watch --issue n --decision <base64> --max-minutes n [--repo owner/name] [--config relevo.yml]
//       the loop of the workflow: every 30 seconds it edits the one progress comment; ends by itself
//   node scripts/progress.mjs stop [--wait seconds]
//       asks the loop to end and waits for it
//   node scripts/progress.mjs close --issue n [--outcome result|none] [--run-url url] [--repo owner/name] [--config relevo.yml]
//       replaces the progress comment by one line
// Everything is kept under $RELEVO_PROGRESS_DIR, outside the working tree (the agent needs it clean). Without that
// variable every command does nothing, which is also what a local run gets.
// It never fails: exit 0 always, so a step that reports progress cannot fail a run. Errors go to stderr.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { resolveLabelNames } from './lib/labels.mjs';
import {
  INTERVAL_MS, PHASES, closeProgress, minutesSince, progressClient, readAnnouncement, readTreeFacts, renderClosed, watch,
} from './lib/progress.mjs';

const args = process.argv.slice(3);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const fail = (message) => process.stderr.write(`progress: ${message}\n`);

const dir = process.env.RELEVO_PROGRESS_DIR;
const statePath = dir ? join(dir, 'state.json') : null;

function writeFileAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function readState() {
  try {
    return statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  } catch {
    return {};
  }
}

function language() {
  const path = resolve(arg('config') ?? 'relevo.yml');
  if (!existsSync(path)) return { language: 'en', config: null };
  const loaded = loadConfig(readFileSync(path, 'utf8'));
  return loaded.ok ? { language: loaded.config.language, config: loaded.config } : { language: 'en', config: null };
}

// The decision of the workflow is data: only the change id, the base branch and the branch of the issue are read, and only when they look like names.
function decisionOf(b64) {
  try {
    const d = JSON.parse(Buffer.from(String(b64 ?? ''), 'base64').toString('utf8'));
    const name = (v) => (typeof v === 'string' && /^[A-Za-z0-9._/-]+$/.test(v) ? v : null);
    return { changeId: name(d.change_id), base: name(d.base), branch: name(d.branch) };
  } catch {
    return { changeId: null, base: null, branch: null };
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function main(command) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });

  if (command === 'phase') {
    const phase = args[0];
    if (!PHASES.includes(phase)) return fail(`unknown phase "${phase}"`);
    const whole = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
    writeFileAtomic(join(dir, 'phase.json'), JSON.stringify({ phase, attempt: whole(arg('attempt')), of: whole(arg('of')) }));
    return;
  }

  if (command === 'stop') {
    writeFileSync(join(dir, 'stop'), '');
    const pidFile = join(dir, 'watch.pid');
    if (!existsSync(pidFile)) return;
    const pid = Number(readFileSync(pidFile, 'utf8'));
    const until = Date.now() + Number(arg('wait') ?? 20) * 1000;
    const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    while (alive() && Date.now() < until) await sleep(200);
    return;
  }

  const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
  const issue = arg('issue');
  if (!repo || !issue) return fail('give --issue and --repo (or GITHUB_REPOSITORY)');
  const client = progressClient({ gh: realGh, repo, issue });
  const { language: lang, config } = language();

  if (command === 'watch') {
    const { changeId, base, branch } = decisionOf(arg('decision'));
    // A new watch is a new run: what an earlier run left in a folder that persists (its comment, its start, its stop file) is dropped.
    // The announcement is kept: the workflow clears the folder before the agent starts, and the agent announces after this.
    const state = {};
    rmSync(join(dir, 'stop'), { force: true });
    writeFileAtomic(statePath, JSON.stringify(state));
    writeFileSync(join(dir, 'watch.pid'), String(process.pid));
    const building = resolveLabelNames(config?.labels ?? {}).building;
    const why = await watch({
      client, state, language: lang, maxMs: Number(arg('max-minutes') ?? 65) * 60 * 1000,
      intervalMs: arg('interval') ? Number(arg('interval')) * 1000 : INTERVAL_MS,
      readFacts: () => readTreeFacts({ cwd: process.cwd(), changeId, base, branch, git: (a) => execFileSync('git', a, { encoding: 'utf8' }) }),
      readAnnounced: () => readAnnouncement(dir),
      stopRequested: () => existsSync(join(dir, 'stop')),
      stillBuilding: () => JSON.parse(realGh(['api', `repos/${repo}/issues/${issue}`])).labels
        .some((l) => (typeof l === 'string' ? l : l.name) === building),
      sleep, save: (s) => writeFileAtomic(statePath, JSON.stringify(s)), log: fail,
    });
    process.stderr.write(`progress: the check ended (${why})\n`);
    return;
  }

  if (command === 'close') {
    const state = readState();
    const text = renderClosed({
      minutes: state.startedAt != null ? minutesSince(state.startedAt, Date.now()) : null,
      runUrl: arg('run-url') || null, outcome: arg('outcome') === 'none' ? 'none' : 'result', language: lang,
    });
    const result = closeProgress({ client, state, text });
    if (result === 'done') writeFileAtomic(statePath, JSON.stringify(state));
    return;
  }

  fail(`unknown command "${command}"`);
}

try {
  await main(process.argv[2]);
} catch (err) {
  fail(String(err?.message ?? err).split('\n')[0]);
}
process.exit(0);

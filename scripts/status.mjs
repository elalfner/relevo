#!/usr/bin/env node
// Who is waiting on what. Read-only: it never changes an issue, label or branch.
//   node scripts/status.mjs --repo owner/name [--me login] [--json] [--config relevo.yml]
//   node scripts/status.mjs --input state.json [--me login] [--now ISO] [--json]
// exit 0: reported   exit 2: invalid configuration or bad arguments

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh, realGhLinks } from './lib/github.mjs';
import { buildStatus, renderStatus } from './lib/status.mjs';
import { gatherStatus } from './lib/status-data.mjs';
import { realState } from './lib/build-state.mjs';
import { readLocalBuilds } from './lib/status-local.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { renderStatusFiles, statusFiles } from './lib/status-files.mjs';
import { loadTracker } from './lib/tracker/load.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;

// A files project: the issues come from the files, with no GitHub, no person to identify and no deadlines.
if (config.tracker === 'files') {
  const { tracker } = loadTracker({ configPath });
  let branches = [];
  try {
    branches = spawnSync('git', ['branch', '--list', 'feature/*', '--format=%(refname:short)'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  } catch { /* no git: no branches to report */ }
  const report = statusFiles({ config, issues: tracker.issueList({ state: 'open', fields: 'number,title,labels' }), branches });
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : renderStatusFiles(report, config.language).join('\n'));
  process.exit(0);
}

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
let data;
if (arg('input')) {
  data = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  // Asks the clone this runs in, without changing it; anything but a clear answer is "unknown".
  const mergeProbe = (base, branch) => {
    const r = spawnSync('node', [new URL('./branch-state.mjs', import.meta.url).pathname, '--merge', base, branch], { encoding: 'utf8' });
    try {
      return JSON.parse(r.stdout);
    } catch {
      return { result: 'unknown', files: [] };
    }
  };
  data = gatherStatus({ gh: realGh, ghLinks: realGhLinks(), repo, config, withUsage: true, mergeProbe });
  // The builds running on this machine come from the state beside the worktrees; outside a repository there are none to show.
  try {
    const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    if (top.status === 0) data = { ...data, localBuilds: readLocalBuilds({ repoRoot: top.stdout.trim(), state: realState }) };
  } catch {
    // the section is an addition: without it the report is the same as before
  }
}
let me = arg('me') ?? null;
if (!me && !arg('input')) {
  try {
    me = JSON.parse(realGh(['api', 'user'])).login;
  } catch {
    me = null;
  }
}

const report = buildStatus({ config, ...data, me, now: arg('now') ? new Date(arg('now')) : new Date() });
console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : renderStatus(report, config.language));

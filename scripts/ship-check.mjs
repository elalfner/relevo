#!/usr/bin/env node
// Decides whether a pull request may be merged. Usage:
//   node scripts/ship-check.mjs --repo owner/name --branch feature/31-x [--invoker login] [--config relevo.yml] [--labels a,b] [--baseline <head sha>] [--issue 31]
//     --labels    the issue's labels; with them the issue must be pr-open
//     --baseline  the head recorded when ship started: an approval given on it still counts after the archive commit
//   node scripts/ship-check.mjs --input pr.json --invoker login      (a saved `gh pr view --json ...`; null for no PR)
// Prints the decision as JSON.   exit 0: may be merged   exit 1: must stop   exit 2: bad arguments or configuration

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { shipDecision } from './lib/ship.mjs';
import { baselineChecks, loadPr } from './lib/ship-github.mjs';

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

let pr;
let invoker = arg('invoker');
let carried;

if (arg('input')) {
  pr = JSON.parse(readFileSync(arg('input'), 'utf8'));
} else {
  const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
  const branch = arg('branch');
  if (!repo || !branch) fail('usage: ship-check.mjs --repo owner/name --branch <branch> [--invoker login] [--config relevo.yml]');
  pr = loadPr(realGh, repo, branch);
  invoker ??= realGh(['api', 'user', '--jq', '.login']).trim();
  // The archive commit may have no checks of its own; the approved head's count when only openspec/ changed since.
  if (pr && arg('baseline')) carried = baselineChecks(realGh, repo, arg('baseline'), pr.headRefOid);
}

const decision = shipDecision({
  config: loaded.config,
  pr,
  invoker,
  baseline: arg('baseline'),
  labels: arg('labels') === undefined ? undefined : arg('labels').split(',').map((l) => l.trim()).filter(Boolean),
  issue: arg('issue'),
  baselineChecks: carried,
});
console.log(JSON.stringify(decision, null, 2));
process.exit(decision.allowed ? 0 : 1);

#!/usr/bin/env node
// Decides whether a pull request may be merged. Usage:
//   node scripts/ship-check.mjs --repo owner/name --branch feature/31-x [--invoker login] [--config relevo.yml]
//   node scripts/ship-check.mjs --input pr.json --invoker login      (a saved `gh pr view --json ...`; null for no PR)
// Prints the decision as JSON.   exit 0: may be merged   exit 1: must stop   exit 2: bad arguments or configuration

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { shipDecision } from './lib/ship.mjs';

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

const FIELDS = 'number,state,isDraft,mergeable,title,author,reviews,statusCheckRollup,headRefName,baseRefName';
let pr;
let invoker = arg('invoker');

if (arg('input')) {
  pr = JSON.parse(readFileSync(arg('input'), 'utf8'));
} else {
  const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
  const branch = arg('branch');
  if (!repo || !branch) fail('usage: ship-check.mjs --repo owner/name --branch <branch> [--invoker login] [--config relevo.yml]');
  const found = JSON.parse(realGh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state', '--limit', '5']));
  const open = found.find((p) => p.state === 'OPEN') ?? found[0];
  pr = open ? JSON.parse(realGh(['pr', 'view', String(open.number), '--repo', repo, '--json', FIELDS])) : null;
  invoker ??= realGh(['api', 'user', '--jq', '.login']).trim();
}

const decision = shipDecision({ config: loaded.config, pr, invoker });
console.log(JSON.stringify(decision, null, 2));
process.exit(decision.allowed ? 0 : 1);

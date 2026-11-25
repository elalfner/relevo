#!/usr/bin/env node
// Review and ship of a files project, with no pull request. Usage:
//   node scripts/ship-local.mjs record-review --issue 3 --result passed|failed [--config relevo.yml]
//   node scripts/ship-local.mjs record-gate   --issue 3                          (the receipt of the gate must be valid and green here)
//   node scripts/ship-local.mjs check         --issue 3 [--json]                 what would stop the merge; exit 0 may be merged, 1 must stop
//   node scripts/ship-local.mjs merge         --issue 3 --title "<title>"        the squash merge, only after the person's written yes
// `check` and the records never change the tree. `merge` changes nothing unless the base branch is checked out and clean.
//   exit 0: done   exit 1: refused (the reasons are printed)   exit 2: bad usage or a files project that is not set up

import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { branchName } from './lib/branch.mjs';
import { gatherShipFacts, mergeLocal, shipDecisionFiles } from './lib/ship-local.mjs';
import { loadTracker } from './lib/tracker/load.mjs';

const args = process.argv.slice(2);
const verb = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
const git = (a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

const issue = opt('issue');
if (!['record-review', 'record-gate', 'check', 'merge'].includes(verb) || !/^\d{1,9}$/.test(issue ?? '')) fail('usage: ship-local.mjs record-review|record-gate|check|merge --issue <n>');
const configPath = resolve(opt('config') ?? 'relevo.yml');
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;
if (config.tracker !== 'files') fail('ship-local.mjs is for a files project; a github project is shipped with a pull request');
const { tracker } = loadTracker({ configPath });
let record;
try { record = tracker.issueGet(issue); } catch (error) { fail(error.message); }
const branch = git(['branch', '--list', `feature/${issue}-*`, '--format=%(refname:short)']).split('\n').filter(Boolean)[0] ?? branchName(Number(issue), record.title);
const exists = (ref) => { try { git(['rev-parse', '--verify', '-q', ref]); return true; } catch { return false; } };
if (!exists(branch)) fail(`the branch of issue ${issue} does not exist here (${branch}): there is nothing to deliver`, 1);

if (verb === 'record-review') {
  const result = opt('result');
  if (!['passed', 'failed'].includes(result)) fail('--result must be passed or failed');
  tracker.deliverySet(issue, { branch, base: config.branches.base, title: record.title, review: { result, commit: git(['rev-parse', branch]).trim(), at: new Date().toISOString() } });
  console.log(JSON.stringify({ issue: Number(issue), review: result }));
  process.exit(0);
}
if (verb === 'record-gate') {
  const receipt = spawnSync(process.execPath, [fileURLToPath(new URL('./receipt-check.mjs', import.meta.url))], { encoding: 'utf8' });
  if (receipt.status !== 0) fail(`the gate has no valid green receipt here: ${(receipt.stdout + receipt.stderr).trim()}`, 1);
  tracker.deliverySet(issue, { branch, base: config.branches.base, title: record.title, gate: { status: 'green', commit: git(['rev-parse', 'HEAD']).trim(), at: new Date().toISOString() } });
  console.log(JSON.stringify({ issue: Number(issue), gate: 'green' }));
  process.exit(0);
}

const delivery = tracker.deliveryRead(issue);
const facts = gatherShipFacts({ git, branch, base: config.branches.base, delivery });
const decision = shipDecisionFiles({ config, issue: record, delivery, ...facts });
const out = { issue: Number(issue), branch, base: config.branches.base, title: record.title, ...decision };
if (verb === 'check') {
  console.log(opt('json') !== undefined || args.includes('--json') ? JSON.stringify(out, null, 2) : (decision.ok ? `issue ${issue} may be merged into ${config.branches.base}` : decision.reasons.map((r) => `- ${r}`).join('\n')));
  process.exit(decision.ok ? 0 : 1);
}
// merge: the person already said yes; the gate is checked again so that nothing changed in between.
if (!decision.ok) { console.error(decision.reasons.map((r) => `- ${r}`).join('\n')); process.exit(1); }
try {
  const merged = mergeLocal({ git, branch, base: config.branches.base, issue, title: opt('title') ?? record.title });
  tracker.issueClose(issue);
  console.log(JSON.stringify({ issue: Number(issue), ...merged, closed: true }));
} catch (error) {
  fail(error.message, 1);
}

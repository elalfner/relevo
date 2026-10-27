#!/usr/bin/env node
// Ships an issue on GitHub, without a model, when a person applied the `relevo:ship` label. Usage (in the workflow):
//   node scripts/ship-unattended.mjs --repo owner/name --issue 31 --actor login --actor-type User --work <checkout>
// Environment: GH_TOKEN (the workflow token), GH_PUSH_TOKEN (the App token, or the workflow token), HAS_APP (true|false).
// Prints the outcome as JSON.   exit 0: merged, stopped with a comment, or ignored   exit 2: bad arguments
// Any other failure exits non-zero, and the workflow's last step reports it on the issue.

import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUnattendedShip } from './lib/ship-unattended.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const [repo, issue, actor, actorType, work] = ['repo', 'issue', 'actor', 'actor-type', 'work'].map(arg);
if (!repo || !/^\d+$/.test(issue ?? '') || !actor || !actorType || !work) {
  console.error('usage: ship-unattended.mjs --repo owner/name --issue <n> --actor <login> --actor-type <User|Bot> --work <checkout>');
  process.exit(2);
}

const ghWith = (token) => (args) => execFileSync('gh', args, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GH_TOKEN: token ?? process.env.GH_TOKEN },
});
const sh = (cmd, args, { cwd, input, env } = {}) => {
  const r = spawnSync(cmd, args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? String(r.error ?? '') };
};

const outcome = await runUnattendedShip({
  repo,
  issue,
  actor,
  actorType,
  hasApp: process.env.HAS_APP === 'true',
  workDir: resolve(work),
  pluginRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  sh,
  gh: ghWith(process.env.GH_TOKEN),
  pushGh: ghWith(process.env.GH_PUSH_TOKEN || process.env.GH_TOKEN),
});
console.log(JSON.stringify(outcome, null, 2));

#!/usr/bin/env node
// Says where `/relevo:go` runs and whether the cloud can build, so that a session on the web offers the build request instead
// of building. Read-only.
//   node scripts/go-where.mjs [--repo owner/name] [--config relevo.yml]
//   prints {"remote":true,"cloud":{"builds":true,"reason":null,"credential":"present"}}
//   reason: no_workflow (the go workflow is not on the default branch), no_credential, paused (RELEVO_CLOUD_GO is off)
//   exit 0: answered   exit 2: no repository

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { ghClient } from './lib/gh-client.mjs';
import { findRepo, isRemote } from './lib/gh-web.mjs';
import { readCloudFacts, whereGoRuns } from './lib/go-where.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY ?? null;
if (!repo && isRemote(process.env)) repo = findRepo({ env: process.env, git });
if (!repo) {
  try {
    repo = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    repo = null;
  }
}
if (!repo) {
  console.error('could not tell the repository: give --repo owner/name');
  process.exit(2);
}

let agentBuild = 'claude';
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(configPath)) {
  const loaded = loadConfig(readFileSync(configPath, 'utf8'));
  if (loaded.ok) agentBuild = loaded.config.agent?.build ?? 'claude';
}

const facts = readCloudFacts({ gh: ghClient(), repo });
console.log(JSON.stringify(whereGoRuns({ env: process.env, ...facts, agentBuild })));

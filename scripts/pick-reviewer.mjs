#!/usr/bin/env node
// Picks the reviewer of a pull request. Usage:
//   node scripts/pick-reviewer.mjs --repo owner/name --author login --pr 40 [--config relevo.yml]
// Prints {"reviewer": "login"} or {"reviewer": null} when nobody is eligible.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { openReviewCounts, realGh } from './lib/github.mjs';
import { pickReviewer } from './lib/reviewers.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
const author = arg('author');
const pr = Number(arg('pr'));
if (!repo || !author || !Number.isInteger(pr)) fail('usage: pick-reviewer.mjs --repo owner/name --author login --pr <number> [--config relevo.yml]');

const path = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(path)) fail(`relevo.yml not found at ${path}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(path, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;

if (config.review.mode === 'none') {
  console.log(JSON.stringify({ reviewer: null, reason: 'review.mode is none' }));
} else {
  const candidates = config.team.members.filter((m) => m !== author && m !== config.team.spec_writer);
  const openCounts = openReviewCounts({ gh: realGh, repo, logins: candidates });
  const reviewer = pickReviewer({
    members: config.team.members, specWriter: config.team.spec_writer, author,
    approvers: config.team.approvers, mode: config.review.mode, openCounts, prNumber: pr,
  });
  console.log(JSON.stringify({ reviewer }));
}

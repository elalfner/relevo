#!/usr/bin/env node
// Used when no reviewer could be chosen: labels the issue `needs-reviewer` (next to its state) and mentions the spec writer.
//   node scripts/needs-reviewer.mjs --repo owner/name --issue 12 --title "Add total" --pr-url <url> [--config relevo.yml] [--dry-run]
// Prints the decision as JSON.   exit 0: done   exit 2: invalid configuration or bad arguments

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { renderMessage } from './lib/messages.mjs';
import { noReviewerDecision } from './lib/reviewers.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
const issue = Number(arg('issue'));
const title = arg('title');
const prUrl = arg('pr-url');
if (!repo || !Number.isInteger(issue) || !title || !prUrl) fail('usage: needs-reviewer.mjs --repo owner/name --issue <n> --title <text> --pr-url <url> [--config relevo.yml] [--dry-run]');

const path = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(path)) fail(`relevo.yml not found at ${path}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(path, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;

const dry = process.argv.includes('--dry-run');
const labels = dry ? [] : JSON.parse(realGh(['api', `repos/${repo}/issues/${issue}`])).labels.map((l) => (typeof l === 'string' ? l : l.name));
const decision = noReviewerDecision({ config, issue: { number: issue, title, pr: prUrl, labels } });
if (!dry) {
  if (decision.labels.add.length) realGh(['issue', 'edit', String(issue), '--repo', repo, ...decision.labels.add.flatMap((l) => ['--add-label', l])]);
  if (decision.comment) realGh(['issue', 'comment', String(issue), '--repo', repo, '--body', renderMessage(decision.comment.kind, decision.comment.data, config.language)]);
}
console.log(JSON.stringify(decision));

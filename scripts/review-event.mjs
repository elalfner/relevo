#!/usr/bin/env node
// Reacts to a pull request review or push. Reads the GitHub Actions event (GITHUB_EVENT_NAME and
// GITHUB_EVENT_PATH), updates the issue label and posts the hand-off.
//   node scripts/review-event.mjs --repo owner/name [--config relevo.yml] [--event-name n] [--event-path file] [--dry-run]
//   exit 0: handled or nothing to do   exit 2: invalid configuration or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { issueFromBranch } from './lib/branch.mjs';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { renderMessage } from './lib/messages.mjs';
import { planReviewEvent } from './lib/review-events.mjs';

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

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
const eventName = arg('event-name') ?? process.env.GITHUB_EVENT_NAME;
const eventPath = arg('event-path') ?? process.env.GITHUB_EVENT_PATH;
if (!repo || !eventName || !eventPath) fail('give --repo, and the event through GITHUB_EVENT_NAME and GITHUB_EVENT_PATH (or --event-name and --event-path)');
const payload = JSON.parse(readFileSync(eventPath, 'utf8'));

const prData = payload.pull_request;
const number = issueFromBranch(prData?.head?.ref);
if (!number) {
  console.log(JSON.stringify({ action: 'ignored', reason: 'not a Relevo feature branch' }));
  process.exit(0);
}

let event;
if (eventName === 'pull_request_review') {
  event = { kind: 'review', state: String(payload.review.state).toLowerCase(), reviewer: payload.review.user.login, body: payload.review.body, url: payload.review.html_url };
} else if (eventName === 'pull_request' && payload.action === 'synchronize') {
  event = { kind: 'push' };
} else {
  console.log(JSON.stringify({ action: 'ignored', reason: `event ${eventName} is not handled` }));
  process.exit(0);
}

const pr = { number: prData.number, url: prData.html_url, author: prData.user.login };
const labels = JSON.parse(realGh(['api', `repos/${repo}/issues/${number}`])).labels.map((l) => (typeof l === 'string' ? l : l.name));
// The approval names the ship label only where the ship workflow runs: it runs from the default branch.
const shipWorkflow = event.kind === 'review' && event.state === 'approved' && (() => {
  try {
    realGh(['api', `repos/${repo}/contents/.github/workflows/relevo-ship.yml`, '--silent']);
    return true;
  } catch {
    return false;
  }
})();
const decision = planReviewEvent({ config, event, pr, issue: { number, labels }, shipWorkflow });
if (!decision) {
  console.log(JSON.stringify({ action: 'none' }));
  process.exit(0);
}

if (!process.argv.includes('--dry-run')) {
  const edit = ['issue', 'edit', String(number), '--repo', repo];
  decision.labels.add.forEach((l) => edit.push('--add-label', l));
  decision.labels.remove.forEach((l) => edit.push('--remove-label', l));
  if (edit.length > 5) realGh(edit);
  if (decision.comment) {
    realGh(['issue', 'comment', String(number), '--repo', repo, '--body', renderMessage(decision.comment.kind, decision.comment.data, config.language)]);
  }
}
console.log(JSON.stringify(decision));

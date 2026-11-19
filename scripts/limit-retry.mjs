#!/usr/bin/env node
// Decides what to do with an issue whose cloud run stopped at a usage limit. Usage:
//   node scripts/limit-retry.mjs --file <execution_file> --rescue-state <state> (--repo owner/name --issue N | --comments <json file>) [--now <ISO>]
// Prints one line of JSON:
//   { "action": "retry", "at": "<ISO>", "reason": "reset"|"backoff", "attempt": n, "max": 3, "marker": "<!-- relevo:retry ... -->" }
//   { "action": "stop", "reason": "work_not_kept"|"unreadable"|"bound", ... }
// Only a `kept` or `nothing` rescue state may retry (the work is on the branch or there was none), the comments of the issue must be
// readable (they give the count of retries), and at most 3 retries are made. It never fails: a step that cannot decide stops the retry.

import { decideRetry, retryMarker } from './lib/limit-retry.mjs';
import { realGh } from './lib/github.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

let log = '';
try {
  if (arg('file')) log = readFileSync(arg('file'), 'utf8');
} catch {
  log = '';
}
let comments = null;
try {
  if (arg('comments')) comments = JSON.parse(readFileSync(arg('comments'), 'utf8'));
  else if (arg('repo') && /^\d{1,9}$/.test(arg('issue') ?? '')) {
    comments = JSON.parse(realGh(['api', '--paginate', '--slurp', `repos/${arg('repo')}/issues/${arg('issue')}/comments?per_page=100`])).flat();
  }
} catch {
  comments = null;
}
const now = arg('now') ? Date.parse(arg('now')) : Date.now();
const decision = decideRetry({ log, comments, rescueState: arg('rescue-state') ?? '', now: Number.isFinite(now) ? now : Date.now() });
const out = decision.action === 'retry'
  ? { ...decision, at: new Date(decision.at).toISOString(), marker: retryMarker(decision) }
  : decision;
console.log(JSON.stringify(out));

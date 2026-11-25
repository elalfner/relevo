#!/usr/bin/env node
// Prints, as JSON, whether the last commit of the branch is the work that QA rejected and what the last failure
// comment of the issue found. Usage:
//   node scripts/failure-comment.mjs --repo owner/name --issue 42 --subject "$(git log -1 --format=%s)"
// A failed read prints { kept, found: false, error } and exits 0: `fix` then asks the person what is wrong.
import { loadTracker } from './lib/tracker/load.mjs';
import { failureContext } from './lib/failure-comment.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const issue = opt('issue');
if (!issue || !/^\d+$/.test(issue)) {
  console.error('usage: failure-comment.mjs --repo owner/name --issue <n> --subject "<subject of the last commit>"');
  process.exit(2);
}
const subject = opt('subject') ?? '';
let comments = [];
let error = null;
try {
  comments = loadTracker({ configPath: opt('config') ?? 'relevo.yml', repo: opt('repo') ?? null }).tracker.commentsList(issue);
} catch (err) {
  error = String(err.stderr ?? err.message ?? err).split('\n')[0];
}
const result = failureContext({ comments, subject, issue: Number(issue) });
console.log(JSON.stringify(error ? { ...result, error } : result));

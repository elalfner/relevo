#!/usr/bin/env node
// The command-line entry of the tracker, for the skills: `node scripts/tracker.mjs <verb> [args] [--config relevo.yml] [--repo owner/name]`.
// Verbs print JSON (or a URL for the ones that create) and exit 0; a failure prints the reason and exits 1; bad usage exits 2.
//   issue-get <n> [--fields a,b]      issue-list [--state s] [--search q]    issue-create --title t --body-file f [--milestone m] [--assignee a]
//   issue-edit-body <n> --body-file f  state-set <n> [--add a,b] [--remove c]  comment-add <n> --body-file f      comments-list <n>
//   issue-close <n>                    delivery-open --branch b --base b --title t --body-file f    delivery-get <branch>
// The body comes from a file (never from the command line), so no text of an issue is parsed as an option.

import { readFileSync } from './lib/guarded-fs.mjs';
import { VERBS } from './lib/tracker/index.mjs';
import { loadTracker } from './lib/tracker/load.mjs';

const args = process.argv.slice(2);
const verb = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const list = (name) => (opt(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
const number = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
const body = () => { const f = opt('body-file'); if (!f) fail('--body-file is required'); return readFileSync(f, 'utf8'); };
const need = (n) => { if (!/^\d{1,9}$/.test(String(n ?? ''))) fail(`${verb} needs an issue number`); return n; };

const KEBAB = Object.fromEntries(VERBS.map((v) => [v.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v]));
if (!KEBAB[verb]) fail(`unknown verb "${verb ?? ''}"; the verbs are: ${Object.keys(KEBAB).join(', ')}`);

let tracker;
try {
  ({ tracker } = loadTracker({ configPath: opt('config') ?? 'relevo.yml', repo: opt('repo') ?? null }));
} catch (error) {
  fail(error.message, 1);
}

const calls = {
  issueGet: () => tracker.issueGet(need(number), opt('fields')),
  issueList: () => tracker.issueList({ state: opt('state'), search: opt('search'), fields: opt('fields'), limit: opt('limit') }),
  issueCreate: () => tracker.issueCreate({ title: opt('title'), body: body(), milestone: opt('milestone'), assignee: opt('assignee') }),
  issueEditBody: () => tracker.issueEditBody(need(number), body()),
  stateSet: () => tracker.stateSet(need(number), { add: list('add'), remove: list('remove') }),
  commentAdd: () => tracker.commentAdd(need(number), body()),
  commentsList: () => tracker.commentsList(need(number)),
  issueClose: () => tracker.issueClose(need(number)),
  deliveryOpen: () => tracker.deliveryOpen({ branch: opt('branch'), base: opt('base'), title: opt('title'), body: body() }),
  deliveryGet: () => tracker.deliveryGet(args[1]),
};
try {
  const result = calls[KEBAB[verb]]();
  if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result));
} catch (error) {
  fail(String(error.stderr ?? error.message).trim(), 1);
}

#!/usr/bin/env node
// Decides the result of the QA lenses from their reports. Usage:
//   node scripts/qa-aggregate.mjs --plan plan.json --attempt 1 --retries 1 --report spec=spec.md --report security=sec.md ...
//        [--previous spec=spec1.md --previous code=code1.md] [--reasked code,spec] [--rules-file CLAUDE.md,docs/rules.md] [--repo-root .]
// --rules-file is `qa.rules_from`: a finding that cites `Rule: <file>:<line> "<quote>"` of a hard rule blocks when the quote is on that
// line (also from the `interface` lens on its last attempt, and in a `QA PASSED` report). `unverified` lists the citations that did
// not match; `rules_unread` lists a rules file that could not be read.
// --previous gives the report each lens wrote on the attempt before, from the second attempt: with them the output carries `contradiction`
// ({ pairs } or null) when every blocking finding reverses a finding that another lens asked for and no longer asks for, so a retry
// cannot meet both. A missing or unreadable file is left out, and then nothing can be compared (the retry runs as it does without it).
// plan.json is the output of lens-plan.mjs. Prints JSON { result, action, lenses, findings, advisory, ... }.
//   exit 0: QA PASSED   exit 1: QA REJECTED   exit 4: a report has no valid first line, ask that lens again once (see "reask")
//   exit 5: a second invalid report: end the run with the reason "lens report invalid", with no developer retry   exit 2: bad arguments

import { aggregate } from './lib/qa-aggregate.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { join } from 'node:path';
import { parseRules } from './lib/rules-file.mjs';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
const fail = (m) => { console.error(m); process.exit(2); };

const planFile = opt('plan');
const attempt = Number(opt('attempt'));
const retries = Number(opt('retries'));
if (!planFile || !Number.isInteger(attempt) || attempt < 1 || !Number.isInteger(retries) || retries < 0) fail('usage: qa-aggregate.mjs --plan plan.json --attempt <n> --retries <n> --report <lens>=<file> ... [--reasked a,b]');
let plan;
try {
  const parsed = JSON.parse(readFileSync(planFile, 'utf8'));
  plan = Array.isArray(parsed) ? parsed : parsed.lenses;
  if (!Array.isArray(plan)) throw new Error('no lenses');
} catch (err) {
  fail(`cannot read the plan: ${err.message}`);
}
const reports = {};
argv.forEach((a, i) => {
  if (a !== '--report') return;
  const [lens, ...rest] = String(argv[i + 1] ?? '').split('=');
  const file = rest.join('=');
  if (!lens || !file) fail('--report needs <lens>=<file>');
  try { reports[lens] = readFileSync(file, 'utf8'); } catch { reports[lens] = null; }
});
const previous = {};
argv.forEach((a, i) => {
  if (a !== '--previous') return;
  const [lens, ...rest] = String(argv[i + 1] ?? '').split('=');
  const file = rest.join('=');
  if (!lens || !file) fail('--previous needs <lens>=<file>');
  try { previous[lens] = readFileSync(file, 'utf8'); } catch { /* nothing to compare for that lens */ }
});
const root = opt('repo-root') ?? process.cwd();
const rules = [];
const rulesUnread = [];
(opt('rules-file') ?? '').split(',').map((f) => f.trim()).filter(Boolean).forEach((f) => {
  try { rules.push(...parseRules(f, readFileSync(join(root, f), 'utf8'))); } catch { rulesUnread.push(f); }
});
const out = aggregate({ rules, reports, plan, attempt, retries, previous, reasked: (opt('reasked') ?? '').split(',').map((s) => s.trim()).filter(Boolean) });
console.log(JSON.stringify(rulesUnread.length ? { ...out, rules_unread: rulesUnread } : out, null, 2));
process.exit(out.action === 'reask' ? 4 : out.action === 'stop' ? 5 : out.result === 'QA REJECTED' ? 1 : 0);

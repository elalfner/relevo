#!/usr/bin/env node
// Decides the result of the QA lenses from their reports. Usage:
//   node scripts/qa-aggregate.mjs --plan plan.json --attempt 1 --retries 1 --report spec=spec.md --report security=sec.md ...
//        [--reasked code,spec]
// plan.json is the output of lens-plan.mjs. Prints JSON { result, action, lenses, findings, advisory, ... }.
//   exit 0: QA PASSED   exit 1: QA REJECTED   exit 4: a report has no valid first line, ask that lens again once (see "reask")
//   exit 5: a second invalid report: end the run with the reason "lens report invalid", with no developer retry   exit 2: bad arguments

import { aggregate } from './lib/qa-aggregate.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

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
const out = aggregate({ reports, plan, attempt, retries, reasked: (opt('reasked') ?? '').split(',').map((s) => s.trim()).filter(Boolean) });
console.log(JSON.stringify(out, null, 2));
process.exit(out.action === 'reask' ? 4 : out.action === 'stop' ? 5 : out.result === 'QA REJECTED' ? 1 : 0);

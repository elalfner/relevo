#!/usr/bin/env node
// Evaluates the QA lenses on the seeded defects of tests/fixtures/lens-defects. Opt-in: it is not part of npm test.
//   node scripts/eval-lenses.mjs [--lens spec,code] [--cases <regex>] [--without-rule <text>] [--with-skill <file>]
//        [--out <dir>] [--max-budget-usd <usd per call, default 1>] [--price-in <usd per million>] [--price-out <usd per million>] [--yes] [--dry-run]
// Without --dry-run it spends model usage: it prints an estimate and asks before it starts (--yes answers for you).
// --dry-run uses a stub instead of the model, spends nothing and asks nothing.
//   exit 0 done   exit 2 bad arguments   exit 3 not confirmed (nothing was spent)

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs, loadCases, selectCases, estimate, evaluate, stubRunner, claudeRunner, renderReport } from './lib/lens-eval.mjs';

let opts;
try { opts = parseArgs(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exit(2); }

const cases = selectCases(loadCases(), opts);
if (cases.length === 0) { console.error('no case matches'); process.exit(2); }
const est = estimate(cases, opts);
console.log(`${est.runs} runs over ${cases.length} cases. Estimated ${est.inTok} input tokens and ${est.outTok} output tokens` +
  (est.usd == null ? ' (give --price-in and --price-out, in USD per million tokens, to see dollars).' : `: about ${est.usd.toFixed(2)} USD.`));

if (!opts.dryRun && !opts.yes) {
  if (!process.stdin.isTTY) { console.error('This would spend model usage. Run it in a terminal and answer, or pass --yes. Nothing was spent.'); process.exit(3); }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question('Spend it? [y/N] ', r));
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) { console.error('Not confirmed. Nothing was spent.'); process.exit(3); }
}

const runner = opts.dryRun ? stubRunner({ cases }) : claudeRunner(spawnSync, { maxBudgetUsd: opts.maxBudgetUsd });
const result = await evaluate(cases, opts, runner);
const date = new Date().toISOString().slice(0, 10);
const dir = opts.out ?? mkdtempSync(join(tmpdir(), 'relevo-lens-eval-'));
mkdirSync(dir, { recursive: true });
const stem = join(dir, `lens-evaluation-${date}${opts.dryRun ? '-dry-run' : ''}`);
writeFileSync(`${stem}.json`, `${JSON.stringify({ date, opts, estimate: est, ...result }, null, 1)}\n`);
writeFileSync(`${stem}.md`, renderReport(result, opts, est, date));
console.log(renderReport(result, opts, est, date));
console.log(`Report written to ${stem}.md and ${stem}.json`);

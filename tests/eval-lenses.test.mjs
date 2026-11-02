import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, loadCases, selectCases, estimate, evaluate, stubRunner, lensPrompt, readLens, judge } from '../scripts/lib/lens-eval.mjs';

const run = (args, opts = {}) => spawnSync(process.execPath, ['scripts/eval-lenses.mjs', ...args], { encoding: 'utf8', input: '', ...opts });

test('npm test never runs the evaluation', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test');
  for (const f of readdirSync('tests').filter((n) => n.endsWith('.test.mjs') && n !== 'eval-lenses.test.mjs')) {
    assert.ok(!/eval-lenses\.mjs/.test(readFileSync(join('tests', f), 'utf8')), `${f} runs the evaluation`);
  }
});

test('without --dry-run and without confirmation it spends nothing', () => {
  const r = run(['--lens', 'code']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Nothing was spent/);
  assert.match(r.stdout, /Estimated/);
});

test('it rejects an unknown option or lens', () => {
  assert.equal(run(['--nope']).status, 2);
  assert.equal(run(['--lens', 'style', '--dry-run']).status, 2);
});

test('a dry run writes a dated report and spends nothing', () => {
  const out = mkdtempSync(join(tmpdir(), 'lens-eval-test-'));
  const r = run(['--dry-run', '--out', out, '--price-in', '3', '--price-out', '15']);
  assert.equal(r.status, 0, r.stderr);
  const files = readdirSync(out);
  assert.ok(files.some((f) => /^lens-evaluation-\d{4}-\d{2}-\d{2}-dry-run\.md$/.test(f)));
  const md = readFileSync(join(out, files.find((f) => f.endsWith('.md'))), 'utf8');
  assert.match(md, /dry run/);
  assert.match(md, /\| code \| 1\/1 \| 0\/1 \| 0\.00 \|/);
  assert.match(md, /USD/);
});

test('the report counts misses and false positives', async () => {
  const opts = parseArgs(['--lens', 'code,security']);
  const cases = selectCases(loadCases(), opts);
  const runner = stubRunner({ cases, miss: ['code/flutter/state-update-after-await'], falsePositive: ['security/laravel/unescaped-output'] });
  const result = await evaluate(cases, opts, runner);
  assert.equal(result.per.code.found, 0);
  assert.equal(result.per.security.falsePositives, 1);
  assert.equal(result.per.security.found, cases.filter((c) => c.meta.lens === 'security').length);
});

test('options are recorded and change the prompt', () => {
  const opts = parseArgs(['--without-rule', 'Untrusted', '--with-skill', 'README.md', '--cases', 'flutter']);
  assert.equal(opts.withoutRule, 'Untrusted');
  const body = readLens('code').body;
  const text = lensPrompt(body, opts);
  assert.ok(!/untrusted/i.test(text.split('## Additional skill')[0]));
  assert.match(text, /## Additional skill/);
  assert.ok(selectCases(loadCases(), opts).every((c) => c.meta.stack === 'flutter'));
});

test('the estimate counts a bad and a good run per case', () => {
  const opts = parseArgs(['--price-in', '3', '--price-out', '15']);
  const cases = selectCases(loadCases(), opts);
  const e = estimate(cases, opts);
  assert.equal(e.runs, cases.length * 2);
  assert.ok(e.usd > 0);
  assert.equal(estimate(cases, parseArgs([])).usd, null);
});

test('a verdict counts as found only with the expected finding', () => {
  const expected = { finding: 'mounted|async gap' };
  assert.deepEqual(judge('QA REJECTED\n1. no mounted check', expected), { rejected: true, matched: true });
  assert.deepEqual(judge('QA REJECTED\n1. naming', expected), { rejected: true, matched: false });
  assert.deepEqual(judge('QA PASSED', expected), { rejected: false, matched: false });
});

test('the budget of each call can be lowered, and must be a number above zero', () => {
  assert.equal(parseArgs([]).maxBudgetUsd, 1);
  assert.equal(parseArgs(['--max-budget-usd', '0.2']).maxBudgetUsd, 0.2);
  assert.throws(() => parseArgs(['--max-budget-usd', '0']), /greater than zero/);
  assert.equal(run(['--max-budget-usd', 'x', '--dry-run']).status, 2);
});

test('the report keeps what the lens said where a good variant was flagged or a defect was missed, and only there', async () => {
  const opts = parseArgs(['--lens', 'code']);
  const cases = selectCases(loadCases(), opts);
  const id = cases[0].id;
  const clean = await evaluate(cases, opts, stubRunner({ cases }));
  assert.ok(clean.rows[0].bad.report.startsWith('QA REJECTED'), 'the text is kept in the rows');
  const { renderReport } = await import('../scripts/lib/lens-eval.mjs');
  const est = estimate(cases, opts);
  assert.doesNotMatch(renderReport(clean, opts, est, '2026-11-02'), /What the lens said/);
  const odd = await evaluate(cases, opts, stubRunner({ cases, falsePositive: [id] }));
  const md = renderReport(odd, opts, est, '2026-11-02');
  assert.match(md, /What the lens said where the result was not the expected one/);
  assert.match(md, new RegExp(`${id} \\(good variant, flagged\\)`));
});

import { materialize, claudeRunner, ORCHESTRATOR_NOTE } from '../scripts/lib/lens-eval.mjs';

test('a variant is laid out as the orchestrator leaves a change: a repository, the diff against main, and a valid green receipt', () => {
  const c = loadCases().find((x) => x.id === 'code/flutter/state-update-after-await');
  const dir = materialize(c.bad);
  const check = spawnSync(process.execPath, [join(process.cwd(), 'scripts/receipt-check.mjs'), '--root', dir], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const receipt = JSON.parse(readFileSync(join(dir, '.relevo-receipt/receipt.json'), 'utf8'));
  assert.equal(receipt.status, 'green');
  assert.match(receipt.commands[0].command, /does not run the analysis/, 'the receipt says that it is simulated');
  const diff = spawnSync('git', ['diff', 'main', '--stat'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.match(diff, /lib\/profile_page\.dart/);
  assert.ok(!diff.includes('.relevo-receipt'), 'the receipt is not part of the diff');
  assert.match(ORCHESTRATOR_NOTE, /simulated/);
});

test('the real runner works in the folder of the case and gives the lens its inputs, without calling a model here', async () => {
  const c = loadCases().find((x) => x.id === 'security/laravel/unescaped-output');
  const seen = [];
  const spawn = (cmd, args, o) => { seen.push({ cmd, args, o }); return { status: 0, stdout: JSON.stringify({ result: 'QA PASSED', total_cost_usd: 0.01 }) }; };
  const r = await claudeRunner(spawn, { maxBudgetUsd: 0.2 })({ lensText: 'LENS', files: c.bad, model: 'sonnet' });
  assert.deepEqual(r, { report: 'QA PASSED', cost: 0.01 });
  assert.match(seen[0].o.cwd, /relevo-lens-case-/);
  assert.match(seen[0].o.input, /^LENS[\s\S]*Inputs from the orchestrator/);
  assert.ok(seen[0].args.includes('0.2') && seen[0].args.includes('sonnet'));
  assert.ok(!seen[0].args.join(' ').includes('Write') && !seen[0].args.join(' ').includes('Edit'), 'no tool that changes files');
});

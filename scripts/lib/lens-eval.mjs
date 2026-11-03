// Evaluation of the QA lenses on seeded defects. Opt-in: nothing here runs in npm test with a model.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadCases } from './lens-cases.mjs';
import { RECEIPT_DIR, RECEIPT_FILE, buildReceipt, diffHash } from './validation-gate.mjs';

export const LENSES = ['spec', 'security', 'code', 'interface'];
const OUTPUT_TOKENS = 1500; // assumed size of one lens report, for the estimate
const tokensOf = (text) => Math.ceil(text.length / 4);

export function parseArgs(argv) {
  const o = { lenses: LENSES, cases: null, dryRun: false, yes: false, withoutRule: null, withSkill: null, out: null, priceIn: null, priceOut: null, maxBudgetUsd: 1 };
  const val = (i, name) => { if (i + 1 >= argv.length) throw new Error(`${name} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '--lens') { o.lenses = val(i, a).split(',').map((s) => s.trim()); i++; }
    else if (a === '--cases') { o.cases = val(i, a); i++; }
    else if (a === '--without-rule') { o.withoutRule = val(i, a); i++; }
    else if (a === '--with-skill') { o.withSkill = val(i, a); i++; }
    else if (a === '--out') { o.out = val(i, a); i++; }
    else if (a === '--price-in') { o.priceIn = Number(val(i, a)); i++; }
    else if (a === '--price-out') { o.priceOut = Number(val(i, a)); i++; }
    else if (a === '--max-budget-usd') { o.maxBudgetUsd = Number(val(i, a)); i++; }
    else throw new Error(`unknown option ${a}`);
  }
  for (const l of o.lenses) if (!LENSES.includes(l)) throw new Error(`unknown lens ${l}`);
  if (!(o.maxBudgetUsd > 0)) throw new Error('--max-budget-usd must be a number greater than zero');
  return o;
}

export function readLens(lens, root = process.cwd()) {
  const text = readFileSync(join(root, 'agents', `qa-${lens}.md`), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = Object.fromEntries((m ? m[1] : '').split('\n').map((l) => l.split(/:\s*/, 2)).filter((p) => p[0]));
  return { body: m ? m[2] : text, model: fm.model, effort: fm.effort };
}

export function lensPrompt(body, opts, root = process.cwd()) {
  let text = body;
  if (opts.withoutRule) {
    const needle = opts.withoutRule.toLowerCase();
    text = text.split('\n').filter((l) => !l.toLowerCase().includes(needle)).join('\n');
  }
  if (opts.withSkill) text += `\n\n## Additional skill\n\n${readFileSync(join(root, opts.withSkill), 'utf8')}\n`;
  return text;
}

/**
 * Lays a variant out the way the orchestrator leaves a change for a lens: a git repository whose base branch `main` is
 * empty and whose working tree holds the files (new files marked with intent-to-add, as the gate does), and a receipt of
 * the validation gate that is green and matches the diff. The receipt is SIMULATED: the harness does not run the analysis
 * or the tests of the stack, so it records that. Returns the folder.
 */
export function materialize(files, dir = mkdtempSync(join(tmpdir(), 'relevo-lens-case-'))) {
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=harness', '-c', 'user.email=harness@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'base');
  appendFileSync(join(dir, '.git', 'info', 'exclude'), `${RECEIPT_DIR}/\n`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  git('add', '-N', '.');
  const hash = diffHash(git('diff', 'main', '--', '.'));
  const receipt = buildReceipt({
    hash, base: git('rev-parse', 'main').trim(), baseRef: 'main', generated: [], platformPath: '.', status: 'green',
    commands: [{ name: 'simulated', command: 'not run: the evaluation harness does not run the analysis or the tests', status: 0, output: 'SIMULATED green receipt written by scripts/eval-lenses.mjs' }],
    scans: [],
  });
  mkdirSync(join(dir, RECEIPT_DIR), { recursive: true });
  writeFileSync(join(dir, RECEIPT_DIR, RECEIPT_FILE), `${JSON.stringify(receipt, null, 1)}\n`);
  return dir;
}

/**
 * The interface rules that the orchestrator gives the interface lens: the output of interface-rules.mjs for the stack of the
 * case, selected by the words of the files (the real run selects by the text of the issue). Empty when there are none.
 */
export function interfaceRules(stack, files, root = process.cwd()) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lens-rules-'));
  writeFileSync(join(dir, 'relevo.yml'), `platforms:\n  app:\n    stack: ${stack}\n    path: .\nlimits:\n  run_max_cost: 1\n`);
  const text = Object.values(files).join('\n');
  try {
    return execFileSync(process.execPath, [join(root, 'scripts/interface-rules.mjs'), '--role', 'qa', '--platform', 'app', '--config', join(dir, 'relevo.yml'), '--text', text], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

/** What the orchestrator tells a lens, for a change laid out by materialize(). */
export const orchestratorNote = (files = {}, rules = '') => {
  const change = Object.keys(files).map((f) => f.match(/^(openspec\/changes\/[^/]+)\//)?.[1]).find(Boolean);
  const issue = 'issue.md' in files ? '\nThe text of the issue that was built is in issue.md.' : '';
  return `## Inputs from the orchestrator

Change directory: ${change ?? 'none (there is no OpenSpec change; the change is the working tree against the base branch)'}.${issue}
Base branch to diff against: main. Folder of the platform: . (the root).
Receipt of the validation gate: .relevo-receipt/receipt.json. It is green and it matches the diff. It is simulated by the evaluation harness, which does not run the analysis or the tests: do not reject for that.
There is no stack profile section and no review script. Review the diff of the working tree against main as your lens, and apply your protocol.
${rules ? `\n## Interface rules for QA\n\n${rules}\n` : ''}`;
};
export const ORCHESTRATOR_NOTE = orchestratorNote();

export function casePrompt(lensText, variantFiles) {
  const files = Object.entries(variantFiles).map(([p, t]) => `### ${p}\n\`\`\`\n${t}\`\`\``).join('\n\n');
  return `${lensText}\n\n## Change to review\n\nThe change is exactly these files. Review them as your lens.\n\n${files}\n`;
}

// "found" = verdict REJECTED and a finding that matches the expected text.
export function judge(report, expected) {
  const first = report.trimStart().split('\n')[0].trim();
  const rejected = first === 'QA REJECTED';
  const matched = rejected && new RegExp(expected.finding, 'i').test(report);
  return { rejected, matched };
}

export function selectCases(all, opts) {
  let cs = all.filter((c) => opts.lenses.includes(c.meta.lens));
  if (opts.cases) {
    const re = new RegExp(opts.cases, 'i');
    cs = cs.filter((c) => re.test(c.id));
  }
  return cs;
}

export function estimate(cases, opts, root = process.cwd()) {
  const bodies = {};
  let inTok = 0;
  let runs = 0;
  for (const c of cases) {
    bodies[c.meta.lens] ??= lensPrompt(readLens(c.meta.lens, root).body, opts, root);
    for (const files of [c.bad, c.good]) {
      inTok += tokensOf(casePrompt(bodies[c.meta.lens], files));
      runs++;
    }
  }
  const outTok = runs * OUTPUT_TOKENS;
  const usd = opts.priceIn != null && opts.priceOut != null ? (inTok * opts.priceIn + outTok * opts.priceOut) / 1e6 : null;
  return { runs, inTok, outTok, usd };
}

export async function evaluate(cases, opts, runner, root = process.cwd()) {
  const lensInfo = {};
  const rows = [];
  for (const c of cases) {
    const lens = c.meta.lens;
    lensInfo[lens] ??= readLens(lens, root);
    lensInfo[lens].text ??= lensPrompt(lensInfo[lens].body, opts, root);
    const row = { id: c.id, lens };
    for (const variant of ['bad', 'good']) {
      const r = await runner({ lens, model: lensInfo[lens].model, effort: lensInfo[lens].effort, caseId: c.id, variant, prompt: casePrompt(lensInfo[lens].text, c[variant]), lensText: lensInfo[lens].text, stack: c.meta.stack, files: c[variant] });
      row[variant] = { ...judge(r.report, c.meta.expected), cost: r.cost ?? 0, report: r.report };
    }
    rows.push(row);
  }
  const per = {};
  for (const r of rows) {
    const p = (per[r.lens] ??= { cases: 0, found: 0, falsePositives: 0, cost: 0 });
    p.cases++;
    if (r.bad.matched) p.found++;
    if (r.good.rejected) p.falsePositives++;
    p.cost += r.bad.cost + r.good.cost;
  }
  return { rows, per, total: Object.values(per).reduce((s, p) => s + p.cost, 0) };
}

// Stub that spends nothing: rejects every bad variant with the expected text, passes every good one.
// `miss` lists case ids whose bad variant it passes; `falsePositive` lists case ids whose good variant it rejects.
export function stubRunner({ miss = [], falsePositive = [], cases }) {
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  return async ({ caseId, variant }) => {
    const c = byId[caseId];
    const reject = variant === 'bad' ? !miss.includes(caseId) : falsePositive.includes(caseId);
    return { report: reject ? `QA REJECTED\n1. ${c.meta.description} (${c.meta.expected.finding.split('|')[0].replace(/\\/g, '')})\n` : 'QA PASSED\n', cost: 0 };
  };
}

export function claudeRunner(spawn, { maxTurns = 12, maxBudgetUsd = 1, make = materialize, rulesFor = interfaceRules } = {}) {
  return async ({ lens, stack, lensText, files, model }) => {
    const args = ['-p', '--output-format', 'json', '--max-turns', String(maxTurns), '--max-budget-usd', String(maxBudgetUsd), '--allowedTools', 'Read,Grep,Glob,Bash(git diff:*),Bash(git status:*),Bash(git log:*),Bash(git show:*)'];
    if (model) args.push('--model', model);
    const cwd = make(files);
    const prompt = `${lensText}\n\n${orchestratorNote(files, lens === 'interface' ? rulesFor(stack, files) : '')}`;
    const r = spawn('claude', args, { input: prompt, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, cwd });
    if (r.status !== 0) throw new Error(`claude failed: ${(r.stderr || '').slice(0, 300)}`);
    const out = JSON.parse(r.stdout);
    return { report: out.result ?? '', cost: out.total_cost_usd ?? 0 };
  };
}

export function renderReport(result, opts, est, date) {
  const lines = [`# Lens evaluation ${date}`, '', `- Mode: ${opts.dryRun ? 'dry run (stub, no model)' : 'real'}`,
    `- Rule removed: ${opts.withoutRule ?? 'none'}`, `- Skill added: ${opts.withSkill ?? 'none'}`,
    `- Estimated cost: ${est.usd == null ? `${est.inTok} input tokens, ${est.outTok} output tokens (no prices given)` : `${est.usd.toFixed(2)} USD`}`, '',
    '| Lens | Defects found | Good variants flagged | Cost (USD) |', '| --- | --- | --- | --- |'];
  for (const [lens, p] of Object.entries(result.per)) lines.push(`| ${lens} | ${p.found}/${p.cases} | ${p.falsePositives}/${p.cases} | ${p.cost.toFixed(2)} |`);
  lines.push('', `Total cost: ${result.total.toFixed(2)} USD`, '', '## Cases', '');
  for (const r of result.rows) lines.push(`- ${r.id}: bad ${r.bad.matched ? 'found' : r.bad.rejected ? 'rejected for another reason' : 'missed'}; good ${r.good.rejected ? 'FLAGGED' : 'passed'}`);
  // What the lens said where the result is not the expected one, to tell a fault of the lens from a fault of the fixture.
  const cut = (t) => String(t ?? '').trim().slice(0, 1500);
  const odd = result.rows.flatMap((r) => [
    ...(r.bad.matched ? [] : [[`${r.id} (bad variant, not found)`, r.bad.report]]),
    ...(r.good.rejected ? [[`${r.id} (good variant, flagged)`, r.good.report]] : []),
  ]);
  if (odd.length) {
    lines.push('', '## What the lens said where the result was not the expected one', '');
    for (const [title, text] of odd) lines.push(`### ${title}`, '', '```', cut(text), '```', '');
  }
  return `${lines.join('\n')}\n`;
}

export { loadCases };

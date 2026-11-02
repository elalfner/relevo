// Evaluation of the QA lenses on seeded defects. Opt-in: nothing here runs in npm test with a model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCases } from './lens-cases.mjs';

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
      const r = await runner({ lens, model: lensInfo[lens].model, effort: lensInfo[lens].effort, caseId: c.id, variant, prompt: casePrompt(lensInfo[lens].text, c[variant]) });
      row[variant] = { ...judge(r.report, c.meta.expected), cost: r.cost ?? 0 };
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

export function claudeRunner(spawn, { maxTurns = 8, maxBudgetUsd = 1 } = {}) {
  return async ({ prompt, model }) => {
    const args = ['-p', '--output-format', 'json', '--max-turns', String(maxTurns), '--max-budget-usd', String(maxBudgetUsd), '--allowedTools', 'Read,Grep,Glob'];
    if (model) args.push('--model', model);
    const r = spawn('claude', args, { input: prompt, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
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
  return `${lines.join('\n')}\n`;
}

export { loadCases };

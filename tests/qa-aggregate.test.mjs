import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregate, parseReport, verdictOf } from '../scripts/lib/qa-aggregate.mjs';
import { planLenses } from '../scripts/lib/lens-plan.mjs';

const ALL = planLenses({ interfaceKind: 'web', extraRules: 2 });
const THREE = planLenses({ interfaceKind: 'none' });
const passed = (extra = '') => `QA PASSED\n\n- checked\n\n## Left for on-device review\n${extra || '- none'}\n`;
const rejected = (...findings) => ['QA REJECTED', '', ...findings].join('\n');
const run = (reports, o = {}) => aggregate({ reports, plan: o.plan ?? ALL, attempt: o.attempt ?? 1, retries: o.retries ?? 1, reasked: o.reasked });
const ok = { spec: passed(), security: passed(), code: passed(), interface: passed() };

test('the verdict is the first line, exactly', () => {
  assert.equal(verdictOf('QA PASSED\nx'), 'PASSED');
  assert.equal(verdictOf('\n\nQA REJECTED'), 'REJECTED');
  assert.equal(verdictOf('Verdict: QA PASSED'), null);
  assert.equal(verdictOf('qa passed'), null);
  assert.equal(verdictOf(null), null);
});

test('findings are numbered with a class (fixable when absent or unknown) and the device list is read', () => {
  const r = parseReport(rejected('1. A null is not checked (a.dart:3).', '   Class: input', '2. A test never fails.', '3. Odd.', '   Class: urgent', '', '## Left for on-device review', '- the animation', '- none'));
  assert.deepEqual(r.findings.map((f) => [f.number, f.class]), [[1, 'input'], [2, 'fixable'], [3, 'fixable']]);
  assert.deepEqual(r.device, ['the animation']);
});

test('Scenario: Findings from two lenses - the developer agent receives both reports together', () => {
  const r = run({ ...ok, spec: rejected('1. Scenario 2 has no code.'), security: rejected('1. Raw query.\n   Class: fixable') });
  assert.equal(r.result, 'QA REJECTED');
  assert.deepEqual(r.findings.map((f) => f.lens), ['spec', 'security']);
});

test('Scenario: One blocking lens rejects - only the code lens rejects and the result is QA REJECTED', () => {
  assert.equal(run({ ...ok, code: rejected('1. A test asserts nothing.') }).result, 'QA REJECTED');
  assert.equal(run(ok).result, 'QA PASSED');
});

test('Scenario: Interface rejects on the first attempt - it blocks while a retry remains', () => {
  const r = run({ ...ok, interface: rejected('1. The empty state has no action.') }, { attempt: 1, retries: 1 });
  assert.equal(r.result, 'QA REJECTED');
  assert.equal(r.findings[0].lens, 'interface');
  assert.deepEqual(r.advisory, []);
});

test('Scenario: Interface rejects on the last attempt - the result passes and its findings are advisory notes', () => {
  const r = run({ ...ok, interface: rejected('1. The empty state has no action.') }, { attempt: 2, retries: 1 });
  assert.equal(r.result, 'QA PASSED');
  assert.deepEqual(r.advisory, [{ lens: 'interface', kind: 'finding', text: 'The empty state has no action.' }]);
  assert.deepEqual(r.findings, []);
});

test('Scenario: No retries - with qa.retries 0 the interface lens always advises', () => {
  const r = run({ ...ok, interface: rejected('1. Something.') }, { attempt: 1, retries: 0 });
  assert.equal(r.result, 'QA PASSED');
  assert.equal(r.advisory.length, 1);
});

test('the last attempt does not soften the other lenses', () => {
  assert.equal(run({ ...ok, security: rejected('1. Injection.') }, { attempt: 2, retries: 1 }).result, 'QA REJECTED');
});

test('Scenario: Notes in the hand-off - the scenarios that only a device can show are advisory content', () => {
  const r = run({ ...ok, spec: passed('- scenario 4 opens the maps app') });
  assert.equal(r.result, 'QA PASSED');
  assert.deepEqual(r.advisory, [{ lens: 'spec', kind: 'device', text: 'scenario 4 opens the maps app' }]);
});

test('a lens that is not active is recorded as SKIPPED by the script and needs no report', () => {
  const r = run({ spec: passed(), security: passed(), code: passed() }, { plan: THREE });
  assert.equal(r.result, 'QA PASSED');
  assert.equal(r.lenses.interface.status, 'SKIPPED');
  assert.match(r.lenses.interface.reason, /no interface/);
});

test('Scenario: An invalid report - asked again once, and a second invalid report ends the run with no developer retry', () => {
  const first = run({ ...ok, code: 'Looks fine to me' });
  assert.deepEqual([first.result, first.action, first.reask], [null, 'reask', ['code']]);
  const second = run({ ...ok, code: 'Still no verdict' }, { reasked: ['code'] });
  assert.deepEqual([second.result, second.action, second.reason], [null, 'stop', 'lens report invalid']);
});

test('fails closed: a missing report is invalid, never a pass', () => {
  const r = run({ spec: passed(), security: passed(), code: null, interface: passed() });
  assert.equal(r.action, 'reask');
  assert.notEqual(r.result, 'QA PASSED');
});

test('the command uses exit codes: 0 passed, 1 rejected, 4 ask again, 5 lens report invalid, 2 bad arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-agg-'));
  const f = (name, text) => { writeFileSync(join(dir, name), text); return join(dir, name); };
  const plan = f('plan.json', JSON.stringify({ lenses: THREE }));
  const base = ['scripts/qa-aggregate.mjs', '--plan', plan, '--attempt', '1', '--retries', '1'].map((a, i) => (i === 0 ? new URL(`../${a}`, import.meta.url).pathname : a));
  const reports = (over = {}) => ['spec', 'security', 'code'].flatMap((l) => ['--report', `${l}=${f(`${l}.md`, over[l] ?? passed())}`]);
  const exit = (over, extra = []) => spawnSync('node', [...base, ...reports(over), ...extra], { encoding: 'utf8' }).status;
  assert.equal(exit({}), 0);
  assert.equal(exit({ code: rejected('1. Bad.') }), 1);
  assert.equal(exit({ code: 'nothing' }), 4);
  assert.equal(exit({ code: 'nothing' }, ['--reasked', 'code']), 5);
  assert.equal(spawnSync('node', [base[0]], { encoding: 'utf8' }).status, 2);
});

test('Scenario: Nothing the developer can fix - every blocking finding needs an input, a decision or a policy, so the retries are skipped', () => {
  const r = run({ ...ok, spec: rejected('1. The key is missing.\n   Class: input'), security: rejected('1. Edits a protected file.\n   Class: policy') });
  assert.deepEqual([r.all_non_fixable, r.first_non_fixable_class], [true, 'input']);
});

test('a mixed report is retried as before, and the class of the first finding that is not fixable is named', () => {
  const r = run({ ...ok, spec: rejected('1. A null is not checked.'), security: rejected('1. No key.\n   Class: input') });
  assert.deepEqual([r.all_non_fixable, r.first_non_fixable_class], [false, 'input']);
  const passed = run(ok);
  assert.deepEqual([passed.all_non_fixable, passed.first_non_fixable_class], [false, null]);
});

// ---------------------------------------------------------------- a violation of a hard rule blocks (#121)
import { parseRules } from '../scripts/lib/rules-file.mjs';

const RULES = parseRules('CLAUDE.md', `# Rules
Every list must offer export.
## Style [advice]
Prefer short names.
`);
const withRules = (reports, o = {}) => aggregate({ reports, plan: o.plan ?? ALL, attempt: o.attempt ?? 1, retries: o.retries ?? 1, rules: RULES });
const CITE = 'Rule: CLAUDE.md:2 "Every list must offer export"';

test('Scenario: Interface lens on the last attempt cites a hard rule - it is a finding, not an advisory note', () => {
  const iface = rejected(`1. The list has no export (a.vue:3). ${CITE}`);
  const without = run({ ...ok, interface: iface }, { attempt: 2 });
  assert.equal(without.result, 'QA PASSED', 'before: an advisory note');
  const r = withRules({ ...ok, interface: iface }, { attempt: 2 });
  assert.equal(r.result, 'QA REJECTED');
  assert.equal(r.findings[0].lens, 'interface');
  assert.deepEqual(r.findings[0].rule, { file: 'CLAUDE.md', line: 2, text: 'Every list must offer export.' });
  assert.deepEqual(r.advisory, []);
  assert.equal(r.lenses.interface.hard_rule, 1);
});

test('Scenario: A pass that carries a citation - the result is QA REJECTED with a synthesized finding', () => {
  const r = withRules({ ...ok, code: `QA PASSED\n\n- checked\n${CITE}\n` });
  assert.equal(r.result, 'QA REJECTED');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].class, 'fixable');
  assert.match(r.findings[0].text, /CLAUDE\.md:2/);
  assert.equal(r.all_non_fixable, false);
});

test('Scenario: The quote is not on that line - it is listed as unverified and changes nothing by itself', () => {
  const iface = rejected('1. Odd.', '   Rule: CLAUDE.md:2 "Never ship on Fridays"');
  const r = withRules({ ...ok, interface: iface }, { attempt: 2 });
  assert.equal(r.result, 'QA PASSED');
  assert.deepEqual(r.unverified.map((u) => [u.lens, u.number, u.cited]), [['interface', 1, 'CLAUDE.md:2']]);
  assert.equal(withRules({ ...ok, interface: rejected('1. Odd.\n   Rule: CLAUDE.md:99 "x"') }, { attempt: 2 }).unverified.length, 1);
  assert.equal(withRules({ ...ok, spec: rejected('1. Odd.\n   Rule: CLAUDE.md:99 "x"') }).result, 'QA REJECTED', 'a blocking lens keeps blocking');
});

test('Scenario: Advice - a finding that cites a rule marked [advice] is an advisory note', () => {
  const r = withRules({ ...ok, spec: rejected('1. Names are long: "Prefer short names" was not followed. Rule: CLAUDE.md:4 "Prefer short names"') });
  assert.equal(r.result, 'QA PASSED');
  assert.equal(r.advisory.length, 1);
  assert.deepEqual(r.findings, []);
});

test('without rules a citation changes nothing, and a rejection with no finding still blocks', () => {
  assert.equal(run({ ...ok, interface: rejected(`1. x ${CITE}`) }, { attempt: 2 }).result, 'QA PASSED');
  assert.equal(withRules({ ...ok, code: 'QA REJECTED\n\nbecause' }).result, 'QA REJECTED');
});

test('the citation is read in the line of the finding, on its own line, with backticks and curly quotes', () => {
  const r = parseReport(rejected('1. A (a:1). Rule: `CLAUDE.md:2` “Every list must offer export”', '2. B', '   Rule: CLAUDE.md:2 "x"'));
  assert.deepEqual(r.findings.map((f) => f.cites.length), [1, 1]);
});

test('CLI: --rules-file reads the files from --repo-root and prints unverified', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-agg-'));
  writeFileSync(join(dir, 'CLAUDE.md'), '# Rules\nEvery list must offer export.\n');
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(THREE));
  ['spec', 'security', 'code'].forEach((l) => writeFileSync(join(dir, `${l}.md`), l === 'code' ? `QA PASSED\n${CITE}\n` : passed()));
  const reports = ['spec', 'security', 'code'].flatMap((l) => ['--report', `${l}=${join(dir, `${l}.md`)}`]);
  const cli = new URL('../scripts/qa-aggregate.mjs', import.meta.url).pathname;
  const base = ['--plan', join(dir, 'plan.json'), '--attempt', '1', '--retries', '1', ...reports];
  assert.equal(spawnSync('node', [cli, ...base], { encoding: 'utf8' }).status, 0);
  const r = spawnSync('node', [cli, ...base, '--rules-file', 'CLAUDE.md,missing.md', '--repo-root', dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.stdout).rules_unread, ['missing.md']);
});

// #161: advice downgrades a finding of an always-blocking lens (spec, security) only when the finding names the rule.
const ADVICE_RULES = parseRules('CLAUDE.md', `# Rules
Every list must offer export.
Prefer small functions [advice]
`);
const ADVICE_CITE = 'Rule: CLAUDE.md:3 "prefer small functions"';
const withAdvice = (reports, o = {}) => aggregate({ reports, plan: o.plan ?? ALL, attempt: o.attempt ?? 1, retries: o.retries ?? 1, rules: ADVICE_RULES });

test('Scenario: A real problem that cites advice on the side - the security lens still blocks', () => {
  const r = withAdvice({ ...ok, security: rejected(`1. The query is built from user input, so it can be injected (db.js:9). ${ADVICE_CITE}`) });
  assert.equal(r.result, 'QA REJECTED');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].lens, 'security');
  assert.deepEqual(r.advisory, []);
});

test('the same on the spec lens, with the citation on its own line', () => {
  const r = withAdvice({ ...ok, spec: rejected('1. The scenario for an empty list is not implemented (list.js:4).', `   ${ADVICE_CITE}`) });
  assert.equal(r.result, 'QA REJECTED');
  assert.equal(r.findings[0].lens, 'spec');
  assert.deepEqual(r.advisory, []);
});

test('Scenario: An always-blocking lens reports only that advice was not followed - it is advisory', () => {
  const r = withAdvice({ ...ok, spec: rejected(`1. The function in list.js:4 is long, so "Prefer small functions" was not followed. ${ADVICE_CITE}`) });
  assert.equal(r.result, 'QA PASSED');
  assert.equal(r.advisory.length, 1);
  assert.deepEqual(r.findings, []);
});

test('a finding that cites two advice lines must name both, or it blocks', () => {
  const rules = parseRules('CLAUDE.md', 'Prefer small functions [advice]\nPrefer short names [advice]\n');
  const agg = (text) => aggregate({ reports: { ...ok, security: rejected(text) }, plan: ALL, attempt: 1, retries: 1, rules });
  const both = 'Rule: CLAUDE.md:1 "prefer small functions"\n   Rule: CLAUDE.md:2 "prefer short names"';
  assert.equal(agg(`1. Both "prefer small functions" and "prefer short names" were ignored.\n   ${both}`).result, 'QA PASSED');
  assert.equal(agg(`1. "prefer small functions" was ignored.\n   ${both}`).result, 'QA REJECTED');
});

test('Scenario: Advice and a hard rule, or advice and an unverified line', () => {
  const hard = withAdvice({ ...ok, security: rejected(`1. A long function. ${ADVICE_CITE}`, '   Rule: CLAUDE.md:2 "Every list must offer export"') });
  assert.equal(hard.result, 'QA REJECTED');
  assert.equal(hard.findings[0].rule.line, 2, 'the hard rule decides');
  const unverified = withAdvice({ ...ok, security: rejected(`1. "prefer small functions" was ignored. ${ADVICE_CITE}`, '   Rule: CLAUDE.md:99 "nothing"') });
  assert.equal(unverified.result, 'QA REJECTED');
  assert.equal(unverified.unverified.length, 1);
});

test('the interface lens, which blocks only while a retry remains, keeps treating an advice citation as a note', () => {
  const iface = rejected(`1. Too long. ${ADVICE_CITE}`);
  assert.equal(withAdvice({ ...ok, interface: iface }, { attempt: 1, retries: 1 }).result, 'QA PASSED', 'blocks by retry, advice stays a note');
  assert.equal(withAdvice({ ...ok, interface: iface }, { attempt: 2, retries: 1 }).result, 'QA PASSED');
});

test('the code lens always blocks: a real problem with advice on the side blocks, a finding that names the advice is a note', () => {
  const real = withAdvice({ ...ok, code: rejected(`1. The loop never ends when the list is empty (list.js:8). ${ADVICE_CITE}`) });
  assert.equal(real.result, 'QA REJECTED');
  const note = withAdvice({ ...ok, code: rejected(`1. "Prefer small functions" was not followed in list.js. ${ADVICE_CITE}`) });
  assert.equal(note.result, 'QA PASSED');
});

// #150: two lenses that ask for opposite fixes stop the retries (the check needs the reports of the previous attempt).
const SPEC_ASKS = rejected('1. The tests repeat the dialog question as a literal: read it from `DIALOG_QUESTION`, decision D2 of the issue (dialog.test.js:12).');
const CODE_REJECTS = rejected('1. The assertions on `DIALOG_QUESTION` can no longer fail if the wording changes; assert the text itself (dialog.test.js:12).');
const again = (reports, previous, o = {}) => aggregate({ reports, previous, plan: o.plan ?? ALL, attempt: o.attempt ?? 2, retries: o.retries ?? 2, rules: o.rules ?? [] });

test('Scenario: One lens rejects what another asked for - the issue #150 case is a contradiction naming both lenses and both findings', () => {
  const r = again({ ...ok, code: CODE_REJECTS }, { ...ok, spec: SPEC_ASKS });
  assert.equal(r.result, 'QA REJECTED', 'it never becomes a pass');
  assert.ok(r.contradiction, 'the contradiction is reported');
  const [pair] = r.contradiction.pairs;
  assert.deepEqual([pair.first.lens, pair.then.lens], ['spec', 'code']);
  assert.match(pair.first.text, /read it from `DIALOG_QUESTION`/);
  assert.match(pair.then.text, /can no longer fail/);
  assert.equal(pair.quoted, 'DIALOG_QUESTION');
});

test('Scenario: The findings do not contradict each other - the retry runs as today', () => {
  // no quoted words in common
  assert.equal(again({ ...ok, code: rejected('1. `parseDate` swallows the error.') }, { ...ok, spec: SPEC_ASKS }).contradiction, null);
  // a second, unrelated blocking finding exists: it is still fixable, so the retry runs
  assert.equal(again({ ...ok, code: [CODE_REJECTS, '2. `parseDate` swallows the error.'].join('\n') }, { ...ok, spec: SPEC_ASKS }).contradiction, null);
  // nothing before
  assert.equal(again({ ...ok, code: CODE_REJECTS }, {}).contradiction, null);
  assert.equal(run({ ...ok, code: CODE_REJECTS }).contradiction, null, 'attempt 1 has no previous reports');
});

test('Scenario: The same lens repeats a finding - it is not a contradiction', () => {
  assert.equal(again({ ...ok, spec: SPEC_ASKS }, { ...ok, spec: SPEC_ASKS }).contradiction, null, 'the same lens, the same finding');
  // the other lens had said it before: B repeats itself
  assert.equal(again({ ...ok, code: CODE_REJECTS, spec: SPEC_ASKS }, { ...ok, code: CODE_REJECTS, spec: SPEC_ASKS }).contradiction, null);
  // A did not address it: it still asks for it
  assert.equal(again({ ...ok, spec: SPEC_ASKS, code: CODE_REJECTS }, { ...ok, spec: SPEC_ASKS }).contradiction, null);
  // B had already said it on the previous attempt, A asked later
  assert.equal(again({ ...ok, code: CODE_REJECTS }, { ...ok, spec: SPEC_ASKS, code: CODE_REJECTS }).contradiction, null);
});

test('Scenario: A security finding is among the blocking findings - no contradiction, the retry runs', () => {
  const sec = rejected('1. The `DIALOG_QUESTION` constant is built from user input (dialog.js:4).');
  assert.equal(again({ ...ok, security: sec }, { ...ok, spec: SPEC_ASKS }).contradiction, null, 'security is never a side');
  assert.equal(again({ ...ok, code: CODE_REJECTS, security: sec }, { ...ok, spec: SPEC_ASKS }).contradiction, null);
  assert.equal(again({ ...ok, code: CODE_REJECTS }, { ...ok, security: rejected('1. Do not log `DIALOG_QUESTION`.') }).contradiction, null, 'a security finding of the past is never reversed away either');
  const rules = parseRules('CLAUDE.md', 'Every list must offer export.\n');
  const hard = rejected('1. `DIALOG_QUESTION` hides the export.', '   Rule: CLAUDE.md:1 "Every list must offer export"');
  const r = again({ ...ok, code: hard }, { ...ok, spec: SPEC_ASKS }, { rules });
  assert.equal(r.contradiction, null, 'a hard rule is not a side');
  assert.equal(r.result, 'QA REJECTED');
});

test('only quoted words count, and a path or a Rule citation is not one', () => {
  const before = { ...ok, spec: rejected('1. Edit `src/dialog.js` to export it.') };
  assert.equal(again({ ...ok, code: rejected('1. `src/dialog.js` has a dead branch.') }, before).contradiction, null);
  const curly = again({ ...ok, code: rejected('1. The “dialog question” assertions cannot fail.') }, { ...ok, spec: rejected('1. Read the "Dialog Question" from a constant.') });
  assert.ok(curly.contradiction, 'curly and straight quotes, case and spaces are squashed');
  assert.equal(again({ ...ok, code: rejected('1. The `ab` is short.') }, { ...ok, spec: rejected('1. Use `ab`.') }).contradiction, null, 'under 3 characters');
});

test('the previous reports missing, invalid or with no findings change nothing, and an interface lens that advises is no side', () => {
  const code = { ...ok, code: CODE_REJECTS };
  assert.equal(again(code, { spec: null }).contradiction, null);
  assert.equal(again(code, { ...ok, spec: 'garbage' }).contradiction, null);
  assert.equal(again(code, { ...ok, spec: passed() }).contradiction, null);
  assert.equal(again(code, undefined).contradiction, null);
  const adv = again({ ...ok, interface: CODE_REJECTS }, { ...ok, spec: SPEC_ASKS }, { attempt: 3, retries: 2 });
  assert.equal(adv.result, 'QA PASSED');
  assert.equal(adv.contradiction, null, 'no blocking finding, nothing to stop');
});

test('CLI: --previous reads the reports of the previous attempt and prints the contradiction, with exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-agg-'));
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(THREE));
  writeFileSync(join(dir, 'spec1.md'), SPEC_ASKS);
  const files = { spec: passed(), security: passed(), code: CODE_REJECTS };
  Object.entries(files).forEach(([l, t]) => writeFileSync(join(dir, `${l}.md`), t));
  ['security', 'code'].forEach((l) => writeFileSync(join(dir, `${l}1.md`), passed()));
  const cli = new URL('../scripts/qa-aggregate.mjs', import.meta.url).pathname;
  const reports = Object.keys(files).flatMap((l) => ['--report', `${l}=${join(dir, `${l}.md`)}`]);
  const base = ['--plan', join(dir, 'plan.json'), '--attempt', '2', '--retries', '2', ...reports];
  const prev = ['spec', 'security', 'code'].flatMap((l) => ['--previous', `${l}=${join(dir, `${l}1.md`)}`]);
  const r = spawnSync('node', [cli, ...base, ...prev], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).contradiction.pairs[0].then.lens, 'code');
  const none = spawnSync('node', [cli, ...base, '--previous', `spec=${join(dir, 'missing.md')}`], { encoding: 'utf8' });
  assert.equal(none.status, 1);
  assert.equal(JSON.parse(none.stdout).contradiction, null);
});

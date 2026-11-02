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

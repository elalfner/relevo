import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FINDING_CLASSES, parseFindings, summarize, verdictOf } from '../scripts/lib/qa-findings.mjs';

const CLI = new URL('../scripts/qa-findings.mjs', import.meta.url).pathname;

const report = (...findings) => ['QA REJECTED', '', ...findings].join('\n');

test('the verdict is the first line, exactly', () => {
  assert.equal(verdictOf('QA PASSED\n- tests ran'), 'PASSED');
  assert.equal(verdictOf('\nQA REJECTED\n1. x'), 'REJECTED');
  assert.equal(verdictOf('Here is my verdict: QA PASSED'), null);
  assert.equal(verdictOf(''), null);
});

test('Scenario: A finding of a missing input - the class is read', () => {
  const found = parseFindings(report('1. The key is the test key of the vendor (src/config.ts:28).', '   Class: input'));
  assert.deepEqual(found.map((f) => [f.number, f.class, f.valid]), [[1, 'input', true]]);
});

test('Scenario: A report without classes - every finding counts as fixable and the retries run as before', () => {
  const summary = summarize(report('1. A missing check on a null value.', '2. A test that never fails.'));
  assert.equal(summary.total, 2);
  assert.equal(summary.fixable, 2);
  assert.equal(summary.all_non_fixable, false);
  assert.equal(summary.first_non_fixable_class, null);
  assert.ok(summary.findings.every((f) => f.class === 'fixable' && f.valid === false));
});

test('an unknown class counts as fixable and is marked as not valid', () => {
  const [finding] = parseFindings(report('1. Something.', '   Class: urgent'));
  assert.equal(finding.class, 'fixable');
  assert.equal(finding.valid, false);
});

test('Scenario: Nothing the developer can fix - every finding non-fixable', () => {
  const summary = summarize(report('1. No key.\n   Class: input', '2. The spec does not say.\n   Class: spec', '3. Edits a protected file.\n   Class: policy'));
  assert.equal(summary.all_non_fixable, true);
  assert.equal(summary.first_non_fixable_class, 'input');
  assert.equal(summary.non_fixable, 3);
});

test('Scenario: A mixed report - not all non-fixable, and the first non-fixable class is named', () => {
  const summary = summarize(report('1. A bug.\n   Class: fixable', '2. No key.\n   Class: input'));
  assert.equal(summary.all_non_fixable, false);
  assert.equal(summary.fixable, 1);
  assert.equal(summary.first_non_fixable_class, 'input');
});

test('the class is understood in the forms an agent writes it', () => {
  const classes = ['**Class:** policy', 'Class: `spec`', 'class = input', 'Class: FIXABLE'].map((line) => parseFindings(report(`1. Text.\n   ${line}`))[0].class);
  assert.deepEqual(classes, ['policy', 'spec', 'input', 'fixable']);
});

test('a passed report has no findings, and the on-device list is not a list of findings', () => {
  assert.deepEqual(parseFindings('QA PASSED\n\n1. Scenario seen on a device'), []);
  const rejected = report('1. A bug.\n   Class: fixable', '', '## Left for on-device review', '1. Scenario one', '2. Scenario two');
  assert.equal(parseFindings(rejected).length, 1);
});

test('a rejection with no numbered finding cannot be decided, so the retries still run', () => {
  const summary = summarize('QA REJECTED\nThe code is wrong.');
  assert.equal(summary.total, 0);
  assert.equal(summary.all_non_fixable, false);
});

test('the classes are the four of the specification', () => {
  assert.deepEqual(FINDING_CLASSES, ['fixable', 'input', 'spec', 'policy']);
});

test('the script reads a file or stdin and prints JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-qf-'));
  const file = join(dir, 'report.md');
  writeFileSync(file, report('1. No key.\n   Class: input'));
  const fromFile = spawnSync('node', [CLI, '--file', file], { encoding: 'utf8' });
  assert.equal(fromFile.status, 0);
  assert.equal(JSON.parse(fromFile.stdout).all_non_fixable, true);
  const fromStdin = spawnSync('node', [CLI], { input: report('1. A bug.'), encoding: 'utf8' });
  assert.equal(JSON.parse(fromStdin.stdout).all_non_fixable, false);
  assert.equal(spawnSync('node', [CLI, '--file'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync('node', [CLI, '--file', join(dir, 'missing.md')], { encoding: 'utf8' }).status, 2);
});

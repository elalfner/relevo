import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/review-state.mjs', import.meta.url).pathname;
const APP = 'com.example.counter';
const SPEC = `## ADDED Requirements
### Requirement: A
#### Scenario: One
- **WHEN** a
- **THEN** b
`;
const START = `10-14 12:00:01.000  500  600 I ActivityManager: Start proc 4242:${APP}/u0a99 for next-top-activity`;
const line = (msg) => `10-14 12:00:02.000  4242  4242 E flutter : ${msg}`;
const LOG = [START, line('Unhandled Exception: Bad state'), line('A RenderFlex overflowed by 12 pixels')].join('\n');

function review() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-wv-'));
  const state = join(dir, 'evidence', 'review-state.json');
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  const run = (input, ...args) => spawnSync('node', [CLI, ...args, '--state', state], { input, encoding: 'utf8' });
  run('', 'init', join(dir, 'change'));
  run('', 'set', '1', 'ok');
  run('', 'agree');
  return { dir, state, run, show: () => JSON.parse(readFileSync(state, 'utf8')) };
}

test('the audit numbers the findings, and an unwaived finding blocks', () => {
  const { run } = review();
  const out = run(LOG, 'audit', '--package', APP).stdout;
  assert.match(out, /REVIEW REJECTED/);
  assert.match(out, /1\. exception: /);
  assert.match(out, /2\. layout: /);
  assert.equal(run('', 'decide').status, 1);
});

test('Scenario: Waiver with a reason - the finding is waived and the reason is kept', () => {
  const { run, show } = review();
  run(LOG, 'audit', '--package', APP);
  const r = run('', 'waive', '2', 'known', 'overflow', 'of', 'the', 'debug', 'banner');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /finding 2 waived; the verdict is REVIEW REJECTED/);
  assert.deepEqual(show().waivers.map((w) => [w.class, w.reason]), [['layout', 'known overflow of the debug banner']]);
});

test('Scenario: Waiver without a reason - refused, and the finding still blocks', () => {
  const { run, show } = review();
  run(LOG, 'audit', '--package', APP);
  const r = run('', 'waive', '2');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /needs a written reason/);
  assert.deepEqual(show().waivers, []);
  assert.equal(run('', 'waive', '2', '   ').status, 2);
});

test('Scenario: A finding left - one waived and one not is still rejected', () => {
  const { run } = review();
  run(LOG, 'audit', '--package', APP);
  run('', 'waive', '2', 'known banner');
  assert.equal(run('', 'decide').status, 1);
  assert.match(run('', 'show').stdout, /"verdict": "REVIEW REJECTED"/);
});

test('Scenario: Every finding waived - the verdict is passed with waivers and the pull request may open', () => {
  const { run, dir } = review();
  run(LOG, 'audit', '--package', APP);
  run('', 'waive', '1', 'known bad state in the sample data');
  run('', 'waive', '2', 'known banner');
  assert.match(run('', 'show').stdout, /"verdict": "REVIEW PASSED \(with waivers\)"/);
  const d = run('', 'decide');
  assert.equal(d.status, 0, d.stdout);
  const section = run('', 'waived').stdout;
  assert.match(section, /^## Waived findings/);
  assert.match(section, /exception.*waived by the reviewer: known bad state in the sample data/);
  assert.match(section, /layout.*known banner/);
  const report = readFileSync(join(dir, 'evidence', 'review-report.md'), 'utf8');
  assert.match(report, /WAIVED by the reviewer: known banner/);
  assert.match(report, /only the processes of `com\.example\.counter`/, 'the scope survives a waiver');
});

test('Scenario: New audit after a micro-fix - a waived finding with the same class and text stays waived, a new one does not', () => {
  const { run, show } = review();
  run(LOG, 'audit', '--package', APP);
  run('', 'waive', '2', 'known banner');
  const again = [START, line('A RenderFlex overflowed by 12 pixels'), line('setState() called after dispose()')].join('\n');
  const out = run(again, 'audit', '--package', APP).stdout;
  assert.match(out, /REVIEW REJECTED/);
  assert.match(out, /layout: .*\(waived: known banner\)/);
  assert.equal(show().audit.findings.find((f) => f.class === 'lifecycle').waived, undefined);
  const clean = run([START, line('A RenderFlex overflowed by 12 pixels')].join('\n'), 'audit', '--package', APP).stdout;
  assert.match(clean, /REVIEW PASSED \(with waivers\)/);
});

test('Scenario: Not waivable - an inconclusive audit and a missing audit refuse a waiver', () => {
  const { run } = review();
  assert.match(run('', 'waive', '1', 'because').stderr, /audit has not run/);
  run('', 'audit', '--package', APP);
  const r = run('', 'waive', '1', 'because');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /inconclusive audit cannot be waived/);
  assert.equal(run('', 'decide').status, 1);
});

test('a number that is not a finding is refused', () => {
  const { run } = review();
  run(LOG, 'audit', '--package', APP);
  const r = run('', 'waive', '9', 'whatever');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /there is no finding 9 in the audit \(it has 2\)/);
});

test('Scenario: Specification changed - sync clears the waivers', () => {
  const { run, dir, show } = review();
  run(LOG, 'audit', '--package', APP);
  run('', 'waive', '2', 'known banner');
  assert.equal(show().waivers.length, 1);
  assert.equal(run('', 'sync', join(dir, 'change')).status, 0);
  assert.deepEqual(show().waivers, []);
  assert.equal(show().audit, null);
});

test('a state saved before waivers existed still works', () => {
  const { run, state } = review();
  const s = JSON.parse(readFileSync(state, 'utf8'));
  delete s.waivers;
  writeFileSync(state, JSON.stringify(s));
  run(LOG, 'audit', '--package', APP);
  assert.equal(run('', 'waive', '1', 'ok').status, 0);
  assert.equal(run('', 'waived').status, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Acceptance tests (task 7.1): each one runs the real scripts, as a skill would, and checks the outcome the
// scenarios of the specifications name. They do not call GitHub or a device. The parts that only the language
// model performs (for example "retry the build") are pinned by the text of the skill that says so.
const root = new URL('../', import.meta.url).pathname;
const CLI = (name) => `${root}scripts/${name}`;
const node = (script, args, input) => spawnSync('node', [CLI(script), ...args], { encoding: 'utf8', input });
const skill = (name) => readFileSync(`${root}skills/${name}/SKILL.md`, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'acceptance-'));
const write = (name, data) => {
  const path = join(dir, name);
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data));
  return path;
};
const config = (review) => write(`relevo-${review}.yml`, `limits:\n  run_max_cost: 5\nreview:\n  mode: ${review}\n  merger: approver\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n`);

// ---------- go: QA still rejects after the retries

test('Scenario: QA still rejects - the issue leaves building for qa-failed in one operation, never reaching built', () => {
  const change = JSON.parse(node('label-change.mjs', ['--to', 'qa-failed', '--current', 'relevo:building,bug']).stdout);
  assert.deepEqual(change, { add: ['relevo:qa-failed'], remove: ['relevo:building'] });
  assert.ok(!change.add.includes('relevo:built') && !change.add.includes('relevo:pr-open'), 'the state does not advance');
});

test('Scenario: QA still rejects - the assignee is mentioned with the finding and the next command, and says whether the branch was pushed', () => {
  const data = { assignee: 'persona-b', issue: 31, title: 'Summary screen', finding: 'lib/summary.dart:42 the list overflows', branch: 'feature/31-summary', reason: 'QA rejected after the retries', log_url: 'https://example.test/run/1' };
  const pushed = node('render-message.mjs', ['qa_failed', '--language', 'en'], JSON.stringify({ ...data, pushed: true })).stdout;
  assert.match(pushed, /^@persona-b /);
  assert.match(pushed, /lib\/summary\.dart:42/);
  assert.match(pushed, /\/relevo:fix 31/);
  assert.match(pushed, /feature\/31-summary/);
  const notPushed = node('render-message.mjs', ['qa_failed', '--language', 'en'], JSON.stringify({ ...data, pushed: false })).stdout;
  assert.match(notPushed, /not pushed/i);
});

test('Scenario: QA still rejects - go retries exactly qa_retries times, then takes the failure path that pushes and opens no pull request', () => {
  const go = skill('go');
  assert.match(go, /you may retry up to `qa_retries` times/);
  assert.match(go, /If QA still rejects after the retries, take the failure path with the reason `QA rejected after the retries`/);
  assert.match(go, /Push the branch with `git push -u origin <branch>`; never force-push\. \*\*Do not push anything\*\* when the reason is a possible credential or temporary marker, a protected path in the diff/);
  assert.match(go, /Stop\. Do not open a pull request and do not advance the state\./);
  assert.match(go, /You never approve, merge or open a pull request/);
  assert.ok(!/gh pr create/.test(go), 'go never opens a pull request');
});

test('Scenario: Credential found before pushing - the scanner stops the commit and the skill does not push', () => {
  const diff = '+++ b/lib/config.dart\n@@ -0,0 +1 @@\n+const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";\n';
  const scan = node('scan-diff.mjs', [], diff);
  assert.equal(scan.status, 1);
  assert.match(scan.stderr + scan.stdout, /credential/i);
  assert.match(skill('go'), /Do not push anything/);
});

// ---------- review: no "done", no audit

const SPEC = '### Requirement: Counter\n\n#### Scenario: Increment\n- **WHEN** the user taps add\n- **THEN** the counter grows\n\n#### Scenario: Reset\n- **WHEN** the user taps reset\n- **THEN** the counter is zero\n';
function review() {
  const change = join(dir, `change-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(change, 'specs', 'cap'), { recursive: true });
  writeFileSync(join(change, 'specs', 'cap', 'spec.md'), SPEC);
  const state = join(dir, `state-${Math.random().toString(36).slice(2)}`, 'review-state.json');
  const run = (input, ...args) => spawnSync('node', [CLI('review-state.mjs'), ...args, '--state', state], { encoding: 'utf8', input });
  run('', 'init', change);
  return run;
}

test('Scenario: Premature audit - without the person saying done there is no audit, so the pull request cannot open', () => {
  const run = review();
  run('', 'set', '1', 'ok');
  run('', 'set', '2', 'ok');
  run('', 'agree');
  const decision = run('', 'decide');
  assert.equal(decision.status, 1, 'confirmed lines and an agreement are not enough without the audit');
  assert.match(decision.stdout + decision.stderr, /audit has not run/);
  const text = skill('review');
  assert.ok(text.indexOf('Never go to step 5 without an explicit `done`') > text.indexOf('### 4.'), 'the rule sits before the audit step');
  assert.ok(text.indexOf('Never go to step 5 without an explicit `done`') < text.indexOf('### 5. Audit the log'));
  assert.match(text, /Make no further tool calls until the person writes\. Do not advance on your own and do not run the log audit early\./);
});

test('Scenario: Verified - with the audit passed, every line confirmed and the agreement, the pull request may open', () => {
  const run = review();
  run('', 'set', '1', 'ok');
  run('', 'set', '2', 'ok');
  assert.match(run('I/flutter: all fine\n', 'audit').stdout, /REVIEW PASSED/);
  assert.equal(run('', 'decide').status, 1, 'the person has not agreed yet');
  run('', 'agree');
  assert.equal(run('', 'decide').status, 0);
});

test('Scenario: Path in the name - the capture is rejected with the allowed characters and nothing is written', () => {
  const out = join(dir, 'evidence-out');
  const r = spawnSync('node', [CLI('capture.mjs'), '../../x', '--dir', out], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /letters, digits/);
  assert.ok(!existsSync(out) && !existsSync(join(dir, 'x.png')), 'nothing was written');
});

// ---------- ship: no approval, no merge; the author cannot ship

const checks = [{ __typename: 'CheckRun', name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const pr = (over = {}) => ({
  number: 40, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', title: 'Summary screen', author: { login: 'persona-b' },
  reviews: [], statusCheckRollup: checks, headRefName: 'feature/31-summary', baseRefName: 'dev', ...over,
});
const ship = (mode, pull, invoker) => {
  const r = node('ship-check.mjs', ['--config', config(mode), '--input', write(`pr-${Math.random().toString(36).slice(2)}.json`, pull), '--invoker', invoker]);
  return { status: r.status, decision: JSON.parse(r.stdout) };
};
const approved = [{ author: { login: 'persona-c' }, state: 'APPROVED', submittedAt: '2026-10-15T10:00:00Z' }];

test('Scenario: No approval - ship stops and says it is waiting for someone other than the author', () => {
  const r = ship('peer', pr(), 'persona-c');
  assert.equal(r.status, 1);
  assert.equal(r.decision.allowed, false);
  assert.match(r.decision.reasons.join(' '), /approv/i);
});

test('Scenario: The author approves their own pull request - it does not count', () => {
  const own = [{ author: { login: 'persona-b' }, state: 'APPROVED', submittedAt: '2026-10-15T10:00:00Z' }];
  const r = ship('peer', pr({ reviews: own }), 'persona-b');
  assert.equal(r.status, 1);
  assert.equal(r.decision.allowed, false);
});

test('Scenario: Approver merges, author tries to ship - refused, naming who should run it', () => {
  const r = ship('peer', pr({ reviews: approved }), 'persona-b');
  assert.equal(r.status, 1);
  assert.equal(r.decision.allowed, false);
  assert.match(r.decision.reasons.join(' '), /persona-c|approver|someone other/i);
});

test('Scenario: Explicit confirmation - the approver may ship an approved, passing pull request', () => {
  const r = ship('peer', pr({ reviews: approved }), 'persona-c');
  assert.equal(r.status, 0);
  assert.equal(r.decision.allowed, true);
  assert.match(skill('ship'), /written confirmation|explicit confirmation|written yes/i);
});

test('Scenario: Failing checks - ship stops even with an approval', () => {
  const failing = [{ __typename: 'CheckRun', name: 'ci', status: 'COMPLETED', conclusion: 'FAILURE' }];
  const r = ship('peer', pr({ reviews: approved, statusCheckRollup: failing }), 'persona-c');
  assert.equal(r.status, 1);
  assert.equal(r.decision.allowed, false);
});

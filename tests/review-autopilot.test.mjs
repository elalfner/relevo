import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = (n) => new URL(`../scripts/${n}`, import.meta.url).pathname;
const SPEC = `## ADDED Requirements
### Requirement: A
#### Scenario: One
- **WHEN** a
- **THEN** b

#### Scenario: Two
- **WHEN** c
- **THEN** d

#### Scenario: Three
- **WHEN** e
- **THEN** f
`;
const PASSED_LOG = '10-14 12:00:01.000  500  600 I ActivityManager: Start proc 4242:com.example.app/u0a99 for activity\n10-14 12:00:02.000  4242  4242 I flutter : fine\n';

function review(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-ap-'));
  const state = join(dir, 'evidence', 'review-state.json');
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  const run = (input, ...args) => spawnSync('node', [bin('review-state.mjs'), ...args, '--state', state], { input, encoding: 'utf8' });
  const init = run('', 'init', join(dir, 'change'), ...(mode ? ['--autopilot', mode] : []));
  return { dir, state, run, init, show: () => JSON.parse(readFileSync(state, 'utf8')) };
}

test('init records the mode, and a state saved before the change behaves as off', () => {
  assert.match(review('verify').init.stdout, /3 checklist item\(s\).*\(autopilot: verify\)/);
  assert.equal(review().show().autopilot, 'off');
  assert.equal(review('always').init.status, 2);
  const { run, state } = review('precheck');
  const old = JSON.parse(readFileSync(state, 'utf8'));
  delete old.autopilot;
  delete old.envConfirmed;
  old.items.forEach((i) => { delete i.precheck; delete i.auto; });
  writeFileSync(state, JSON.stringify(old));
  assert.match(run('', 'precheck', '1', 'ok').stderr, /review\.autopilot is "off"/);
  assert.equal(run('', 'set', '1', 'ok').status, 0, 'the person can still confirm a line');
});

test('Scenario: Autopilot off - the agent cannot record anything', () => {
  const { run } = review('off');
  assert.match(run('', 'precheck', '1', 'ok').stderr, /does not drive the review/);
  assert.match(run('', 'auto', '1', 'an assertion').stderr, /does not drive the review/);
});

test('nothing is recorded before the person confirms the environment is not production', () => {
  const { run, show } = review('verify');
  assert.match(run('', 'precheck', '1', 'ok').stderr, /non-production data/);
  assert.match(run('', 'auto', '1', 'assertion').stderr, /non-production data/);
  assert.equal(run('', 'confirm-env').status, 0);
  assert.equal(show().envConfirmed, true);
  assert.equal(run('', 'precheck', '1', 'ok').status, 0);
});

test('Scenario: Precheck - the line is recorded as pre-checked and stays pending until the person confirms it', () => {
  const { run, show } = review('precheck');
  run('', 'confirm-env');
  assert.equal(run('', 'precheck', '2', 'ok', 'the', 'total', 'was', 'shown').status, 0);
  const item = show().items[1];
  assert.deepEqual([item.status, item.precheck, item.note], ['pending', 'ok', 'the total was shown']);
  run('', 'precheck', '3', 'fail');
  assert.equal(show().items[2].precheck, 'fail');
  assert.equal(run('', 'precheck', '9', 'ok').status, 2);
  assert.equal(run('', 'precheck', '1', 'maybe').status, 2);
});

test('Scenario: Auto in a mode that does not allow it - refused in precheck, and the line stays as it was', () => {
  const { run, show } = review('precheck');
  run('', 'confirm-env');
  const r = run('', 'auto', '1', 'an assertion');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /only when review\.autopilot is "verify" \(it is "precheck"\)/);
  assert.equal(show().items[0].status, 'pending');
});

test('Scenario: Verify - an automatic line becomes ok, needs a reason, and is listed for the pull request', () => {
  const { run, show } = review('verify');
  run('', 'confirm-env');
  assert.match(run('', 'auto', '3', '   ').stderr, /say how the line was verified/);
  assert.equal(run('', 'auto', '3', 'the', 'text', 'Total', 'was', 'asserted').status, 0);
  assert.deepEqual([show().items[2].status, show().items[2].auto], ['ok', 'the text Total was asserted']);
  const section = run('', 'auto-list').stdout;
  assert.match(section, /^## Verified automatically\n\n- 3\. Three: the text Total was asserted/);
  assert.equal(review('verify').run('', 'auto-list').stdout, '');
});

test('the person still decides: an automatic line does not open the pull request without the audit and the agreement', () => {
  const { run } = review('verify');
  run('', 'confirm-env');
  [1, 2, 3].forEach((n) => run('', 'auto', String(n), 'asserted'));
  const d = run('', 'decide');
  assert.equal(d.status, 1);
  assert.match(d.stdout, /audit has not run/);
  assert.match(d.stdout, /has not agreed/);
  run(PASSED_LOG, 'audit', '--package', 'com.example.app');
  run('', 'agree');
  assert.equal(run('', 'decide').status, 0);
});

test('a failure or a retest by the person clears the marks, and their ok replaces the automatic one', () => {
  const { run, show } = review('verify');
  run('', 'confirm-env');
  run('', 'auto', '1', 'asserted');
  run('', 'set', '1', 'fail', 'the text is wrong');
  assert.deepEqual([show().items[0].status, show().items[0].auto, show().items[0].precheck], ['fail', null, null]);
  run('', 'auto', '2', 'asserted');
  run('', 'set', '2', 'ok');
  assert.equal(show().items[1].auto, null);
  assert.equal(run('', 'auto-list').stdout, '');
});

test('after a fix the lines the agent verified are tested again, and the ones the person confirmed stay', () => {
  const { run, dir, show } = review('verify');
  run('', 'confirm-env');
  run('', 'auto', '1', 'asserted');
  run('', 'set', '2', 'ok');
  assert.equal(run('', 'sync', join(dir, 'change')).status, 0);
  assert.deepEqual(show().items.map((i) => [i.status, i.auto]), [['pending', null], ['ok', null], ['pending', null]]);
});

test('the checklist marks automatic lines', () => {
  const { run, dir, state } = review('verify');
  run('', 'confirm-env');
  run('', 'auto', '2', 'the title was asserted');
  const out = spawnSync('node', [bin('checklist.mjs'), join(dir, 'change'), '--state', state], { encoding: 'utf8' }).stdout;
  assert.match(out, /- \[x\] 2\. \*\*Two\*\*.*_\(verified automatically: the title was asserted\)_/);
  assert.match(out, /- \[ \] 1\. \*\*One\*\*: when a, then b$/m);
});

test('assertDriving: with open, an agreed review is closed; without it, precheck and auto behave as before', async () => {
  const { assertDriving } = await import('../scripts/lib/review-state.mjs');
  const state = { autopilot: 'precheck', envConfirmed: true, agreed: true };
  assert.equal(assertDriving(state), 'precheck');
  assert.throws(() => assertDriving(state, { open: true }), /the review is closed/);
  assert.throws(() => assertDriving({ ...state, autopilot: 'off' }, { open: true }), /review\.autopilot is "off"/);
  assert.throws(() => assertDriving({ ...state, envConfirmed: false }, { open: true }), /non-production data/);
});

test('Scenario: Capture after the agreement - refused, and the captures are unchanged', () => {
  const { run, show } = review('precheck');
  assert.equal(run('', 'capture', 'evidence/01_initial.png').status, 0);
  run('', 'agree');
  const late = run('', 'capture', 'evidence/02_late.png');
  assert.equal(late.status, 2);
  assert.match(late.stderr, /the review is closed: captures are taken while the person tests/);
  assert.deepEqual(show().captures, ['evidence/01_initial.png']);
});

test('qa-pass records the hash of the exact script, and a sync after a fix clears it', () => {
  const { dir, run, show } = review('precheck');
  const script = join(dir, 'review-web.mjs');
  writeFileSync(script, 'export default async function () {}\n');
  const r = run('', 'qa-pass', script);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /any change to it needs a new pass/);
  assert.equal(show().qaScript.path, script);
  assert.match(show().qaScript.sha256, /^[0-9a-f]{64}$/);
  assert.equal(run('', 'qa-pass', join(dir, 'missing.mjs')).status, 2);
  assert.equal(run('', 'sync', join(dir, 'change')).status, 0);
  assert.equal(show().qaScript, null);
});

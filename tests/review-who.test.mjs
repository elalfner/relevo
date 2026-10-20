import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = (n) => new URL(`../scripts/${n}`, import.meta.url).pathname;
const who = (...a) => spawnSync('node', [bin('review-who.mjs'), ...a], { encoding: 'utf8' });

test('Scenario: Someone else runs the review - different logins exit 1 and name both', () => {
  const r = who('--assignee', 'persona-b', '--login', 'persona-c');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /assigned to persona-b, but persona-c is running the review/);
});

test('the same login passes, whatever the case', () => {
  assert.equal(who('--assignee', 'Persona-B', '--login', 'persona-b').status, 0);
  assert.equal(who('--assignee', 'persona-b', '--login', 'persona-b').status, 0);
});

test('missing arguments exit 2', () => {
  assert.equal(who('--assignee', 'persona-b').status, 2);
  assert.equal(who().status, 2);
});

// ---------- drain and the accumulated log

const APP = 'com.example.counter';
const SPEC = '## ADDED Requirements\n### Requirement: A\n#### Scenario: One\n- **WHEN** a\n- **THEN** b\n';
const START = `10-14 12:00:01.000  500  600 I ActivityManager: Start proc 4242:${APP}/u0a99 for next-top-activity`;

function review() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-dr-'));
  const state = join(dir, 'evidence', 'review-state.json');
  mkdirSync(join(dir, 'change', 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'change', 'specs', 'cap', 'spec.md'), SPEC);
  const run = (input, ...args) => spawnSync('node', [bin('review-state.mjs'), ...args, '--state', state], { input, encoding: 'utf8' });
  run('', 'init', join(dir, 'change'));
  return { dir, run };
}

test('Scenario: Long review - two drains accumulate and the audit reads both, plus what is still in the device', () => {
  const { dir, run } = review();
  assert.match(run(`${START}\n10-14 12:00:02.000  4242  4242 I flutter : first part`, 'drain').stdout, /2 line\(s\) added/);
  run('10-14 12:05:00.000  4242  4242 E flutter : Unhandled Exception: Bad state\n', 'drain');
  const kept = readFileSync(join(dir, 'evidence', 'device.log'), 'utf8');
  assert.match(kept, /first part\n10-14 12:05:00/, 'a chunk without a final newline does not glue to the next one');
  const out = run('10-14 12:09:00.000  4242  4242 I flutter : last part\n', 'audit', '--accumulated', '--package', APP).stdout;
  assert.match(out, /REVIEW REJECTED/);
  assert.match(out, /exception: .*Bad state/);
});

test('an empty accumulated file with an empty device log is inconclusive, and without --accumulated the file is ignored', () => {
  const { run } = review();
  run('', 'drain');
  assert.match(run('', 'audit', '--accumulated', '--package', APP).stdout, /REVIEW INCONCLUSIVE/);
  run(`${START}\n10-14 12:00:02.000  4242  4242 E flutter : Unhandled Exception: x\n`, 'drain');
  assert.match(run('10-14 12:09:00.000  4242  4242 I flutter : fine\n', 'audit', '--package', APP).stdout, /REVIEW INCONCLUSIVE/);
  assert.match(run('', 'audit', '--accumulated', '--package', APP).stdout, /REVIEW REJECTED/);
});

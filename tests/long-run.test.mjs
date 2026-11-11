import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastLine, statusLine, statusOf, tailLines, validId } from '../scripts/lib/long-run.mjs';

const RUN = new URL('../scripts/long-run.mjs', import.meta.url).pathname;
const GATE = new URL('../scripts/validation-gate.mjs', import.meta.url).pathname;
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lr = (dir, ...a) => spawnSync('node', [RUN, ...a], { cwd: dir, encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function repo({ test: testCmd = 'true' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: flutter\n    targets: [android]\n    checks:\n      analyze: "true"\n      test: ${JSON.stringify(testCmd)}\n`);
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return dir;
}
// The supervisor writes its status a moment after `start` returns: wait for it before reading its pid.
async function pidOf(dir, id) {
  for (let i = 0; i < 100; i++) {
    try { return JSON.parse(readFileSync(join(dir, `.relevo-run/${id}/status.json`), 'utf8')).pid; } catch { await sleep(100); }
  }
  throw new Error(`no status for ${id}`);
}
const waitDone = (dir, id) => lr(dir, 'wait', '--id', id, '--max-seconds', '20');

test('Scenario: A command that takes minutes - start returns at once and a later wait says it passed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  const t = Date.now();
  const s = lr(dir, 'start', '--id', 'suite', '--', 'sleep 2; echo all green');
  assert.equal(s.status, 0, s.stderr);
  assert.ok(Date.now() - t < 1500, 'start did not wait for the command');
  assert.match(s.stdout, /^started suite/);
  const running = lr(dir, 'status', '--id', 'suite');
  assert.equal(running.status, 2);
  assert.match(running.stdout, /^running /);
  const done = waitDone(dir, 'suite');
  assert.equal(done.status, 0, done.stdout);
  assert.match(done.stdout, /^passed exit=0 \d+s \| suite \| log .* \| last: all green/);
});

test('Scenario: Polling is cheap - one short line, with a tail only when asked', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  lr(dir, 'start', '--id', 'x', '--', 'for i in 1 2 3 4 5; do echo line$i; done');
  const r = waitDone(dir, 'x');
  assert.equal(r.stdout.trim().split('\n').length, 1);
  const t = lr(dir, 'status', '--id', 'x', '--tail', '2');
  assert.deepEqual(t.stdout.trim().split('\n').slice(1), ['line4', 'line5']);
});

test('Scenario: A wait is bounded - it returns "running" before the command ends', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  lr(dir, 'start', '--id', 'slow', '--', 'sleep 30');
  const t = Date.now();
  const w = lr(dir, 'wait', '--id', 'slow', '--max-seconds', '1');
  assert.equal(w.status, 2);
  assert.match(w.stdout, /^running /);
  assert.ok(Date.now() - t < 5000);
  process.kill(-(await pidOf(dir, 'slow')), 'SIGKILL');
});

test('A failing command is failed with its exit code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  lr(dir, 'start', '--id', 'bad', '--', 'echo boom; exit 7');
  const r = waitDone(dir, 'bad');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^failed exit=7 /);
});

test('Scenario: The job is killed - the log stays readable and the status is interrupted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  lr(dir, 'start', '--id', 'cut', '--', 'echo before the cut; sleep 30');
  let st;
  for (let i = 0; i < 40 && !st; i++) { await sleep(100); try { st = JSON.parse(readFileSync(join(dir, '.relevo-run/cut/status.json'), 'utf8')); } catch { /* not yet */ } }
  assert.ok(st, 'the supervisor wrote its status');
  await sleep(300);
  process.kill(-st.pid, 'SIGKILL');
  await sleep(300);
  const r = lr(dir, 'status', '--id', 'cut');
  assert.equal(r.status, 4);
  assert.match(r.stdout, /^interrupted after \d+s/);
  assert.match(readFileSync(join(dir, '.relevo-run/cut/log'), 'utf8'), /before the cut/);
  assert.match(r.stdout, /last: before the cut/);
});

test('Scenario: A run leaves files - the folder is ignored by git', () => {
  const dir = repo();
  lr(dir, 'start', '--id', 'g', '--', 'true');
  waitDone(dir, 'g');
  assert.equal(git(dir, 'status', '--porcelain').includes('.relevo-run'), false);
});

test('Arguments: bad ids, a missing command, an unknown run and a repeated start are refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lr-'));
  assert.equal(lr(dir, 'start', '--id', '../x', '--', 'true').status, 3);
  assert.equal(lr(dir, 'start', '--id', 'ok').status, 3);
  assert.equal(lr(dir, 'status', '--id', 'nothing').status, 3);
  assert.equal(lr(dir, 'bogus').status, 3);
  lr(dir, 'start', '--id', 'twice', '--', 'sleep 30');
  const again = lr(dir, 'start', '--id', 'twice', '--', 'true');
  assert.equal(again.status, 3);
  assert.match(again.stderr, /already running/);
  process.kill(-(await pidOf(dir, 'twice')), 'SIGKILL');
});

test('Scenario: The developer runs the suite - a check by name passes and the gate does not run it again', () => {
  const dir = repo({ test: 'echo run >> $PWD/runs.txt' });
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  const s = lr(dir, 'start', '--id', 'test', '--check', 'test', '--base', 'origin/main');
  assert.equal(s.status, 0, s.stderr);
  assert.equal(waitDone(dir, 'test').status, 0);
  assert.equal(readFileSync(join(dir, 'runs.txt'), 'utf8').trim().split('\n').length, 1);
  const g = spawnSync('node', [GATE, '--base', 'origin/main', '--config', join(dir, 'relevo.yml')], { cwd: dir, encoding: 'utf8' });
  assert.equal(g.status, 0, g.stdout + g.stderr);
  assert.equal(readFileSync(join(dir, 'runs.txt'), 'utf8').trim().split('\n').length, 1, 'the gate reused it');
  const receipt = JSON.parse(readFileSync(join(dir, '.relevo-receipt/receipt.json'), 'utf8'));
  assert.equal(receipt.commands.find((c) => c.name === 'test').reused, true);
});

test('Scenario: The agent cannot name the command of a check', () => {
  const dir = repo({ test: 'echo profile-command' });
  const r = lr(dir, 'start', '--id', 't', '--check', 'test', '--base', 'origin/main', '--', 'true');
  assert.equal(r.status, 3);
  assert.match(r.stderr, /takes its command from the profile/);
  assert.equal(lr(dir, 'start', '--id', 't', '--check', 'deploy', '--base', 'origin/main').status, 3);
  lr(dir, 'start', '--id', 't', '--check', 'test', '--base', 'origin/main');
  waitDone(dir, 't');
  assert.match(readFileSync(join(dir, '.relevo-run/t/log'), 'utf8'), /profile-command/);
});

test('Scenario: The tree changes during the run - nothing is recorded as reusable', () => {
  const dir = repo({ test: `echo changed-during > ${'$'}PWD/a.txt; echo run >> $PWD/runs.txt` });
  const s = lr(dir, 'start', '--id', 't', '--check', 'test', '--base', 'origin/main');
  assert.equal(s.status, 0, s.stderr);
  assert.equal(waitDone(dir, 't').status, 0);
  assert.equal(existsSync(join(dir, '.relevo-receipt/checks.json')), false);
});

test('A failing check is recorded as a failure, so the key is never reused', () => {
  const dir = repo({ test: 'echo run >> $PWD/runs.txt; exit 1' });
  writeFileSync(join(dir, 'a.txt'), 'changed\n');
  lr(dir, 'start', '--id', 't', '--check', 'test', '--base', 'origin/main');
  assert.equal(waitDone(dir, 't').status, 1);
  const store = JSON.parse(readFileSync(join(dir, '.relevo-receipt/checks.json'), 'utf8'));
  const rec = Object.values(store)[0];
  assert.deepEqual([rec.passes, rec.failures], [0, 1]);
});

test('The helpers: ids, last line and tails', () => {
  assert.equal(validId('test-1'), true);
  assert.equal(validId('Test'), false);
  assert.equal(validId('a/b'), false);
  assert.equal(lastLine('one\n\x1b[32mtwo\x1b[0m\n\n'), 'two');
  assert.equal(lastLine('x'.repeat(300)).length, 160);
  assert.equal(tailLines('a\nb\nc\n', 2), 'b\nc');
  assert.equal(statusOf(join(tmpdir(), 'relevo-no-such-run')).state, 'unknown');
  assert.match(statusLine('i', tmpdir(), { state: 'passed', exit_code: 0, seconds: 3 }), /^passed exit=0 3s \| i/);
});

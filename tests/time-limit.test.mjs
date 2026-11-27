import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordPhase, writeClass } from '../scripts/lib/phase-log.mjs';
import { budgetStatus } from '../scripts/lib/run-budget.mjs';
import { jobDeadline, runClock, writeRunLimits } from '../scripts/lib/time-limit.mjs';

const RUN = new URL('../scripts/long-run.mjs', import.meta.url).pathname;
const BUDGET = new URL('../scripts/run-budget.mjs', import.meta.url).pathname;
const GATE = new URL('../scripts/validation-gate.mjs', import.meta.url).pathname;
const MIN = 60000;
const temp = (name) => mkdtempSync(join(tmpdir(), `relevo-${name}-`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A build that entered planning `ago` milliseconds before `now`.
function build({ ago = 0, minutes = 50, deadline, now = Date.now() } = {}) {
  const dir = temp('clock');
  recordPhase(dir, { phase: 'planning' }, now - ago);
  writeRunLimits(dir, { run_max_minutes: minutes, job_deadline: deadline });
  return dir;
}

test('Scenario: A build on a machine - the hard stop is the limit plus 10 minutes', () => {
  const now = Date.now();
  const clock = runClock({ dir: build({ now }), now });
  assert.equal(clock.soft, now + 50 * MIN);
  assert.equal(clock.hard, now + 60 * MIN);
});

test('Scenario: Default values - the job leaves 5 minutes, so the hard stop is 55 minutes after its start', () => {
  const now = Date.now();
  const jobStart = now - 2 * MIN;
  const clock = runClock({ dir: build({ now, deadline: jobDeadline(jobStart, 60) }), now });
  assert.equal(clock.hard, jobStart + 55 * MIN);
  assert.equal(clock.soft, now + 50 * MIN);
});

test('a cap earlier than the limit applies to both, and no agent starts past it', () => {
  const now = Date.now();
  const dir = build({ ago: 21 * MIN, minutes: 58, deadline: now - MIN, now });
  assert.deepEqual([runClock({ dir, now }).soft, runClock({ dir, now }).hard], [now - MIN, now - MIN]);
  const status = budgetStatus({ dir, limits: { run_max_minutes: 58 }, now });
  assert.equal(status.stop, true);
  assert.equal(status.reason, 'minutes');
  assert.equal(status.hard_stop_passed, true);
});

test('Scenario: The job timeout cannot be read - there is no job deadline', () => {
  assert.equal(jobDeadline(Date.now(), null), null);
  assert.equal(jobDeadline(null, 60), null);
});

test('Scenario: Unreadable state - there is no clock', () => {
  assert.equal(runClock({ dir: null }), null);
  assert.equal(runClock({ dir: temp('empty'), fallbackMinutes: 50 }), null, 'no phase announced');
  const noLimit = temp('nolimit');
  recordPhase(noLimit, { phase: 'planning' });
  assert.equal(runClock({ dir: noLimit }), null, 'no limit known');
  assert.ok(runClock({ dir: noLimit, fallbackMinutes: 50 }), 'the fallback is used');
});

test('Scenario: A build that already ended - there is no clock, nor for a hard stop long gone', () => {
  const ended = build();
  writeClass(ended, 'built');
  assert.equal(runClock({ dir: ended }), null);
  assert.equal(runClock({ dir: build({ ago: 8 * 60 * MIN }) }), null);
});

test('the budget guard keeps the limit it was given, for what has no arguments', () => {
  const dir = temp('keep');
  spawnSync(process.execPath, [BUDGET, 'check', '--max-minutes', '7'], { cwd: temp('cwd'), env: { ...process.env, RELEVO_PROGRESS_DIR: dir } });
  assert.equal(JSON.parse(readFileSync(join(dir, 'limits.json'), 'utf8')).run_max_minutes, 7);
});

// A hard stop `ms` milliseconds from now: the job deadline is the earlier of the two.
const stopsIn = (ms) => build({ deadline: Date.now() + ms });
const lr = (cwd, progress, ...args) => spawnSync(process.execPath, [RUN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: progress ?? '' } });
const finish = (cwd, progress, id) => lr(cwd, progress, 'wait', '--id', id, '--max-seconds', '30');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('Scenario: The suite is still running - the command and what it started end, and the status says cut', async () => {
  const dir = temp('lr');
  const progress = stopsIn(3000);
  lr(dir, progress, 'start', '--id', 'suite', '--', 'sleep 60 & echo $! > child.pid; wait');
  const done = finish(dir, progress, 'suite');
  assert.equal(done.status, 5, done.stdout);
  assert.match(done.stdout, /^cut by the time limit of the run after \d+s \| suite \|/);
  const child = Number(readFileSync(join(dir, 'child.pid'), 'utf8'));
  for (let i = 0; i < 50 && alive(child); i += 1) await sleep(100);
  assert.equal(alive(child), false, 'the process the command started is gone');
});

test('Scenario: A command started after the hard stop - it does not run', () => {
  const dir = temp('lr');
  const progress = stopsIn(-1000);
  lr(dir, progress, 'start', '--id', 'late', '--', 'echo ran > ran.txt');
  const done = finish(dir, progress, 'late');
  assert.equal(done.status, 5, done.stdout);
  assert.equal(existsSync(join(dir, 'ran.txt')), false);
});

test('Scenario: Outside a build - the command runs until it ends', () => {
  const dir = temp('lr');
  lr(dir, null, 'start', '--id', 'free', '--', 'sleep 1; echo done');
  const done = finish(dir, null, 'free');
  assert.equal(done.status, 0, done.stdout);
});

function repo() {
  const dir = temp('gate');
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'a@b');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: flutter\n    targets: [android]\n    checks:\n      analyze: "true"\n      test: "sleep 60"\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib', 'a.txt'), 'change\n');
  git('add', '-N', '.');
  return dir;
}

test('Scenario: The gate is cut - no receipt is written, and a cut check is not recorded', () => {
  const dir = repo();
  const progress = stopsIn(4000);
  lr(dir, progress, 'start', '--id', 'gate', '--', `"${process.execPath}" "${GATE}" --base origin/main`);
  assert.equal(finish(dir, progress, 'gate').status, 5);
  assert.equal(existsSync(join(dir, '.relevo-receipt', 'receipt.json')), false);

  const again = stopsIn(3000);
  lr(dir, again, 'start', '--id', 'test', '--check', 'test', '--base', 'origin/main');
  assert.equal(finish(dir, again, 'test').status, 5);
  const store = join(dir, '.relevo-receipt', 'checks.json');
  assert.ok(!existsSync(store) || !readFileSync(store, 'utf8').includes('"test"'), 'the cut check was not recorded');
  lr(dir, null, 'start', '--id', 'ok', '--check', 'analyze', '--base', 'origin/main');
  assert.equal(finish(dir, null, 'ok').status, 0);
  assert.match(readFileSync(store, 'utf8'), /"analyze"/, 'a check that ran to its end is recorded there');
});

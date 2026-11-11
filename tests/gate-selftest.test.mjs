import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CASE_IDS, planCases, relevoCi, remoteRecipe, renderInstructions, renderReport, verdict } from '../scripts/lib/gate-selftest.mjs';

const SELFTEST = new URL('../scripts/gate-selftest.mjs', import.meta.url).pathname;
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// A repository on branch main whose flutter platform runs shell checks that the test writes.
function repo({ testCmd, withConfig = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-selftest-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  if (withConfig) writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: flutter\n    targets: [android]\n    checks:\n      analyze: "true"\n      test: ${JSON.stringify(testCmd)}\n`);
  mkdirSync(join(dir, '.relevo/stacks'), { recursive: true });
  writeFileSync(join(dir, 'a.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  return dir;
}
const run = (dir, ...extra) => spawnSync('node', [SELFTEST, '--config', join(dir, 'relevo.yml'), ...extra], { cwd: dir, encoding: 'utf8' });
const state = (dir) => [git(dir, 'branch', '-a'), git(dir, 'rev-parse', 'HEAD', 'origin/dev'), git(dir, 'status', '--porcelain'), git(dir, 'worktree', 'list')].join('\n---\n');

test('Scenario: the plan seeds the unit and docs cases and skips the story without Playwright', () => {
  const plan = planCases({ stack: 'vue', testCommand: 'npx --no-install vitest run' });
  assert.deepEqual(plan.map((c) => c.id), CASE_IDS);
  assert.ok(plan[0].seed.path.endsWith('.test.js') && plan[0].expect === 'red');
  assert.match(plan[1].skipped, /does not run Playwright/);
  assert.equal(plan[2].expect, 'green');
});

test('Scenario: the story is seeded when the test check runs Playwright; a stack without a seed skips the unit case', () => {
  assert.ok(planCases({ stack: 'vue', testCommand: 'vitest run && playwright test' })[1].seed);
  assert.match(planCases({ stack: 'rust', testCommand: 'cargo test' })[0].skipped, /no unit-test seed for the stack "rust"/);
});

test('verdicts, CI detection, report and instructions', () => {
  const c = { id: 'unit', expect: 'red' };
  assert.equal(verdict(c, 'red'), 'ok');
  assert.equal(verdict(c, 'green'), 'unexpected');
  assert.equal(verdict(c, 'could-not-run'), 'could-not-run');
  assert.equal(relevoCi({ configLoaded: false }).ok, false);
  assert.match(relevoCi({ configLoaded: true, platformResolved: true }).reason, /no `test` check/);
  assert.equal(relevoCi({ configLoaded: true, platformResolved: true, testCommand: 'x' }).ok, true);
  const report = renderReport({ base: 'origin/dev', platform: 'app', results: [{ ...c, title: 't', status: 'green', verdict: 'unexpected' }, { id: 'story', title: 's', skipped: 'why' }] });
  assert.match(report, /unit: t - gate green, expected red: unexpected\. the `test` check does not run the seeded unit test/);
  assert.match(report, /story: s - skipped: why/);
  assert.match(remoteRecipe({ results: [{ id: 'docs' }] }), /git push origin --delete relevo-selftest\/docs/);
  assert.match(renderInstructions({ reason: 'there is no valid relevo.yml', stack: 'vue', testCommand: undefined }), /Nothing was run: there is no valid relevo.yml[\s\S]*src\/relevo-selftest\.unit\.test\.js/);
});

test('Scenario: a run reports the three cases and leaves the repository as it was', () => {
  // The check fails while the seeded unit test file exists, as a real test run would.
  const dir = repo({ testCmd: 'test ! -e test/relevo_selftest_test.dart' });
  const before = state(dir);
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /unit: a failing unit test - gate red.*expected red: ok/);
  assert.match(r.stdout, /story: a failing browser story - skipped: .*Playwright/);
  assert.match(r.stdout, /docs: a docs-only change - gate green.*expected green: ok/);
  assert.equal(state(dir), before, 'branches, refs, working tree and worktrees are unchanged');
  assert.ok(!existsSync(join(dir, 'test/relevo_selftest_test.dart')) && !existsSync(join(dir, 'docs/relevo-selftest.md')));
});

test('Scenario: a seeded failure the checks do not see is unexpected and exits 1', () => {
  const dir = repo({ testCmd: 'true' });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /unit: .*gate green, expected red: unexpected/);
});

test('Scenario: a seeded browser story runs when the test check mentions Playwright', () => {
  const dir = repo({ testCmd: 'test ! -e e2e/relevo-selftest.spec.mjs && test ! -e test/relevo_selftest_test.dart # playwright' });
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /story: a failing browser story - gate red.*: ok/);
});

test('Scenario: no relevo.yml prints instructions, runs nothing and exits 0', () => {
  const dir = repo({ withConfig: false });
  const before = state(dir);
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Nothing was run: there is no valid relevo\.yml/);
  assert.equal(state(dir), before);
});

test('Scenario: a missing base ref stops before anything is written', () => {
  const dir = repo({ testCmd: 'true' });
  const r = run(dir, '--base', 'origin/nope');
  assert.equal(r.status, 3);
  assert.match(r.stderr, /base ref origin\/nope does not exist/);
  assert.equal(git(dir, 'worktree', 'list').trim().split('\n').length, 1);
});

test('Scenario: a gate that cannot run is reported and the worktree is still removed', () => {
  const dir = repo({ testCmd: 'relevo-no-such-tool --run' });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /could-not-run/);
  assert.equal(git(dir, 'worktree', 'list').trim().split('\n').length, 1);
});

test('Scenario: the installed paths of the profile stay linked for every case', () => {
  // flutter lists .dart_tool/package_config.json as installed; every case needs it, not only the first.
  const dir = repo({ testCmd: 'test -e .dart_tool/package_config.json && test ! -e test/relevo_selftest_test.dart' });
  mkdirSync(join(dir, '.dart_tool'), { recursive: true });
  writeFileSync(join(dir, '.dart_tool/package_config.json'), '{}\n');
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /docs: a docs-only change - gate green.*: ok/);
});

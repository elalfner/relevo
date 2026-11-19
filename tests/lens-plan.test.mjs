import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { batchLenses, planLenses, skippedLines } from '../scripts/lib/lens-plan.mjs';

const active = (plan) => plan.filter((p) => p.active).map((p) => p.lens);

test('Scenario: A stack with no interface - the lens is recorded as SKIPPED with that reason and no agent is launched for it', () => {
  const plan = planLenses({ interfaceKind: 'none', extraRules: 5 });
  assert.deepEqual(active(plan), ['spec', 'security', 'code', 'bugs']);
  assert.deepEqual(plan.find((p) => p.lens === 'interface'), { lens: 'interface', active: false, reason: 'the stack has no interface' });
  assert.deepEqual(skippedLines(plan), ['SKIPPED interface: the stack has no interface']);
});

test('Scenario: A change with a visible part - the lens is active when the stack has an interface and a rule beyond the always-on ones matches', () => {
  assert.deepEqual(active(planLenses({ interfaceKind: 'web', extraRules: 3 })), ['spec', 'security', 'code', 'interface', 'bugs']);
  assert.deepEqual(active(planLenses({ interfaceKind: 'mobile', extraRules: 1 })), ['spec', 'security', 'code', 'interface', 'bugs']);
});

test('an interface with only the always-on rules matching does not activate the lens', () => {
  const plan = planLenses({ interfaceKind: 'web', extraRules: 0 });
  const interfaceLens = plan.find((p) => p.lens === 'interface');
  assert.equal(interfaceLens.active, false);
  assert.match(interfaceLens.reason, /beyond the always-on ones/);
});

test('without the interface knowledge the lens never activates', () => {
  const plan = planLenses({ interfaceKind: null, extraRules: null });
  const interfaceLens = plan.find((p) => p.lens === 'interface');
  assert.equal(interfaceLens.active, false);
  assert.match(interfaceLens.reason, /interface knowledge is not installed/);
  assert.equal(planLenses().filter((p) => p.active).length, 4);
});

test('spec, security and code are always active, in that order, and the plan lists the five lenses', () => {
  assert.deepEqual(planLenses({ interfaceKind: 'none' }).map((p) => p.lens), ['spec', 'security', 'code', 'interface', 'bugs']);
});

test('the command prints the plan as JSON, and skips the interface lens when the interface knowledge is not installed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lens-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: vue\n    targets: [web]\n');
  const r = spawnSync('node', [new URL('../scripts/lens-plan.mjs', import.meta.url).pathname, '--config', join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.lenses.filter((l) => l.active).map((l) => l.lens), ['spec', 'security', 'code', 'bugs']);
  assert.match(out.skipped[0], /^SKIPPED interface: /);
  assert.equal(spawnSync('node', [new URL('../scripts/lens-plan.mjs', import.meta.url).pathname, '--config', join(dir, 'nope.yml')], { encoding: 'utf8' }).status, 2);
});

test('Scenario: Several active lenses - they are one batch, launched together', () => {
  assert.deepEqual(batchLenses(planLenses({ interfaceKind: 'web', extraRules: 2 })), [['spec', 'security', 'code', 'interface', 'bugs']]);
});

test('Scenario: A concurrency limit - batches of at most that many, in order', () => {
  const plan = planLenses({ interfaceKind: 'web', extraRules: 2 });
  assert.deepEqual(batchLenses(plan, 2), [['spec', 'security'], ['code', 'interface'], ['bugs']]);
  assert.deepEqual(batchLenses(plan, 3), [['spec', 'security', 'code'], ['interface', 'bugs']]);
  assert.deepEqual(batchLenses(plan, 1).length, 5);
});

test('Scenario: An inactive lens - it is in no batch', () => {
  assert.deepEqual(batchLenses(planLenses({ interfaceKind: 'none' })), [['spec', 'security', 'code', 'bugs']]);
});

test('the command prints the batches and rejects a bad --max-parallel', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lens-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: vue\n    targets: [web]\n');
  const script = new URL('../scripts/lens-plan.mjs', import.meta.url).pathname;
  const run = (...a) => spawnSync('node', [script, '--config', join(dir, 'relevo.yml'), ...a], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(run().stdout).batches, [['spec', 'security', 'code', 'bugs']]);
  assert.deepEqual(JSON.parse(run('--max-parallel', '2').stdout).batches, [['spec', 'security'], ['code', 'bugs']]);
  assert.equal(run('--max-parallel', '0').status, 2);
  assert.equal(run('--max-parallel', 'x').status, 2);
});

// ---- the bugs lens (add-qa-bugs-lens)

test('Scenario: The default - the bugs lens is active in advisory mode, in the same batch as the others', () => {
  const plan = planLenses({ interfaceKind: 'none' });
  assert.deepEqual(plan.find((p) => p.lens === 'bugs'), { lens: 'bugs', active: true, mode: 'advisory' });
  assert.deepEqual(batchLenses(plan), [['spec', 'security', 'code', 'bugs']]);
});

test('Scenario: Blocking - the plan carries the mode for the script that decides', () => {
  assert.deepEqual(planLenses({ interfaceKind: 'none', bugsMode: 'blocking' }).find((p) => p.lens === 'bugs'), { lens: 'bugs', active: true, mode: 'blocking' });
});

test('Scenario: Switched off - the lens is recorded as SKIPPED with that reason and no agent is launched', () => {
  const plan = planLenses({ interfaceKind: 'none', bugsMode: 'off' });
  assert.deepEqual(plan.find((p) => p.lens === 'bugs'), { lens: 'bugs', active: false, reason: 'qa.bugs is off', mode: 'off' });
  assert.deepEqual(skippedLines(plan), ['SKIPPED interface: the stack has no interface', 'SKIPPED bugs: qa.bugs is off']);
  assert.deepEqual(batchLenses(plan), [['spec', 'security', 'code']]);
});

test('a value that is not a mode is read as the default', () => {
  assert.equal(planLenses({ bugsMode: 'strict' }).find((p) => p.lens === 'bugs').mode, 'advisory');
});

test('the command reads qa.bugs of relevo.yml', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lens-'));
  const config = (extra) => { writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: vue\n    targets: [web]\n${extra}`); return join(dir, 'relevo.yml'); };
  const plan = (file) => JSON.parse(spawnSync('node', [new URL('../scripts/lens-plan.mjs', import.meta.url).pathname, '--config', file], { encoding: 'utf8' }).stdout);
  assert.equal(plan(config('')).lenses.find((l) => l.lens === 'bugs').mode, 'advisory');
  assert.equal(plan(config('qa:\n  bugs: blocking\n')).lenses.find((l) => l.lens === 'bugs').mode, 'blocking');
  const off = plan(config('qa:\n  bugs: off\n'));
  assert.equal(off.lenses.find((l) => l.lens === 'bugs').active, false);
  assert.ok(off.skipped.includes('SKIPPED bugs: qa.bugs is off'));
});

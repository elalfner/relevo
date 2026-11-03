import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planLenses, skippedLines } from '../scripts/lib/lens-plan.mjs';

const active = (plan) => plan.filter((p) => p.active).map((p) => p.lens);

test('Scenario: A stack with no interface - the lens is recorded as SKIPPED with that reason and no agent is launched for it', () => {
  const plan = planLenses({ interfaceKind: 'none', extraRules: 5 });
  assert.deepEqual(active(plan), ['spec', 'security', 'code']);
  assert.deepEqual(plan.find((p) => p.lens === 'interface'), { lens: 'interface', active: false, reason: 'the stack has no interface' });
  assert.deepEqual(skippedLines(plan), ['SKIPPED interface: the stack has no interface']);
});

test('Scenario: A change with a visible part - the lens is active when the stack has an interface and a rule beyond the always-on ones matches', () => {
  assert.deepEqual(active(planLenses({ interfaceKind: 'web', extraRules: 3 })), ['spec', 'security', 'code', 'interface']);
  assert.deepEqual(active(planLenses({ interfaceKind: 'mobile', extraRules: 1 })), ['spec', 'security', 'code', 'interface']);
});

test('an interface with only the always-on rules matching does not activate the lens', () => {
  const plan = planLenses({ interfaceKind: 'web', extraRules: 0 });
  assert.equal(plan.at(-1).active, false);
  assert.match(plan.at(-1).reason, /beyond the always-on ones/);
});

test('without the interface knowledge the lens never activates', () => {
  const plan = planLenses({ interfaceKind: null, extraRules: null });
  assert.equal(plan.at(-1).active, false);
  assert.match(plan.at(-1).reason, /interface knowledge is not installed/);
  assert.equal(planLenses().filter((p) => p.active).length, 3);
});

test('spec, security and code are always active, in that order', () => {
  assert.deepEqual(planLenses({ interfaceKind: 'none' }).map((p) => p.lens), ['spec', 'security', 'code', 'interface']);
});

test('the command prints the plan as JSON, and skips the interface lens when the interface knowledge is not installed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-lens-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    path: .\n    stack: vue\n    targets: [web]\n');
  const r = spawnSync('node', [new URL('../scripts/lens-plan.mjs', import.meta.url).pathname, '--config', join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.lenses.filter((l) => l.active).map((l) => l.lens), ['spec', 'security', 'code']);
  assert.match(out.skipped[0], /^SKIPPED interface: /);
  assert.equal(spawnSync('node', [new URL('../scripts/lens-plan.mjs', import.meta.url).pathname, '--config', join(dir, 'nope.yml')], { encoding: 'utf8' }).status, 2);
});

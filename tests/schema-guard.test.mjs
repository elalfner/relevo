import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApplySchema } from '../scripts/lib/schema-guard.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';
import { nextStep, NEXT_STEP_REASONS } from '../scripts/lib/next-step.mjs';

// Spec: go, "A build stops on a schema it does not understand".

const GUARD = fileURLToPath(new URL('../scripts/schema-guard.mjs', import.meta.url));
const SKILL = readFileSync(new URL('../skills/go/SKILL.md', import.meta.url), 'utf8');

test('Scenario: The supported schema - spec-driven with its tasks tracked goes on', () => {
  assert.deepEqual(checkApplySchema({ schemaName: 'spec-driven', taskTrackingConfigured: true }), { ok: true, schema: 'spec-driven' });
});

test('Scenario: Another schema - the reason names the schema and the detail says to use spec-driven', () => {
  const v = checkApplySchema({ schemaName: 'custom-flow', taskTrackingConfigured: true });
  assert.equal(v.ok, false);
  assert.equal(v.schema, 'custom-flow');
  assert.equal(v.reason, 'unsupported schema: custom-flow');
  assert.match(v.detail, /spec-driven/);
});

test('Scenario: Tasks not tracked - the schema is supported but OpenSpec does not track the tasks', () => {
  const v = checkApplySchema({ schemaName: 'spec-driven', taskTrackingConfigured: false });
  assert.equal(v.ok, false);
  assert.match(v.reason, /^unsupported schema: task tracking is not configured$/);
});

test('a missing field is an answer Relevo does not understand, never a pass', () => {
  assert.equal(checkApplySchema({}).ok, false);
  assert.equal(checkApplySchema(null).ok, false);
  assert.equal(checkApplySchema({ schemaName: 'spec-driven' }).ok, false);
  assert.equal(checkApplySchema({ taskTrackingConfigured: true }).reason, 'unsupported schema: unknown');
});

// The CLI, with a stub `openspec` on the path that prints what the test says.
function runGuard(output, args = ['--change', 'my-change']) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-schema-guard-'));
  const bin = join(dir, 'openspec');
  writeFileSync(bin, `#!/bin/sh\nif [ "$1 $2" != "instructions apply" ]; then exit 9; fi\nprintf '%s' '${output}'\n`);
  chmodSync(bin, 0o755);
  return spawnSync('node', [GUARD, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
}

test('the script exits 0 for spec-driven and prints the verdict', () => {
  const run = runGuard('{"schemaName":"spec-driven","taskTrackingConfigured":true}');
  assert.equal(run.status, 0);
  assert.deepEqual(JSON.parse(run.stdout), { ok: true, schema: 'spec-driven' });
});

test('the script exits 1 for another schema and for untracked tasks, before any agent', () => {
  const other = runGuard('{"schemaName":"custom-flow","taskTrackingConfigured":true}');
  assert.equal(other.status, 1);
  assert.equal(JSON.parse(other.stdout).reason, 'unsupported schema: custom-flow');
  const untracked = runGuard('{"schemaName":"spec-driven","taskTrackingConfigured":false}');
  assert.equal(untracked.status, 1);
  assert.match(JSON.parse(untracked.stdout).reason, /task tracking is not configured/);
});

test('the script exits 2 for a bad change id and when OpenSpec gives no JSON', () => {
  assert.equal(runGuard('{}', ['--change', '../x']).status, 2);
  assert.equal(runGuard('{}', []).status, 2);
  assert.equal(runGuard('not json').status, 2);
});

test('the recovery `schema` is in the table and tells the person what to change, in both languages', () => {
  assert.ok(NEXT_STEP_REASONS['build-failed'].includes('schema'));
  const en = nextStep({ state: 'build-failed', reason: 'schema', issue: 7, language: 'en' });
  assert.match(en.hint, /schema: spec-driven/);
  assert.match(en.hint, /openspec\/config\.yaml/);
  const es = nextStep({ state: 'build-failed', reason: 'schema', issue: 7, language: 'es' });
  assert.match(es.hint, /spec-driven/);
  assert.match(es.hint, /openspec\/config\.yaml/);
});

test('the failure comment names the schema and says nothing about QA', () => {
  const data = { issue: 7, title: 'Summary', assignee: 'persona-b', branch: 'feature/7-x', reason: 'unsupported schema: custom-flow', finding: 'the change uses the OpenSpec schema "custom-flow"', recovery: 'schema', branch_state: 'not_pushed' };
  const en = renderMessage('build_failed', data, 'en');
  assert.match(en, /unsupported schema: custom-flow/);
  assert.match(en, /QA did not reject the work/);
  assert.match(en, /schema: spec-driven/);
  const es = renderMessage('build_failed', data, 'es');
  assert.match(es, /unsupported schema: custom-flow/);
  assert.match(es, /spec-driven/);
  assert.doesNotMatch(es, /no pasó QA|QA la rechazó/);
});

test('the go skill runs the guard before the apply instructions and launches no agent on a refusal', () => {
  const guard = SKILL.indexOf('scripts/schema-guard.mjs --change');
  assert.ok(guard > 0, 'the skill runs schema-guard.mjs');
  assert.ok(guard < SKILL.indexOf('openspec instructions apply --change "<change_id>" --json', guard - 1), 'before the apply instructions');
  assert.ok(guard < SKILL.indexOf('model-plan.mjs --issue-file'), 'before the model plan');
  assert.match(SKILL.slice(guard, guard + 1200), /unsupported schema/);
  assert.match(SKILL.slice(guard, guard + 1200), /`recovery` `schema`/);
  assert.match(SKILL.slice(guard, guard + 1200), /launch no agent/);
  assert.ok(SKILL.includes('`unsupported schema: <name>`'), 'the reason is in the list of the failure path');
});

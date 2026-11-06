import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFromJson, parseUsageMarker, readUsage, usageLine, usageMarker } from '../scripts/lib/run-usage.mjs';

const CLI = fileURLToPath(new URL('../scripts/run-usage.mjs', import.meta.url));
const LOG = JSON.stringify([{ type: 'result', subtype: 'success', num_turns: 3, total_cost_usd: 0.5, usage: { input_tokens: 100, output_tokens: 50 } }]);
const PLAN = {
  dev: { model: 'haiku', effort: 'high', source: 'auto', why: 'small change (2 tasks, 2 scenarios)' },
  qa: {
    spec: { model: 'sonnet', effort: 'high', source: 'auto', why: 'small change (2 tasks, 2 scenarios)' },
    security: { model: 'opus', effort: 'high', source: 'config', why: 'set in relevo.yml' },
    code: { model: 'sonnet', effort: 'high', source: 'issue', why: 'the issue asks for sonnet' },
  },
  signals: { tasks: 2, scenarios: 2, size: 'small' },
  notes: ['the issue: Model: appears more than once; the first line is used'],
};

test('planFromJson keeps the roles of a plan, in order, and its notes', () => {
  const plan = planFromJson(JSON.stringify(PLAN));
  assert.deepEqual(plan.roles.map((r) => r.role), ['dev', 'spec', 'security', 'code']);
  assert.equal(plan.roles[0].model, 'haiku');
  assert.equal(plan.notes.length, 1);
});

test('planFromJson gives null for what is not a plan: a failure, nothing usable, invalid text', () => {
  assert.equal(planFromJson('not json'), null);
  assert.equal(planFromJson(JSON.stringify({ failed: true, reason: 'x' })), null);
  assert.equal(planFromJson(JSON.stringify({ dev: { model: 'haiku', source: 'made-up' } })), null);
  assert.equal(planFromJson(null), null);
});

test('planFromJson cleans the strings it keeps', () => {
  const plan = planFromJson({ dev: { model: 'haiku', source: 'auto', why: `x${'\u0007\n'}y${'z'.repeat(400)}` } });
  assert.ok(plan.roles[0].why.length <= 200);
  assert.doesNotMatch(plan.roles[0].why, /[\u0007\n]/);
});

test('Scenario: A run with a plan - the comment says the model, the effort, the source and the reason of each role', () => {
  const usage = readUsage(LOG);
  const plan = planFromJson(JSON.stringify(PLAN));
  const line = usageLine(usage, { plan });
  assert.match(line, /Models chosen: developer haiku, high \(auto: small change \(2 tasks, 2 scenarios\)\); spec lens sonnet, high \(auto: /);
  assert.match(line, /security lens opus, high \(config: set in relevo\.yml\)/);
  assert.match(line, /code lens sonnet, high \(issue: the issue asks for sonnet\)/);
  assert.match(line, /Notes on the plan: the issue: Model: appears more than once/);
  const marker = usageMarker(usage, { plan });
  assert.match(marker, /"plan":\[\{"role":"dev","model":"haiku"/);
});

test('Scenario: A run without a plan - the comment and the marker are the same as before', () => {
  const usage = readUsage(LOG);
  assert.equal(usageLine(usage, { plan: null }), usageLine(usage));
  assert.doesNotMatch(usageLine(usage), /Models chosen/);
  assert.doesNotMatch(usageMarker(usage, {}), /"plan"/);
});

test('Scenario: The digest - a marker with plan keeps its totals, and the plan is read back only when well formed', () => {
  const usage = readUsage(LOG);
  const plan = planFromJson(JSON.stringify(PLAN));
  const comment = { user: { type: 'Bot' }, created_at: '2026-11-06T00:00:00Z', body: `x\n\n${usageMarker(usage, { plan })}` };
  const run = parseUsageMarker(comment);
  assert.equal(run.turns, 3);
  assert.equal(run.cost, 0.5);
  assert.equal(run.plan.length, 4);
  assert.deepEqual(run.plan[0], { role: 'dev', model: 'haiku', source: 'auto', effort: 'high', why: 'small change (2 tasks, 2 scenarios)' });
  const bad = { ...comment, body: `x\n\n<!-- relevo:usage {"turns":3,"cost":0.5,"plan":[{"role":"dev","model":"haiku","source":"made-up"}]} -->` };
  const readBad = parseUsageMarker(bad);
  assert.equal(readBad.turns, 3, 'the totals are read as before');
  assert.equal(readBad.plan, undefined, 'a malformed plan is left out, not an error');
});

test('the command reads model-plan.json from the progress folder and prints the plan in the sentence and the marker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-usage-plan-'));
  writeFileSync(join(dir, 'exec.json'), LOG);
  writeFileSync(join(dir, 'model-plan.json'), JSON.stringify(PLAN));
  const r = spawnSync(process.execPath, [CLI, '--file', join(dir, 'exec.json'), '--progress-dir', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Models chosen: developer haiku/);
  assert.match(r.stdout, /"plan":\[/);
});

test('the command without a plan file, or with a failed plan, prints what it always printed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-usage-noplan-'));
  writeFileSync(join(dir, 'exec.json'), LOG);
  const without = spawnSync(process.execPath, [CLI, '--file', join(dir, 'exec.json'), '--progress-dir', dir], { encoding: 'utf8' });
  assert.equal(without.status, 0);
  assert.doesNotMatch(without.stdout, /Models chosen/);
  writeFileSync(join(dir, 'model-plan.json'), JSON.stringify({ failed: true, reason: 'x' }));
  const failed = spawnSync(process.execPath, [CLI, '--file', join(dir, 'exec.json'), '--progress-dir', dir], { encoding: 'utf8' });
  assert.equal(failed.status, 0);
  assert.doesNotMatch(failed.stdout, /Models chosen/);
  assert.doesNotMatch(failed.stdout, /"plan"/);
});

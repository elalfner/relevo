import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const BODY = '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n';
const dir = mkdtempSync(join(tmpdir(), 'goplan-'));
const config = join(dir, 'relevo.yml');
writeFileSync(config, 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b]\n');
const state = (over = {}) => ({
  issues: [{
    number: 7, title: 'Show the version', body: BODY, state: 'open', labels: ['relevo:ready'], assignees: ['persona-b'],
    milestone: { number: 1, due_on: null }, ready_at: '2026-10-15T10:00:00Z', ready_by: 'persona-a', ...over,
  }],
  completed: [], running: [], permissions: { 'persona-a': 'write' },
});

function plan(over, only = '7') {
  const input = join(dir, `state-${Math.random().toString(36).slice(2)}.json`);
  const out = join(dir, `out-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(input, JSON.stringify(state(over)));
  const r = spawnSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', config, '--only', only, '--github-output', out], { encoding: 'utf8' });
  let text = '';
  try { text = readFileSync(out, 'utf8'); } catch { /* not written */ }
  return { status: r.status, out: text, stderr: r.stderr };
}
const parse = (text) => Object.fromEntries(text.trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

test('Scenario: Gates pass - the output says start and carries the decision, encoded, for the build job', () => {
  const r = plan();
  assert.equal(r.status, 0, r.stderr);
  const o = parse(r.out);
  assert.equal(o.action, 'start');
  const decision = JSON.parse(Buffer.from(o.decision_b64, 'base64').toString('utf8'));
  assert.equal(decision.issue, 7);
  assert.equal(decision.branch, 'feature/7-show-the-version');
  assert.equal(decision.base, 'dev');
  assert.equal(decision.assignee, 'persona-b');
  assert.ok(!/[\n=]/.test(o.decision_b64.replace(/=+$/, '')), 'a single line, safe for the output file');
});

test('Scenario: Issue not ready to build - the output names the outcome and no build is started', () => {
  assert.equal(parse(plan({ body: 'no scenarios here' }).out).action, 'needs-spec');
  assert.equal(parse(plan({ milestone: null }).out).action, 'no-milestone');
  assert.equal(parse(plan({ assignees: [] }).out).action, 'no-assignee');
  assert.equal(parse(plan({ body: `${BODY}\nDepends-on: #1\n` }).out).action, 'block');
});

test('an issue the planner does not consider (already built) gives action none and an empty decision', () => {
  const o = parse(plan({ labels: ['relevo:built'] }).out);
  assert.equal(o.action, 'none');
  assert.equal(o.decision_b64, '');
});

test('the output option needs --only, because it describes one issue', () => {
  const input = join(dir, 'state-all.json');
  writeFileSync(input, JSON.stringify(state()));
  const r = spawnSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', config, '--github-output', join(dir, 'x.txt')], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--github-output needs --only/);
});

test('without --github-output nothing is written and the JSON on stdout is unchanged', () => {
  const input = join(dir, 'state-plain.json');
  writeFileSync(input, JSON.stringify(state()));
  const out = execFileSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', config, '--only', '7'], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).decisions[0].action, 'start');
});

test('Scenario: Run started by the workflow - the hash and the allowed paths survive the base64 round trip', () => {
  const o = parse(plan({ body: `${BODY}\nAllow-paths: composer.json, composer.lock\n` }).out);
  const decision = JSON.parse(Buffer.from(o.decision_b64, 'base64').toString('utf8'));
  assert.match(decision.issue_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(decision.allow_paths, ['composer.json', 'composer.lock']);
});

test('the decision printed on stdout for a run started by hand carries the same hash', () => {
  const input = join(dir, 'state-hash.json');
  writeFileSync(input, JSON.stringify(state()));
  const out = JSON.parse(execFileSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', config, '--only', '7'], { encoding: 'utf8' }));
  const viaWorkflow = JSON.parse(Buffer.from(parse(plan().out).decision_b64, 'base64').toString('utf8'));
  assert.equal(out.decisions[0].issue_hash, viaWorkflow.issue_hash);
});

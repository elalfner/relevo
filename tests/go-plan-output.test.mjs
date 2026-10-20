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

test('Scenario: Output for a start - platform, stack and path are written next to the action', () => {
  const many = join(dir, 'relevo-many.yml');
  writeFileSync(many, 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b]\nplatforms:\n  web:\n    stack: vue\n    path: apps/web\n  api:\n    stack: laravel\n    path: apps/api\n');
  const run = (over) => {
    const input = join(dir, `state-${Math.random().toString(36).slice(2)}.json`);
    const out = join(dir, `out-${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(input, JSON.stringify(state(over)));
    const r = spawnSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', many, '--only', '7', '--github-output', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return parse(readFileSync(out, 'utf8'));
  };
  const start = run({ body: `${BODY}\nPlatform: web\n` });
  assert.deepEqual([start.action, start.platform, start.stack, start.path], ['start', 'web', 'vue', 'apps/web']);
  const decision = JSON.parse(Buffer.from(start.decision_b64, 'base64').toString('utf8'));
  assert.deepEqual([decision.platform, decision.stack, decision.path, decision.targets], ['web', 'vue', 'apps/web', []]);
  const back = run({});
  assert.equal(back.action, 'needs-spec');
  assert.deepEqual([back.platform, back.stack, back.path], ['', '', ''], 'empty unless the decision is a start');
});

test('Scenario: Blocked by another repository - go-plan prints the block naming the reference, and starts once it is completed', () => {
  const cfg = join(dir, 'relevo-links.yml');
  writeFileSync(cfg, 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b]\nlinks: [acme/api]\n');
  const run = (extra) => {
    const input = join(dir, `state-${Math.random().toString(36).slice(2)}.json`);
    const out = join(dir, `out-${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(input, JSON.stringify({ ...state({ body: `${BODY}\nDepends-on: acme/api#12\n` }), ...extra }));
    const r = spawnSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', cfg, '--only', '7', '--github-output', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return { printed: JSON.parse(r.stdout), out: parse(readFileSync(out, 'utf8')) };
  };
  const waiting = run({});
  assert.equal(waiting.out.action, 'block');
  assert.equal(waiting.printed.decisions[0].reason, 'waiting for acme/api#12');
  assert.equal(run({ completedExternal: ['acme/api#12'] }).out.action, 'start');
});

test('Scenario: No credential - a start becomes local: nothing claimed, the issue keeps ready, one comment says what to do', () => {
  const run = (extra, over) => {
    const input = join(dir, `state-${Math.random().toString(36).slice(2)}.json`);
    const out = join(dir, `out-${Math.random().toString(36).slice(2)}.txt`);
    writeFileSync(input, JSON.stringify(state(over)));
    const r = spawnSync('node', [`${root}scripts/go-plan.mjs`, '--input', input, '--config', config, '--only', '7', '--github-output', out, ...extra], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return { printed: JSON.parse(r.stdout), out: parse(readFileSync(out, 'utf8')) };
  };
  const without = run(['--credential', 'false']);
  assert.equal(without.out.action, 'local');
  const d = without.printed.decisions[0];
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment.kind, 'cloud_not_configured');
  assert.equal(d.comment.data.actor, 'persona-a');
  assert.deepEqual([without.out.platform, without.out.stack, without.out.path], ['', '', ''], 'the build job gets nothing to start');
  assert.deepEqual(without.printed.summary, { local: 1 });
  assert.equal(run(['--credential', 'true']).out.action, 'start', 'with a credential nothing changes');
  assert.equal(run([]).out.action, 'start');
  // Every other decision is applied as usual.
  assert.equal(run(['--credential', 'false'], { milestone: null }).out.action, 'no-milestone');
});

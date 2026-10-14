import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { applyDecisions, commandsFor, gather, readyEvent } from '../scripts/lib/github.mjs';
import { planGo } from '../scripts/lib/plan.mjs';

const BODY = '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n';
const config = loadConfig('limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n').config;
const REPO = 'acme/app';

const rawIssue = (n, labels, extra = {}) => ({
  number: n, title: `Task ${n}`, body: BODY, state: 'open', labels: labels.map((name) => ({ name })),
  assignees: [{ login: 'persona-b' }], milestone: { number: 1, due_on: null }, ...extra,
});

// A fake `gh`: pages come back as an array of pages, as `--paginate --slurp` does.
function fakeGh(world) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const path = args[args.length - 1];
    if (args[0] === 'api') {
      const label = decodeURIComponent((path.match(/labels=(.*)$/) ?? [])[1] ?? '');
      if (path.includes('/issues?')) return JSON.stringify([world.issuesByLabel[label] ?? []]);
      if (path.includes('/timeline')) return JSON.stringify([world.timeline[Number(path.match(/issues\/(\d+)\/timeline/)[1])] ?? []]);
      if (path.includes('/permission')) {
        const login = path.match(/collaborators\/([^/]+)\//)[1];
        if (!(login in world.permissions)) throw new Error('HTTP 404');
        return JSON.stringify({ permission: world.permissions[login] });
      }
      const dep = path.match(/issues\/(\d+)$/);
      if (dep) return JSON.stringify(world.issueDetails[Number(dep[1])]);
    }
    return '';
  };
  gh.calls = calls;
  return gh;
}

const labeled = (name, by, at) => ({ event: 'labeled', label: { name }, actor: { login: by }, created_at: at });

test('readyEvent takes the last time the ready label was applied, and who applied it', () => {
  const timeline = [
    labeled('relevo:ready', 'persona-a', '2026-10-14T08:00:00Z'),
    { event: 'commented', created_at: '2026-10-14T08:30:00Z' },
    labeled('relevo:ready', 'persona-c', '2026-10-14T09:00:00Z'),
    labeled('bug', 'persona-a', '2026-10-14T10:00:00Z'),
  ];
  assert.deepEqual(readyEvent(timeline, 'relevo:ready'), { at: '2026-10-14T09:00:00Z', by: 'persona-c' });
  assert.deepEqual(readyEvent([], 'relevo:ready'), { at: null, by: null });
});

test('gather reads issues, ready time and author, permissions and merged dependencies', () => {
  const world = {
    issuesByLabel: {
      'relevo:ready': [rawIssue(1, ['relevo:ready'], { body: `${BODY}\nDepends-on: #7\n` }), rawIssue(2, ['relevo:ready'], { pull_request: {} })],
      'relevo:queued': [rawIssue(3, ['relevo:queued'])],
      'relevo:built': [rawIssue(4, ['relevo:built'])],
    },
    timeline: {
      1: [labeled('relevo:ready', 'persona-a', '2026-10-14T08:00:00Z')],
      3: [labeled('relevo:ready', 'stranger', '2026-10-14T07:00:00Z')],
    },
    permissions: { 'persona-a': 'write' },
    issueDetails: { 7: { number: 7, state: 'closed', state_reason: 'completed' } },
  };
  const gh = fakeGh(world);
  const state = gather({ gh, repo: REPO, config, running: [9] });

  assert.deepEqual(state.issues.map((i) => i.number).sort(), [1, 3, 4], 'pull requests are not issues');
  const one = state.issues.find((i) => i.number === 1);
  assert.equal(one.ready_at, '2026-10-14T08:00:00Z');
  assert.equal(one.ready_by, 'persona-a');
  assert.deepEqual(one.assignees, ['persona-b']);
  assert.deepEqual(one.labels, ['relevo:ready']);
  assert.deepEqual(state.completed, [7]);
  assert.deepEqual(state.permissions, { 'persona-a': 'write', stranger: 'none' }, 'a failed permission lookup means none');
  assert.deepEqual(state.running, [9]);
  assert.ok(!gh.calls.some((c) => c.join(' ').includes('/timeline') && c.join(' ').includes('/issues/4/')), 'built issues need no timeline');
});

test('an unmerged dependency is not reported as completed', () => {
  const world = {
    issuesByLabel: { 'relevo:ready': [rawIssue(1, ['relevo:ready'], { body: `${BODY}\nDepends-on: #7\n` })] },
    timeline: { 1: [labeled('relevo:ready', 'persona-a', '2026-10-14T08:00:00Z')] },
    permissions: { 'persona-a': 'write' },
    issueDetails: { 7: { number: 7, state: 'closed', state_reason: 'not_planned' } },
  };
  assert.deepEqual(gather({ gh: fakeGh(world), repo: REPO, config }).completed, []);
});

test('end to end: gathered state flows through the planner', () => {
  const world = {
    issuesByLabel: { 'relevo:ready': [rawIssue(1, ['relevo:ready'])] },
    timeline: { 1: [labeled('relevo:ready', 'persona-a', '2026-10-14T08:00:00Z')] },
    permissions: { 'persona-a': 'maintain' },
    issueDetails: {},
  };
  const plan = planGo({ config, ...gather({ gh: fakeGh(world), repo: REPO, config }) });
  assert.equal(plan.decisions[0].action, 'start');
});

test('commandsFor builds one label/assignee edit and one comment', () => {
  const decision = {
    issue: 31, action: 'needs-spec', labels: { add: ['relevo:needs-spec'], remove: ['relevo:ready'] }, assign: ['persona-a'],
    comment: { kind: 'needs_spec', data: { spec_writer: 'persona-a', issue: 31, title: 'T', missing: 'edge cases' } },
  };
  const [edit, comment] = commandsFor(decision, { repo: REPO, config });
  assert.deepEqual(edit, ['issue', 'edit', '31', '--repo', REPO, '--add-label', 'relevo:needs-spec', '--remove-label', 'relevo:ready', '--add-assignee', 'persona-a']);
  assert.deepEqual(comment.slice(0, 5), ['issue', 'comment', '31', '--repo', REPO]);
  assert.match(comment[6], /^@persona-a #31 "T" is back with you/);
});

test('commandsFor sends nothing when a decision changes nothing', () => {
  const noop = { issue: 1, action: 'queue', labels: { add: [], remove: [] }, assign: null, comment: null };
  assert.deepEqual(commandsFor(noop, { repo: REPO, config }), []);
});

test('comments use the language of relevo.yml', () => {
  const es = loadConfig('limits:\n  run_max_cost: 5\nlanguage: es\n').config;
  const d = { issue: 5, action: 'no-milestone', labels: { add: [], remove: [] }, comment: { kind: 'no_milestone', data: { issue: 5, actor: 'ana' } } };
  assert.match(commandsFor(d, { repo: REPO, config: es })[0][6], /no se inició: no tiene milestone/);
});

test('applyDecisions runs everything except start', () => {
  const sent = [];
  const decisions = [
    { issue: 1, action: 'start', labels: { add: ['relevo:building'], remove: ['relevo:ready'] }, comment: null },
    { issue: 2, action: 'queue', labels: { add: ['relevo:queued'], remove: ['relevo:ready'] }, comment: null },
  ];
  applyDecisions(decisions, { gh: (a) => sent.push(a), repo: REPO, config });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][2], '2');
});

const CLI = (name) => new URL(`../scripts/${name}`, import.meta.url).pathname;

test('go-plan CLI: plans from a state file and rejects a missing configuration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n');
  const state = { issues: [{ number: 31, title: 'Summary screen', body: BODY, state: 'open', labels: ['relevo:ready'], assignees: ['persona-b'], milestone: { number: 1 }, ready_at: '2026-10-14T08:00:00Z', ready_by: 'persona-a' }], permissions: { 'persona-a': 'write' } };
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
  const out = JSON.parse(execFileSync('node', [CLI('go-plan.mjs'), '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' }));
  assert.equal(out.decisions[0].action, 'start');
  assert.equal(out.decisions[0].branch, 'feature/31-summary-screen');
  const missing = spawnSync('node', [CLI('go-plan.mjs'), '--config', join(dir, 'nope.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /\/relevo:init/);
});

test('render-message CLI renders from stdin, with the language flag', () => {
  const data = JSON.stringify({ assignee: 'ana', issue: 31, title: 'T', tasks_done: 2, tasks_total: 2, branch: 'b', scenarios: 3 });
  const en = execFileSync('node', [CLI('render-message.mjs'), 'built'], { input: data, encoding: 'utf8' });
  assert.match(en, /is built/);
  const es = execFileSync('node', [CLI('render-message.mjs'), 'built', '--language', 'es'], { input: data, encoding: 'utf8' });
  assert.match(es, /está construida/);
  assert.equal(spawnSync('node', [CLI('render-message.mjs'), 'nope'], { encoding: 'utf8' }).status, 2);
});

test('label-change CLI prints the transition as JSON', () => {
  const out = execFileSync('node', [CLI('label-change.mjs'), '--to', 'built', '--current', 'relevo:building,bug'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { add: ['relevo:built'], remove: ['relevo:building'] });
});

test('applyDecisions marks only the claimed start decision when includeStart is set', () => {
  const sent = [];
  const decisions = [
    { issue: 1, action: 'start', labels: { add: ['relevo:building'], remove: ['relevo:ready'] }, comment: null },
  ];
  applyDecisions(decisions, { gh: (a) => sent.push(a), repo: REPO, config, includeStart: true });
  assert.equal(sent.length, 1);
  assert.ok(sent[0].includes('relevo:building'));
});

test('go-plan CLI: --only keeps one decision and --claim needs --only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n');
  const mk = (n, at) => ({ number: n, title: `T${n}`, body: BODY, state: 'open', labels: ['relevo:ready'], assignees: [`p${n}`], milestone: { number: 1 }, ready_at: at, ready_by: 'persona-a' });
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [mk(1, '2026-10-14T08:00:00Z'), mk(2, '2026-10-14T09:00:00Z')], permissions: { 'persona-a': 'write' } }));
  const base = [CLI('go-plan.mjs'), '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')];
  const out = JSON.parse(execFileSync('node', [...base, '--only', '2'], { encoding: 'utf8' }));
  assert.deepEqual(out.decisions.map((d) => d.issue), [2]);
  assert.deepEqual(out.summary, { start: 1 });
  const claim = spawnSync('node', [...base, '--claim'], { encoding: 'utf8' });
  assert.equal(claim.status, 2);
  assert.match(claim.stderr, /--claim needs --only/);
});

test('stage CLI refuses to stage everything and stages only the named files', () => {
  const repo = mkdtempSync(join(tmpdir(), 'relevo-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 't');
  writeFileSync(join(repo, 'a.txt'), 'a');
  writeFileSync(join(repo, 'b.txt'), 'b');
  const stage = (...paths) => spawnSync('node', [CLI('stage.mjs'), ...paths], { cwd: repo, encoding: 'utf8' });
  assert.equal(stage('.').status, 2);
  assert.equal(stage('-A').status, 2);
  assert.equal(stage().status, 2);
  assert.equal(stage('a.txt').status, 0);
  assert.equal(git('diff', '--cached', '--name-only').trim(), 'a.txt');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { checkRollup, latestReviewStates, shipDecision } from '../scripts/lib/ship.mjs';
import { checkArchiveChanges, pathsFromPorcelain } from '../scripts/lib/archive-check.mjs';

const CLI = (n) => new URL(`../scripts/${n}`, import.meta.url).pathname;
const cfg = (extra = '') => {
  const r = loadConfig(`limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n${extra}`);
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r.config;
};
const peer = cfg('review:\n  mode: peer\n');
const solo = cfg('review:\n  mode: none\n');

const GOOD_CHECKS = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const review = (login, state, at) => ({ author: { login }, state, submittedAt: at });
const pr = (over = {}) => ({
  number: 40, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', title: 'Summary screen', author: { login: 'persona-b' },
  reviews: [review('persona-c', 'APPROVED', '2026-10-14T10:00:00Z')], statusCheckRollup: GOOD_CHECKS,
  headRefName: 'feature/31-summary', baseRefName: 'dev', ...over,
});

// ---------- reviews and checks

test('only the latest decisive review of each person counts; comments never cancel an approval', () => {
  const states = latestReviewStates([
    review('c', 'APPROVED', '2026-10-14T09:00:00Z'),
    review('c', 'COMMENTED', '2026-10-14T10:00:00Z'),
    review('d', 'CHANGES_REQUESTED', '2026-10-14T09:00:00Z'),
    review('d', 'APPROVED', '2026-10-14T11:00:00Z'),
    review('e', 'APPROVED', '2026-10-14T09:00:00Z'),
    review('e', 'DISMISSED', '2026-10-14T10:00:00Z'),
  ]);
  assert.equal(states.get('c'), 'APPROVED');
  assert.equal(states.get('d'), 'APPROVED', 'a later approval resolves earlier requested changes');
  assert.equal(states.get('e'), 'DISMISSED');
});

test('check summary: none, passing, failing, pending, for check runs and commit statuses', () => {
  assert.equal(checkRollup([]).state, 'none');
  assert.equal(checkRollup(undefined).state, 'none');
  assert.equal(checkRollup(GOOD_CHECKS).state, 'passing');
  assert.equal(checkRollup([{ __typename: 'CheckRun', name: 'lint', status: 'COMPLETED', conclusion: 'SKIPPED' }]).state, 'passing');
  const failing = checkRollup([...GOOD_CHECKS, { __typename: 'CheckRun', name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' }]);
  assert.deepEqual([failing.state, failing.failing], ['failing', ['build']]);
  assert.equal(checkRollup([{ __typename: 'CheckRun', name: 'build', status: 'IN_PROGRESS' }]).state, 'pending');
  assert.equal(checkRollup([{ __typename: 'StatusContext', context: 'ci', state: 'PENDING' }]).state, 'pending');
  assert.equal(checkRollup([{ __typename: 'StatusContext', context: 'ci', state: 'ERROR' }]).state, 'failing');
});

// ---------- decision

test('Scenario: No pull request - ship stops and names /relevo:review', () => {
  const d = shipDecision({ config: peer, pr: null, invoker: 'persona-c' });
  assert.equal(d.allowed, false);
  assert.match(d.reasons[0], /\/relevo:review/);
});

test('a merged or closed pull request cannot be shipped', () => {
  assert.match(shipDecision({ config: peer, pr: pr({ state: 'MERGED' }), invoker: 'persona-c' }).reasons[0], /already merged/);
  assert.match(shipDecision({ config: peer, pr: pr({ state: 'CLOSED' }), invoker: 'persona-c' }).reasons[0], /closed without merging/);
});

test('Scenario: Explicit confirmation - with approval, passing checks and the right person, it may merge once confirmed', () => {
  const d = shipDecision({ config: peer, pr: pr(), invoker: 'persona-c' });
  assert.equal(d.allowed, true);
  assert.deepEqual(d.reasons, []);
  assert.deepEqual(d.confirm, ['merge']);
  assert.deepEqual(d.summary, { pr: 40, title: 'Summary screen', author: 'persona-b', branch: 'feature/31-summary', base: 'dev', mode: 'peer', approvedBy: ['persona-c'], checks: 'passing' });
});

test('Scenario: Conflicts - stops and tells the author to synchronise', () => {
  const d = shipDecision({ config: peer, pr: pr({ mergeable: 'CONFLICTING' }), invoker: 'persona-c' });
  assert.equal(d.allowed, false);
  assert.match(d.reasons.join(' '), /conflicts: the author must synchronise/);
});

test('mergeability still being computed is a reason to wait, not to merge', () => {
  assert.match(shipDecision({ config: peer, pr: pr({ mergeable: 'UNKNOWN' }), invoker: 'persona-c' }).reasons.join(' '), /try again in a minute/);
});

test('failing or running checks stop the merge', () => {
  const bad = pr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' }] });
  assert.match(shipDecision({ config: peer, pr: bad, invoker: 'persona-c' }).reasons.join(' '), /checks are failing: build/);
  const running = pr({ statusCheckRollup: [{ __typename: 'CheckRun', name: 'build', status: 'QUEUED' }] });
  assert.match(shipDecision({ config: peer, pr: running, invoker: 'persona-c' }).reasons.join(' '), /still running: build/);
});

test('Scenario: No CI configured - it can continue, but only after the person confirms there is no objective check', () => {
  const d = shipDecision({ config: peer, pr: pr({ statusCheckRollup: [] }), invoker: 'persona-c' });
  assert.equal(d.allowed, true);
  assert.deepEqual(d.confirm, ['merge', 'no-ci']);
  assert.equal(d.summary.checks, 'none');
});

test('a draft pull request is not shipped', () => {
  assert.match(shipDecision({ config: peer, pr: pr({ isDraft: true }), invoker: 'persona-c' }).reasons.join(' '), /still a draft/);
});

test('Scenario: No approval - peer mode waits for someone other than the author', () => {
  const d = shipDecision({ config: peer, pr: pr({ reviews: [] }), invoker: 'persona-c' });
  assert.equal(d.allowed, false);
  assert.match(d.reasons.join(' '), /waiting for an approval from someone other than the author/);
});

test('the author approving their own pull request does not count', () => {
  const own = pr({ reviews: [review('persona-b', 'APPROVED', '2026-10-14T10:00:00Z')] });
  assert.match(shipDecision({ config: peer, pr: own, invoker: 'persona-c' }).reasons.join(' '), /waiting for an approval/);
});

test('outstanding change requests stop the merge even with an approval', () => {
  const mixed = pr({ reviews: [review('persona-c', 'APPROVED', '2026-10-14T09:00:00Z'), review('persona-d', 'CHANGES_REQUESTED', '2026-10-14T10:00:00Z')] });
  const d = shipDecision({ config: peer, pr: mixed, invoker: 'persona-c' });
  assert.equal(d.allowed, false);
  assert.match(d.reasons.join(' '), /changes were requested by persona-d/);
});

test('roles mode only accepts approvals from the listed approvers', () => {
  const rolesCfg = loadConfig('limits:\n  run_max_cost: 5\nreview:\n  mode: roles\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c, persona-d]\n  approvers: [persona-c]\n');
  assert.ok(rolesCfg.ok, JSON.stringify(rolesCfg.errors));
  const byOther = pr({ reviews: [review('persona-d', 'APPROVED', '2026-10-14T10:00:00Z')] });
  assert.match(shipDecision({ config: rolesCfg.config, pr: byOther, invoker: 'persona-c' }).reasons.join(' '), /one of the approvers/);
  assert.equal(shipDecision({ config: rolesCfg.config, pr: pr(), invoker: 'persona-c' }).allowed, true);
});

test('Scenario: Approver merges, author tries to ship - refused, naming who should run it', () => {
  const d = shipDecision({ config: peer, pr: pr(), invoker: 'persona-b' });
  assert.equal(d.allowed, false);
  assert.match(d.reasons.join(' '), /the author cannot run ship here.*persona-c should run it/);
});

test('Scenario: Author merges - the author runs ship once a non-author approved', () => {
  const author = cfg('review:\n  mode: peer\n  merger: author\n');
  assert.equal(shipDecision({ config: author, pr: pr(), invoker: 'persona-b' }).allowed, true);
  const other = shipDecision({ config: author, pr: pr(), invoker: 'persona-c' });
  assert.equal(other.allowed, false);
  assert.match(other.reasons.join(' '), /the author \(persona-b\) runs ship/);
});

test('Scenario: Solo confirmation - without a peer, only the person confirming matters', () => {
  const d = shipDecision({ config: solo, pr: pr({ reviews: [] }), invoker: 'persona-b' });
  assert.equal(d.allowed, true, JSON.stringify(d.reasons));
  assert.deepEqual(d.confirm, ['merge']);
});

test('solo mode still stops on conflicts or failing checks', () => {
  assert.equal(shipDecision({ config: solo, pr: pr({ mergeable: 'CONFLICTING' }), invoker: 'persona-b' }).allowed, false);
});

test('ship-check CLI: exit 0 when it may merge, 1 when it must stop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nreview:\n  mode: peer\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n');
  const file = (name, data) => { writeFileSync(join(dir, name), JSON.stringify(data)); return join(dir, name); };
  const run = (input, invoker) => spawnSync('node', [CLI('ship-check.mjs'), '--config', join(dir, 'relevo.yml'), '--input', input, '--invoker', invoker], { encoding: 'utf8' });
  const ok = run(file('ok.json', pr()), 'persona-c');
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).allowed, true);
  const no = run(file('none.json', null), 'persona-c');
  assert.equal(no.status, 1);
  assert.match(JSON.parse(no.stdout).reasons[0], /relevo:review/);
  assert.equal(spawnSync('node', [CLI('ship-check.mjs'), '--config', join(dir, 'missing.yml')], { encoding: 'utf8' }).status, 2);
});

// ---------- the archive may touch only the specifications folder

test('Scenario: Archive commit touches only specs', () => {
  assert.deepEqual(checkArchiveChanges(['openspec/changes/31-x/tasks.md', 'openspec/specs/a/spec.md']), { ok: true, outside: [] });
});

test('Scenario: Archive commit touches code - aborts before merging and reports the files', () => {
  const r = checkArchiveChanges(['openspec/specs/a/spec.md', 'lib/main.dart', 'pubspec.yaml']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.outside, ['lib/main.dart', 'pubspec.yaml']);
});

test('an archive that changed nothing is reported, not accepted', () => {
  const r = checkArchiveChanges([]);
  assert.equal(r.ok, false);
  assert.equal(r.empty, true);
});

test('a folder that merely starts with the same letters is not the specifications folder', () => {
  assert.equal(checkArchiveChanges(['openspec-extra/file.md']).ok, false);
});

test('git status output is read, including renames', () => {
  const out = ' D openspec/changes/a/tasks.md\n?? openspec/changes/archive/x/tasks.md\nR  openspec/a.md -> docs/a.md\n';
  assert.deepEqual(pathsFromPorcelain(out), ['openspec/changes/a/tasks.md', 'openspec/changes/archive/x/tasks.md', 'openspec/a.md', 'docs/a.md']);
});

test('check-archive CLI against a real git repository', () => {
  const repo = mkdtempSync(join(tmpdir(), 'relevo-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
  const check = () => spawnSync('node', [CLI('check-archive.mjs')], { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, 'openspec', 'changes', 'x'), { recursive: true });
  mkdirSync(join(repo, 'lib'), { recursive: true });
  writeFileSync(join(repo, 'openspec', 'changes', 'x', 'tasks.md'), '- [x] 1.1 a\n');
  writeFileSync(join(repo, 'lib', 'a.dart'), '//\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  assert.equal(check().status, 1, 'nothing changed');
  mkdirSync(join(repo, 'openspec', 'specs', 'x'), { recursive: true });
  writeFileSync(join(repo, 'openspec', 'specs', 'x', 'spec.md'), '#### Scenario: a\n');
  assert.equal(check().status, 0);
  writeFileSync(join(repo, 'lib', 'a.dart'), '// edited\n');
  const bad = check();
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /outside openspec\/.*lib\/a\.dart/);
});

test('label-change --clear removes every Relevo label and leaves the others', () => {
  const out = execFileSync('node', [CLI('label-change.mjs'), '--clear', '--current', 'relevo:pr-open,relevo:needs-reviewer,bug'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { add: [], remove: ['relevo:pr-open', 'relevo:needs-reviewer'] });
});

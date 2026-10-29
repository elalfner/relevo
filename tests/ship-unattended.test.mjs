import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { shipDecision } from '../scripts/lib/ship.mjs';
import { findChange, labelRules, runUnattendedShip } from '../scripts/lib/ship-unattended.mjs';

const PLUGIN_ROOT = new URL('..', import.meta.url).pathname;
const GOOD = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const RELEVO_YML = 'branches:\n  base: dev\nlimits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n';

const gitIn = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8' }).trim();
const write = (root, path, text) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
};

/**
 * A real origin with main, dev and feature/31-summary, a checkout of the default branch to ship from, and fakes for
 * GitHub and OpenSpec that read the real commits. `opts` change what GitHub reports.
 */
function setup(opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'relevo-ship-'));
  const origin = join(root, 'origin.git');
  gitIn(root, 'init', '--bare', origin);
  const seed = join(root, 'seed');
  gitIn(root, 'clone', origin, seed);
  write(seed, 'relevo.yml', RELEVO_YML);
  write(seed, 'lib/main.dart', 'void main() {}\n');
  write(seed, 'openspec/specs/.gitkeep', '');
  gitIn(seed, 'add', '.');
  gitIn(seed, 'commit', '-m', 'init');
  gitIn(seed, 'push', 'origin', 'HEAD:refs/heads/main');
  write(seed, 'relevo.yml', opts.baseConfig ?? RELEVO_YML);
  gitIn(seed, 'commit', '-am', 'dev config', '--allow-empty');
  gitIn(seed, 'push', 'origin', 'HEAD:refs/heads/dev');
  gitIn(seed, 'switch', '-c', 'feature/31-summary');
  write(seed, 'lib/main.dart', 'void main() { print(1); }\n');
  write(seed, 'openspec/changes/31-summary/proposal.md', '# Proposal\n');
  write(seed, 'openspec/changes/31-summary/tasks.md', '## 1. Work\n\n- [x] 1.1 Do it\n');
  if (opts.branchConfig) write(seed, 'relevo.yml', opts.branchConfig);
  gitIn(seed, 'add', '.');
  gitIn(seed, 'commit', '-m', 'feat: summary (#31)');
  gitIn(seed, 'push', 'origin', 'HEAD:refs/heads/feature/31-summary');
  const approved = gitIn(seed, 'rev-parse', 'HEAD');
  const work = join(root, 'work');
  gitIn(root, 'clone', origin, work);
  gitIn(work, 'config', 'user.name', 'relevo');
  gitIn(work, 'config', 'user.email', 'relevo@example.com');

  const state = { labels: opts.labels ?? ['relevo:pr-open', 'relevo:ship'], issueState: 'OPEN', merged: null, comments: [], edits: [], dispatched: [], pushCalls: [], polls: 0 };
  const branchHead = () => {
    try {
      return gitIn(root, '--git-dir', origin, 'rev-parse', 'refs/heads/feature/31-summary');
    } catch {
      return null;
    }
  };
  const rollupOf = (oid) => (oid === approved ? opts.approvedChecks ?? GOOD : opts.archiveChecks?.(state) ?? []);
  const pr = () => ({
    number: 40, state: state.merged ? 'MERGED' : 'OPEN', isDraft: false, mergeable: opts.mergeable?.(state) ?? 'MERGEABLE', title: 'Summary screen (#31)',
    author: { login: 'persona-b' },
    reviews: opts.reviews ?? [{ author: { login: 'persona-c' }, state: 'APPROVED', submittedAt: '2026-10-14T10:00:00Z', commit: { oid: approved } }],
    statusCheckRollup: rollupOf(branchHead()), headRefName: 'feature/31-summary', headRefOid: branchHead(), baseRefName: 'dev',
  });

  const gh = (args) => {
    const joined = args.join(' ');
    if (joined.startsWith('issue view')) return JSON.stringify({ state: state.issueState, labels: state.labels.map((name) => ({ name })) });
    if (joined.startsWith('pr list')) return JSON.stringify([{ number: 40, state: 'OPEN' }]);
    if (joined.startsWith('pr view') && joined.includes('mergeCommit')) return 'abcdef1234567\n';
    if (joined.startsWith('pr view')) {
      state.polls += 1;
      return JSON.stringify(pr());
    }
    if (args[1]?.startsWith('repos/o/r/compare/')) {
      const [from, to] = args[1].replace('repos/o/r/compare/', '').split('...');
      const files = gitIn(root, '--git-dir', origin, 'diff', '--name-only', `${from}...${to}`).split('\n').filter(Boolean);
      return JSON.stringify({ files: files.map((filename) => ({ filename })) });
    }
    if (args[1] === 'graphql') {
      const oid = args.find((a) => a.startsWith('oid=')).slice(4);
      return JSON.stringify({ data: { repository: { object: { statusCheckRollup: { contexts: { nodes: rollupOf(oid) } } } } } });
    }
    if (opts.planRefusal && args[1] === 'repos/o/r/rules/branches/dev') {
      throw Object.assign(new Error('Command failed'), { stderr: 'gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)' });
    }
    if (opts.rulesError && args[1] === 'repos/o/r/rules/branches/dev') throw Object.assign(new Error('Command failed'), { stderr: opts.rulesError });
    if (args[1] === 'repos/o/r/rules/branches/dev') return JSON.stringify(opts.requiredChecks ? [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test' }] } }] : []);
    // The workflow token reads the branch, never its admin-only protection endpoint; on a free private repository the
    // branch is not read at all.
    if (args[1] === 'repos/o/r/branches/dev' && !opts.planRefusal) {
      const level = opts.classicChecks ? 'everyone' : 'off';
      return JSON.stringify({ name: 'dev', protected: !!opts.classicChecks, protection: { enabled: !!opts.classicChecks, required_status_checks: { enforcement_level: level, contexts: opts.classicChecks ?? [], checks: [] } } });
    }
    if (args[1]?.startsWith('repos/o/r/branches/dev')) throw Object.assign(new Error('Command failed'), { stderr: 'gh: Resource not accessible by integration (HTTP 403)' });
    if (joined.startsWith('issue comment')) {
      state.comments.push(args[args.indexOf('--body') + 1]);
      return '';
    }
    if (joined.startsWith('issue edit')) {
      state.edits.push(args);
      const removed = args.filter((a, i) => args[i - 1] === '--remove-label');
      state.labels = state.labels.filter((l) => !removed.includes(l));
      return '';
    }
    if (joined.startsWith('workflow run')) {
      state.dispatched.push(args[2]);
      return '';
    }
    throw new Error(`unexpected gh ${joined}`);
  };
  const pushGh = (args) => {
    state.pushCalls.push(args);
    const joined = args.join(' ');
    if (joined.startsWith('pr merge')) {
      if (opts.refuseMerge) throw Object.assign(new Error('merge refused'), { stderr: opts.refuseMerge });
      const pinned = args[args.indexOf('--match-head-commit') + 1];
      if (pinned !== branchHead()) throw Object.assign(new Error('head moved'), { stderr: 'Head branch was modified' });
      state.merged = pinned;
      return '';
    }
    if (joined.startsWith('issue close')) {
      state.issueState = 'CLOSED';
      return '';
    }
    return gh(args);
  };
  // openspec: validate passes; archive moves the change folder and writes the main spec, as the real tool does.
  const sh = (cmd, args, { cwd, input, env } = {}) => {
    if (cmd === 'openspec') {
      if (args[0] === 'validate') return { status: opts.invalid ? 1 : 0, stdout: opts.invalid ? 'Change 31-summary has issues' : 'valid', stderr: '' };
      if (args[0] === 'archive') {
        mkdirSync(join(cwd, 'openspec/changes/archive'), { recursive: true });
        renameSync(join(cwd, 'openspec/changes/31-summary'), join(cwd, 'openspec/changes/archive/2026-10-23-31-summary'));
        write(cwd, 'openspec/specs/summary/spec.md', '# summary\n');
        return { status: 0, stdout: 'archived', stderr: '' };
      }
    }
    const r = spawnSync(cmd, args, { cwd, input, encoding: 'utf8', env: { ...process.env, ...env } });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
  let clock = 0;
  const ctx = (over = {}) => ({
    repo: 'o/r', issue: '31', actor: 'persona-c', actorType: 'User', hasApp: false, workDir: work, pluginRoot: PLUGIN_ROOT,
    sh, gh, pushGh, sleep: async (ms) => { clock += ms; }, now: () => clock, headPollMs: 1, ...over,
  });
  return { root, origin, seed, work, state, approved, branchHead, ctx };
}

// ---------- the label rules

const config = loadConfig(RELEVO_YML).config;
const prJson = (over = {}) => ({
  number: 40, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', title: 'T (#31)', author: { login: 'persona-b' },
  reviews: [{ author: { login: 'persona-c' }, state: 'APPROVED', submittedAt: '2026-10-14T10:00:00Z', commit: { oid: 'h' } }],
  statusCheckRollup: GOOD, headRefName: 'feature/31-x', headRefOid: 'h', baseRefName: 'dev', ...over,
});

test('the label may ship what the approver could ship in a session', () => {
  assert.equal(labelRules({ decision: shipDecision({ config, pr: prJson(), invoker: 'persona-c' }), config }), null);
});

test('Scenario: Eligible member who did not approve - a label cannot confirm it', () => {
  const c = loadConfig(RELEVO_YML.replace('persona-c]', 'persona-c, persona-d]')).config;
  const rule = labelRules({ decision: shipDecision({ config: c, pr: prJson(), invoker: 'persona-d' }), config: c });
  assert.deepEqual(rule, { kind: 'ship_not_approver', data: { approvers: '@persona-c' } });
});

test('Scenario: No CI configured in an unattended ship - stops unless review.ship_without_ci', () => {
  const decision = shipDecision({ config, pr: prJson({ statusCheckRollup: [] }), invoker: 'persona-c' });
  assert.equal(labelRules({ decision, config }).kind, 'ship_no_ci');
  const allowed = loadConfig(`${RELEVO_YML}review:\n  ship_without_ci: true\n`).config;
  assert.equal(labelRules({ decision, config: allowed }), null);
});

test('Scenario: The author labels when the approver merges - the reasons name the approver', () => {
  const rule = labelRules({ decision: shipDecision({ config, pr: prJson(), invoker: 'persona-b' }), config });
  assert.equal(rule.kind, 'ship_stopped');
  assert.match(rule.data.reasons, /persona-c should run it/);
});

test('findChange tells an active change from an archived one', () => {
  const root = mkdtempSync(join(tmpdir(), 'relevo-change-'));
  assert.equal(findChange(root, '31').state, 'missing');
  mkdirSync(join(root, 'openspec/changes/archive/2026-10-23-31-summary'), { recursive: true });
  assert.deepEqual(findChange(root, '31'), { name: '31-summary', state: 'archived' });
  mkdirSync(join(root, 'openspec/changes/31-summary'), { recursive: true });
  mkdirSync(join(root, 'openspec/changes/310-other'), { recursive: true });
  assert.deepEqual(findChange(root, '31'), { name: '31-summary', state: 'active' });
});

// ---------- the whole run

test('Scenario: Approved issue shipped by label - archive, merge, close, labels cleared, queue told', async () => {
  const s = setup();
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  const head = s.branchHead();
  assert.notEqual(head, s.approved, 'the archive commit was pushed');
  assert.equal(gitIn(s.root, '--git-dir', s.origin, 'log', '-1', '--format=%s', head), 'chore(openspec): archive 31-summary (#31)');
  const files = gitIn(s.root, '--git-dir', s.origin, 'diff', '--name-only', `${s.approved}..${head}`).split('\n');
  assert.ok(files.every((f) => f.startsWith('openspec/')), files.join(','));
  assert.equal(s.state.merged, head, 'merged at the checked head');
  const merge = s.state.pushCalls.find((a) => a[0] === 'pr' && a[1] === 'merge');
  assert.deepEqual(merge.slice(0, 3), ['pr', 'merge', '40']);
  assert.ok(merge.includes('--squash') && merge.includes('--delete-branch'));
  assert.equal(merge[merge.indexOf('--body') + 1], 'Issue #31');
  assert.equal(s.state.issueState, 'CLOSED');
  assert.deepEqual(s.state.labels, []);
  assert.deepEqual(s.state.dispatched, ['relevo-queue.yml']);
  assert.match(s.state.comments.at(-1), /#31 shipped/);
  assert.match(s.state.comments.at(-1), /checks of the approved head/);
});

test('Scenario: Label applied by an automation - nothing shipped, the label removed', async () => {
  const s = setup();
  const out = await runUnattendedShip(s.ctx({ actorType: 'Bot' }));
  assert.equal(out.outcome, 'ignored');
  assert.equal(s.branchHead(), s.approved);
  assert.deepEqual(s.state.labels, ['relevo:pr-open']);
  assert.deepEqual(s.state.comments, []);
});

test('Scenario: Label on an issue that is not ready - the comment names the missing command', async () => {
  const s = setup({ labels: ['relevo:built', 'relevo:ship'] });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments[0], /run \/relevo:review 31 first/);
  assert.deepEqual(s.state.labels, ['relevo:built']);
  assert.equal(s.branchHead(), s.approved, 'nothing was archived');
});

test('Scenario: Approval on older code - stops, keeps pr-open, asks for a new approval', async () => {
  const s = setup({ reviews: [{ author: { login: 'persona-c' }, state: 'APPROVED', submittedAt: '2026-10-14T10:00:00Z', commit: { oid: '0000000000' } }] });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments[0], /a new approval is needed on the current code/);
  assert.deepEqual(s.state.labels, ['relevo:pr-open']);
  assert.equal(s.state.merged, null);
});

test('Scenario: The pull request changes the team - eligibility comes from the base branch', async () => {
  const s = setup({ branchConfig: RELEVO_YML.replace('persona-c]', 'persona-c, persona-x]') });
  const out = await runUnattendedShip(s.ctx({ actor: 'persona-x' }));
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments[0], /persona-x is not listed in team.members/);
});

test('Scenario: No CI configured in an unattended ship - the run stops before archiving', async () => {
  const s = setup({ approvedChecks: [] });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.kind, 'ship_no_ci');
  assert.equal(s.branchHead(), s.approved);
  assert.match(s.state.comments[0], /review.ship_without_ci: true/);
});

test('Scenario: No CI accepted for unattended ships - merged, and the comment says nothing vouched for it', async () => {
  const yml = `${RELEVO_YML}review:\n  ship_without_ci: true\n`;
  const s = setup({ approvedChecks: [], baseConfig: yml });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.match(s.state.comments.at(-1), /No check ran on this code/);
});

test('Scenario: Private repository on a free plan - no rules available, the run reaches the merge', async () => {
  const s = setup({ planRefusal: true });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.equal(s.state.issueState, 'CLOSED');
});

test('Scenario: Unexpected error with a message - the label is removed, the reason is commented and nothing is merged', async () => {
  const s = setup({ rulesError: 'gh: Resource not accessible by integration (HTTP 403)' });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.state.merged, null);
  assert.equal(s.branchHead(), s.approved, 'nothing was archived');
  assert.match(s.state.comments[0], /Resource not accessible by integration/);
  assert.ok(s.state.edits.length > 0, 'the label was removed');
});

test('Scenario: Required checks without an App - stops before archiving and names the secrets', async () => {
  const s = setup({ requiredChecks: true });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.kind, 'ship_needs_app');
  assert.equal(s.branchHead(), s.approved);
  assert.match(s.state.comments[0], /RELEVO_SHIP_APP_ID and RELEVO_SHIP_APP_KEY/);
});

test('Scenario: Classic protection that requires checks - read with the workflow token, and without an App it stops', async () => {
  const s = setup({ classicChecks: ['build'] });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.kind, 'ship_needs_app', JSON.stringify(out));
  assert.equal(s.branchHead(), s.approved, 'nothing was archived');
  assert.equal(s.state.merged, null);
});

test('Scenario: Required checks and an App - waits for the checks of the archive commit, then merges', async () => {
  let calls = 0;
  const s = setup({
    requiredChecks: true,
    archiveChecks: () => {
      calls += 1;
      return calls < 3 ? [{ __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null }] : GOOD;
    },
  });
  const out = await runUnattendedShip(s.ctx({ hasApp: true }));
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.ok(calls >= 3, 'it polled until the checks completed');
  assert.deepEqual(s.state.dispatched, [], 'with the App the close starts the queue by itself');
  assert.doesNotMatch(s.state.comments.at(-1), /checks of the approved head/);
});

test('Scenario: Checks time out - stops without merging, and the label again resumes from the merge', async () => {
  const running = [{ __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null }];
  let done = false;
  const s = setup({ requiredChecks: true, archiveChecks: () => (done ? GOOD : running) });
  const first = await runUnattendedShip(s.ctx({ hasApp: true }));
  assert.equal(first.outcome, 'stopped');
  assert.match(s.state.comments[0], /did not finish within 30 minutes/);
  assert.equal(s.state.merged, null);
  const archived = s.branchHead();

  done = true;
  s.state.labels.push('relevo:ship');
  const second = await runUnattendedShip(s.ctx({ hasApp: true }));
  assert.equal(second.outcome, 'merged', JSON.stringify(second));
  assert.equal(s.branchHead(), archived, 'the archive was not made twice');
  assert.equal(s.state.merged, archived);
});

test('Scenario: Checks ran on the archive commit - a failing one stops the merge', async () => {
  const s = setup({ archiveChecks: () => [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' }] });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments.at(-1), /checks are failing: test/);
  assert.equal(s.state.merged, null);
});

test('Scenario: Invalid specification - stops before archiving and shows the failure', async () => {
  const s = setup({ invalid: true });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments[0], /Change 31-summary has issues/);
  assert.equal(s.branchHead(), s.approved);
});

test('Scenario: Merge refused - GitHub\'s reason is reported and nothing is retried', async () => {
  const s = setup({ refuseMerge: 'Required status check "test" is expected' });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments.at(-1), /GitHub refused the merge: Required status check/);
  assert.equal(s.state.pushCalls.filter((a) => a[1] === 'merge').length, 1);
  assert.equal(s.state.issueState, 'OPEN');
});

test('Scenario: Conflict in code - the archive is undone and the run stops naming the files', async () => {
  const s = setup({ mergeable: (st) => (st.polls > 1 ? 'CONFLICTING' : 'MERGEABLE') });
  // The base branch changes the same code line after the approval.
  gitIn(s.seed, 'switch', '--detach', 'origin/dev');
  gitIn(s.seed, 'fetch', 'origin');
  gitIn(s.seed, 'switch', '-c', 'dev-change', 'origin/dev');
  write(s.seed, 'lib/main.dart', 'void main() { print(2); }\n');
  gitIn(s.seed, 'commit', '-am', 'change on dev');
  gitIn(s.seed, 'push', 'origin', 'HEAD:refs/heads/dev');
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped');
  assert.match(s.state.comments.at(-1), /conflicts in code/);
  assert.match(s.state.comments.at(-1), /lib\/main.dart/);
  assert.equal(s.state.merged, null);
});

test('the script runs no hook of the repository', async () => {
  const s = setup();
  mkdirSync(join(s.work, '.git/hooks'), { recursive: true });
  const marker = join(s.root, 'hook-ran');
  writeFileSync(join(s.work, '.git/hooks/pre-commit'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
  writeFileSync(join(s.work, '.git/hooks/pre-push'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged');
  assert.throws(() => readFileSync(marker));
});

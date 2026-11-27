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
const fixture = (path) => readFileSync(join(PLUGIN_ROOT, 'tests/fixtures/delta-check', path), 'utf8');
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
  if (opts.mainSpec) write(seed, 'openspec/specs/summary/spec.md', opts.mainSpec);
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
  if (opts.delta) write(seed, 'openspec/changes/31-summary/specs/summary/spec.md', opts.delta);
  if (opts.branchConfig) write(seed, 'relevo.yml', opts.branchConfig);
  gitIn(seed, 'add', '.');
  gitIn(seed, 'commit', '-m', 'feat: summary (#31)');
  gitIn(seed, 'push', 'origin', 'HEAD:refs/heads/feature/31-summary');
  const approved = gitIn(seed, 'rev-parse', 'HEAD');
  const work = join(root, 'work');
  gitIn(root, 'clone', origin, work);
  gitIn(work, 'config', 'user.name', 'relevo');
  gitIn(work, 'config', 'user.email', 'relevo@example.com');

  const state = { labels: opts.labels ?? ['relevo:pr-open', 'relevo:ship'], issueState: 'OPEN', merged: null, comments: [], edits: [], dispatched: [], pushCalls: [], polls: 0, clock: 0, mergeAttempts: 0 };
  const branchHead = () => {
    try {
      return gitIn(root, '--git-dir', origin, 'rev-parse', 'refs/heads/feature/31-summary');
    } catch {
      return null;
    }
  };
  const rollupOf = (oid) => (oid === approved ? (typeof opts.approvedChecks === 'function' ? opts.approvedChecks(state) : opts.approvedChecks ?? GOOD) : opts.archiveChecks?.(state) ?? []);
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
      state.mergeAttempts += 1;
      if (state.mergeAttempts <= (opts.movedBaseTimes ?? 0)) throw Object.assign(new Error('merge refused'), { stderr: 'GraphQL: Base branch was modified. Review and try the merge again. (mergePullRequest)' });
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
    sh, gh, pushGh, sleep: async (ms) => { clock += ms; state.clock = clock; }, now: () => clock, headPollMs: 1, ...over,
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
  const note = s.state.comments.at(-1);
  assert.ok(note.includes(`approved head ${s.approved.slice(0, 7)}`), 'names the approved head whose checks were relied on');
  assert.ok(note.includes(`merged commit ${head.slice(0, 7)}`), 'names the merged commit');
  assert.match(note, /no checks of its own when it was merged/);
});

test('Scenario: Mergeability unknown at first, computed a moment later - waits, keeps the label, merges', async () => {
  const seen = [];
  const s = setup({
    mergeable: (st) => {
      if (st.polls < 4) {
        seen.push([...st.labels]);
        return 'UNKNOWN';
      }
      return 'MERGEABLE';
    },
  });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.ok(seen.length >= 2, 'it read the pull request again while the state was unknown');
  assert.ok(seen.every((labels) => labels.includes('relevo:ship')), 'the label stayed while it waited');
  assert.equal(s.state.merged, s.branchHead());
});

test('Scenario: Mergeability never computed - nothing merged, label removed, the comment says it never settled', async () => {
  const s = setup({ mergeable: () => 'UNKNOWN' });
  const out = await runUnattendedShip(s.ctx({ mergeableTries: 3 }));
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.state.merged, null);
  assert.ok(!s.state.labels.includes('relevo:ship'), 'the label was removed');
  assert.match(s.state.comments.at(-1), /never settled/);
  assert.match(s.state.comments.at(-1), /apply the label again to retry/i);
  assert.equal(s.branchHead(), s.approved, 'nothing was archived');
});

test('Scenario: Conflicting pull request - it does not wait for the state and stops as before', async () => {
  const s = setup({ mergeable: () => 'CONFLICTING' });
  let slept = 0;
  const out = await runUnattendedShip(s.ctx({ sleep: async () => { slept += 1; } }));
  assert.equal(out.outcome, 'stopped');
  assert.equal(slept, 0, 'no wait for a settled state');
  assert.match(s.state.comments.at(-1), /has conflicts/);
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
  assert.ok(s.state.comments.at(-1).includes(`checks of the merged commit ${s.branchHead().slice(0, 7)}`), 'names the merged head');
  assert.match(s.state.comments.at(-1), /had finished and passed when it was merged/);
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

// ---------- waiting for the checks of the approved head

const RUNNING = [{ __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null }];
const FAILED = [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' }];

test('Scenario: Checks finish while the run waits - the label stays and the run merges', async () => {
  const seen = [];
  const s = setup({
    approvedChecks: (st) => {
      if (st.polls < 4) {
        seen.push([...st.labels]);
        return RUNNING;
      }
      return GOOD;
    },
  });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.ok(seen.length >= 2, 'it read the pull request again while the checks were running');
  assert.ok(seen.every((labels) => labels.includes('relevo:ship')), 'the label stayed while it waited');
  assert.equal(s.state.merged, s.branchHead());
});

test('Scenario: A check fails while the run waits - it stops and names the check', async () => {
  const s = setup({ approvedChecks: (st) => (st.polls < 3 ? RUNNING : FAILED) });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.match(s.state.comments.at(-1), /checks are failing: test/);
  assert.equal(s.state.merged, null);
  assert.ok(!s.state.labels.includes('relevo:ship'), 'the label was removed');
});

test('Scenario: Another reason to stop besides the running checks - it does not wait and gives every reason', async () => {
  const s = setup({ approvedChecks: RUNNING, mergeable: () => 'CONFLICTING' });
  let slept = 0;
  const out = await runUnattendedShip(s.ctx({ sleep: async () => { slept += 1; } }));
  assert.equal(out.outcome, 'stopped');
  assert.equal(slept, 0, 'no wait for checks that cannot help');
  assert.match(s.state.comments.at(-1), /has conflicts/);
  assert.match(s.state.comments.at(-1), /checks are still running: test/);
});

test('Scenario: Checks that never finish - the run stops, names them and says that the label again retries', async () => {
  const s = setup({ approvedChecks: RUNNING });
  const out = await runUnattendedShip(s.ctx({ waitLimitMs: 5 * 60 * 1000 }));
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.state.merged, null);
  assert.ok(!s.state.labels.includes('relevo:ship'), 'the label was removed');
  assert.match(s.state.comments.at(-1), /checks are still running: test/);
  assert.match(s.state.comments.at(-1), /5 minutes/);
  assert.match(s.state.comments.at(-1), /apply the label again to retry/i);
  assert.equal(s.branchHead(), s.approved, 'nothing was archived');
});

test('Scenario: Long waits add up - the wait after the archive ends with the shared limit', async () => {
  const s = setup({
    requiredChecks: true,
    approvedChecks: (st) => (st.clock < 10 * 60 * 1000 ? RUNNING : GOOD),
    archiveChecks: () => RUNNING,
  });
  const out = await runUnattendedShip(s.ctx({ hasApp: true, waitLimitMs: 15 * 60 * 1000 }));
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.match(s.state.comments.at(-1), /did not finish within 15 minutes/);
  assert.ok(s.state.clock < 16 * 60 * 1000, `the waits shared one limit, but the clock reached ${s.state.clock / 60000} minutes`);
});

// ---------- a merge refused because the base branch moved

test('Scenario: Another pull request entered the base a moment before - the second attempt merges', async () => {
  const s = setup({ movedBaseTimes: 1 });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
  assert.equal(s.state.mergeAttempts, 2);
  assert.equal(s.state.merged, s.branchHead());
  assert.equal(s.state.issueState, 'CLOSED');
});

test('Scenario: The base change conflicts with the pull request - the second reading stops with the conflict', async () => {
  const s = setup({ movedBaseTimes: 1, mergeable: (st) => (st.mergeAttempts >= 1 ? 'CONFLICTING' : 'MERGEABLE') });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.state.mergeAttempts, 1, 'no second attempt on a conflicting pull request');
  assert.match(s.state.comments.at(-1), /has conflicts/);
  assert.equal(s.state.merged, null);
  assert.ok(!s.state.labels.includes('relevo:ship'));
});

test('Scenario: The second merge is also refused - it stops with GitHub\'s message and never tries a third time', async () => {
  const s = setup({ movedBaseTimes: 5 });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.state.mergeAttempts, 2);
  assert.match(s.state.comments.at(-1), /GitHub refused the merge again: GraphQL: Base branch was modified/);
  assert.match(s.state.comments.at(-1), /apply the label again to retry/i);
  assert.ok(!s.state.labels.includes('relevo:ship'));
  assert.equal(s.state.issueState, 'OPEN');
});

test('Scenario: Any other refusal of the merge is not retried', async () => {
  const s = setup({ refuseMerge: 'Resource not accessible by integration (HTTP 403)' });
  await runUnattendedShip(s.ctx());
  assert.equal(s.state.mergeAttempts, 1);
  assert.doesNotMatch(s.state.comments.at(-1), /apply the label again to retry/i);
});

// ---------- the delta must fit the base before anything is archived

test('Scenario: Clash found in an unattended ship - stops before archiving and says that the label again does not help', async () => {
  const s = setup({ mainSpec: fixture('added-exists-other-text/main.md'), delta: fixture('added-exists-other-text/delta.md') });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'stopped', JSON.stringify(out));
  assert.equal(s.branchHead(), s.approved, 'nothing was archived or pushed');
  assert.equal(s.state.merged, null);
  assert.equal(s.state.pushCalls.length, 0);
  assert.ok(!s.state.labels.includes('relevo:ship'), 'the label was removed');
  const comment = s.state.comments.at(-1);
  assert.match(comment, /summary: ADDED "Alpha" already exists/);
  assert.match(comment, /\/relevo:fix 31/);
  assert.match(comment, /applying the label again does not help until the specification is corrected/i);
  assert.doesNotMatch(comment, /apply the label again to retry/i);
});

test('Scenario: No clash - a delta that fits is archived as before', async () => {
  const s = setup({ mainSpec: fixture('added-new/main.md'), delta: fixture('added-new/delta.md') });
  const out = await runUnattendedShip(s.ctx());
  assert.equal(out.outcome, 'merged', JSON.stringify(out));
});

test('a change already archived by an earlier run is not checked again', async () => {
  // The first run archives and stops on the checks of the archive commit; the second finds the change archived, whose
  // delta now sits in the main specification and would clash with itself.
  const running = [{ __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null }];
  let done = false;
  const s = setup({ requiredChecks: true, mainSpec: fixture('added-new/main.md'), delta: fixture('added-new/delta.md'), archiveChecks: () => (done ? GOOD : running) });
  assert.equal((await runUnattendedShip(s.ctx({ hasApp: true }))).outcome, 'stopped');
  done = true;
  s.state.labels.push('relevo:ship');
  const second = await runUnattendedShip(s.ctx({ hasApp: true }));
  assert.equal(second.outcome, 'merged', JSON.stringify(second));
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

test('Scenario: A ship that ended without an outcome and without the catalog - the fallback says to apply the label again, in both languages', () => {
  const workflow = readFileSync(new URL('../templates/workflows/relevo-ship.yml', import.meta.url), 'utf8');
  const step = workflow.split('- name: Report a run that ended without an outcome')[1];
  const script = /run: \|\n((?: {10}.*\n|\n)+)/.exec(step)[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
  [[null, /was not shipped.*When the cause is fixed, apply relevo:ship again\./], ['es', /no se fusionó.*Cuando la causa esté resuelta, vuelve a poner relevo:ship\./]].forEach(([language, expected]) => {
    const dir = mkdtempSync(join(tmpdir(), 'ship-fallback-'));
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'work'));
    writeFileSync(join(dir, 'work', 'relevo.yml'), language ? `language: ${language}\n` : 'tracker: github\n');
    // `gh issue view` answers with the ship label; the body of the comment is kept in a file.
    writeFileSync(join(dir, 'bin', 'gh'), '#!/bin/sh\n[ "$2" = view ] && echo relevo:ship\n[ "$2" = comment ] && printf %s "$5" > "$OUT"\nexit 0\n', { mode: 0o755 });
    const r = spawnSync('bash', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, RUNNER_TEMP: dir, ISSUE: '42', ACTOR: 'ana', RUN_URL: 'https://example.test/run/9', OUT: join(dir, 'body') } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(join(dir, 'body'), 'utf8'), expected);
  });
});

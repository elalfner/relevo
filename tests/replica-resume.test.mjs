import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskGroups } from '../scripts/lib/task-groups.mjs';

// A replicated build that is cut and resumed (#167): the groups are numbered again on resume, so the template checkpoint is
// found by the tasks it covers, not by the number of its group.
const script = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const HASH = 'e'.repeat(64);
const DECISION = { issue: 7, branch: 'feature/7-x', base: 'dev', change_id: '7-x', path: '.', allow_paths: [], issue_hash: HASH };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'relevo-resume-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'dev', origin);
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'dev');
  git(work, 'config', 'user.email', 'a@b');
  git(work, 'config', 'user.name', 't');
  put(work, 'README.md', 'base\n');
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'base');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', '-b', 'feature/7-x');
  return work;
}
// What the skill runs after a group: the checkpoint with the number of the group and the tasks the group holds.
const checkpoint = (work, group, of) => {
  const args = [script('checkpoint.mjs'), '--decision', Buffer.from(JSON.stringify(DECISION)).toString('base64'), '--k', String(group.k), '--of', String(of)];
  if (group.tasks) args.push('--tasks', group.tasks.join(','));
  const r = spawnSync(process.execPath, args, { cwd: work, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const template = (work, ...args) => {
  const r = spawnSync(process.execPath, [script('replica-plan.mjs'), 'template', '--issue', '7', '--base', 'dev', ...args], { cwd: work, encoding: 'utf8' });
  return { status: r.status, out: r.stdout ? JSON.parse(r.stdout) : null };
};

const TASKS = (done) => `## Replication recipe

- Template: \`section 1\`

## 1. Orders screen

- [${done >= 1 ? 'x' : ' '}] 1.1 build it
- [${done >= 1 ? 'x' : ' '}] 1.2 test it

## 2. Docs

- [${done >= 2 ? 'x' : ' '}] 2.1 docs
- [${done >= 2 ? 'x' : ' '}] 2.2 more docs

## 3. Replicas

- [ ] 3.1 [replica] Invoices
  - Rename: Orders -> Invoices
  - Differences: none
- [ ] 3.2 [replica] Refunds
  - Rename: Orders -> Refunds
  - Differences: none
`;

test('Scenario: A resumed build finds the template - the first run had four groups, the resumed run lists two', () => {
  const work = fixture();
  const first = taskGroups(TASKS(0));
  assert.equal(first.groups.length, 4);
  put(work, 'src/Orders.vue', 'orders\n');
  checkpoint(work, { k: 1, tasks: first.groups[0].tasks }, 4);
  put(work, 'docs/orders.md', 'docs\n');
  checkpoint(work, { k: 2, tasks: first.groups[1].tasks }, 4);

  // The run is cut and resumed: sections 1 and 2 are done, so the groups are numbered again from 1.
  const resumed = taskGroups(TASKS(2));
  assert.deepEqual(resumed.groups.map((g) => g.tasks), [['3.1'], ['3.2']]);

  const found = template(work, '--section', '1');
  assert.equal(found.status, 0, JSON.stringify(found.out));
  assert.deepEqual(found.out.files, ['src/Orders.vue']);
  // By the number of the resumed run it is not there (the defect), which is why the lookup is by section.
  assert.equal(template(work, '--k', '1', '--of', String(resumed.groups.length)).status, 1);
});

test('Scenario: The numbers repeat - the checkpoints of the resumed run do not get mixed with the template', () => {
  const work = fixture();
  put(work, 'src/Orders.vue', 'orders\n');
  checkpoint(work, { k: 1, tasks: ['1.1', '1.2'] }, 3);
  put(work, 'src/Invoices.vue', 'invoices\n');
  // The resumed run has three groups again and its first checkpoint is `1/3` once more.
  checkpoint(work, { k: 1, tasks: ['3.1'] }, 3);
  const found = template(work, '--section', '1');
  assert.deepEqual([found.status, found.out.files], [0, ['src/Orders.vue']]);
  assert.deepEqual(template(work, '--section', '3').out.files, ['src/Invoices.vue']);
});

test('Scenario: A checkpoint with no marker - the lookup says so and exits 1', () => {
  const work = fixture();
  put(work, 'src/Orders.vue', 'orders\n');
  checkpoint(work, { k: 1 }, 3); // made without --tasks, as before this change
  const found = template(work, '--section', '1');
  assert.equal(found.status, 1);
  assert.match(found.out.detail, /names a task of section 1/);
  assert.equal(template(work, '--k', '1', '--of', '3').status, 0, 'the lookup by numbers still works for a caller that has them');
});

test('Scenario: A task list that is not task numbers - no trailer is written and the checkpoint is made', () => {
  const work = fixture();
  put(work, 'src/Orders.vue', 'orders\n');
  const out = checkpoint(work, { k: 1, tasks: ['x y', '1.1; rm -rf', '../1.1'] }, 3);
  assert.equal(out.state, 'kept');
  assert.doesNotMatch(git(work, 'log', '-1', '--format=%B'), /Relevo-Tasks/);
});

test('the trailer sits beside the hash, the hash is still read, and the resume check is unchanged', async () => {
  const { issueHashOf, tasksOf, withTasks, withIssueHash, cleanTaskIds } = await import('../scripts/lib/wip-commit.mjs');
  const { resumeState } = await import('../scripts/lib/resume-check.mjs');
  const message = withTasks(withIssueHash('wip: checkpoint 1/4 (#7)', HASH), ['1.1', '1.2', '1.1']);
  assert.equal(message, `wip: checkpoint 1/4 (#7)\n\nIssue-hash: ${HASH}\nRelevo-Tasks: 1.1, 1.2`);
  assert.equal(issueHashOf(message), HASH);
  assert.deepEqual(tasksOf(message), ['1.1', '1.2']);
  assert.equal(withTasks('subject', []), 'subject');
  assert.deepEqual(cleanTaskIds('2.1, junk, 10.12'), ['2.1', '10.12']);
  // The resume check reads the subject and the hash only.
  const log = `${'a'.repeat(40)}\x1fwip: checkpoint 1/4 (#7)\x1f${message.split('\n\n').slice(1).join('\n\n')}\n\x1e`;
  const git2 = (args) => (args[0] === 'log' ? log : '');
  assert.equal(resumeState({ git: git2, base: 'dev', branch: 'feature/7-x', issue: 7, issueHash: HASH }).state, 'resume');
});

test('the scans still refuse a checkpoint that names tasks (C2: a protected path)', () => {
  const work = fixture();
  put(work, '.github/workflows/x.yml', 'on: push\n');
  const r = spawnSync(process.execPath, [script('checkpoint.mjs'), '--decision', Buffer.from(JSON.stringify(DECISION)).toString('base64'), '--k', '1', '--of', '2', '--tasks', '1.1'], { cwd: work, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).state, 'unsafe');
  assert.equal(git(work, 'log', '--oneline', 'origin/dev..HEAD').trim(), '');
});

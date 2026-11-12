import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { checkRecipe, parseRename, replicaModel } from '../scripts/lib/replica-plan.mjs';
import { checkpointSubject } from '../scripts/lib/wip-commit.mjs';

const CLI = new URL('../scripts/replica-plan.mjs', import.meta.url).pathname;
const cfg = (yaml = '') => {
  const r = loadConfig(`limits:\n  run_max_cost: 5\n${yaml}`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.config;
};
const AUTO_DEV = 'agents:\n  dev:\n    model: auto\n';

const RECIPE = (template = '`section 1`', replicaBody = '  - Rename: Orders -> Invoices, orders -> invoices\n  - Differences: a total column') => `## 1. Template

- [ ] 1.1 build the orders screen

## Replication recipe

- Template: ${template}

## 2. Replicas

- [ ] 2.1 [replica] Invoices screen
${replicaBody}
- [ ] 2.2 [replica] Payments screen
  - Rename: Orders -> Payments
  - Differences: none
`;

test('Scenario: A complete recipe - the check passes and lists the replica tasks', () => {
  const r = checkRecipe(RECIPE());
  assert.deepEqual([r.ok, r.replicated, r.problems], [true, true, []]);
  assert.deepEqual(r.template, { kind: 'section', section: '1' });
  assert.deepEqual(r.replicas.map((x) => x.id), ['2.1', '2.2']);
  assert.deepEqual(r.replicas[0].rename, [{ from: 'Orders', to: 'Invoices' }, { from: 'orders', to: 'invoices' }]);
  assert.equal(r.replicas[1].differences, 'none');
});

test('Scenario: A marked task - an unmarked task is not a replica, and a plain tasks.md is not a replicated build', () => {
  const plain = checkRecipe('## 1. A\n\n- [ ] 1.1 something like the orders screen\n');
  assert.deepEqual([plain.ok, plain.replicated, plain.replicas], [true, false, []]);
});

test('Scenario: The differences are not listed - the check names the task', () => {
  const r = checkRecipe(RECIPE('`section 1`', '  - Rename: Orders -> Invoices'));
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /task 2\.1 has no Differences:/);
  assert.match(checkRecipe(RECIPE('`section 1`', '  - Differences: x')).problems.join(), /task 2\.1 has no Rename:/);
  assert.match(checkRecipe(RECIPE('`section 1`', '  - Rename: Orders to Invoices\n  - Differences: x')).problems.join(), /not "old -> new"/);
});

test('Scenario: The template cannot exist - pattern without a Pattern: line, a missing, replica or later section', () => {
  assert.match(checkRecipe(RECIPE('`pattern`')).problems.join(), /no valid "Pattern: #N" line/);
  assert.equal(checkRecipe(RECIPE('`pattern`'), { hasPattern: true }).ok, true);
  assert.match(checkRecipe(RECIPE('`section 9`')).problems.join(), /section 9, which tasks\.md does not have/);
  assert.match(checkRecipe(RECIPE('`section 2`')).problems.join(), /holds replica tasks/);
  const later = RECIPE('`section 3`') + '\n## 3. Docs\n\n- [ ] 3.1 docs\n';
  assert.match(checkRecipe(later).problems.join(), /comes after the first replica/);
  assert.match(checkRecipe(RECIPE('whatever it is')).problems.join(), /is not "section K"/);
});

test('a template of paths, a recipe with no template and a recipe with no replica', () => {
  assert.deepEqual(checkRecipe(RECIPE('`src/a.vue`, `tests/a.test.ts`')).template, { kind: 'paths', paths: ['src/a.vue', 'tests/a.test.ts'] });
  const noTemplate = RECIPE().replace('- Template: `section 1`\n', '');
  assert.match(checkRecipe(noTemplate).problems.join(), /no "- Template:" line/);
  assert.match(checkRecipe('## Replication recipe\n\n- Template: `section 1`\n\n## 1. A\n\n- [ ] 1.1 x\n').problems.join(), /no \[replica\] task/);
});

test('a checked replica is kept out of the list but still counts for the structure', () => {
  const r = checkRecipe(RECIPE().replace('- [ ] 2.1 [replica]', '- [x] 2.1 [replica]'));
  assert.deepEqual(r.replicas.map((x) => x.id), ['2.2']);
});

test('parseRename accepts arrows and backticks', () => {
  assert.deepEqual(parseRename('`A` → `B`; c -> d').pairs, [{ from: 'A', to: 'B' }, { from: 'c', to: 'd' }]);
  assert.deepEqual(parseRename('nothing here').bad, ['nothing here']);
});

test('Scenario: The first launch - one name below the planned model, never below the floor', () => {
  const c = cfg(AUTO_DEV);
  assert.deepEqual(c.agents.ladder, ['haiku', 'sonnet', 'opus']);
  const r = replicaModel({ config: c, devModel: 'sonnet', failures: 0 });
  assert.equal(r.model, 'haiku');
  assert.equal(replicaModel({ config: c, devModel: 'opus', failures: 0 }).model, 'sonnet');
  const floored = cfg(`${AUTO_DEV}    floor: sonnet\n`);
  assert.equal(replicaModel({ config: floored, devModel: 'opus', failures: 1 }).model, 'sonnet');
  assert.equal(replicaModel({ config: floored, devModel: 'sonnet', failures: 0 }).model, 'sonnet');
});

test('Scenario: Two failures - the planned model builds it, and a third asks for an escalation', () => {
  const c = cfg(AUTO_DEV);
  const two = replicaModel({ config: c, devModel: 'sonnet', failures: 2 });
  assert.deepEqual([two.model, two.escalate], ['sonnet', false]);
  const three = replicaModel({ config: c, devModel: 'sonnet', failures: 3 });
  assert.deepEqual([three.model, three.escalate], ['sonnet', true]);
});

test('Scenario: Already at the floor - the reason says nothing is saved', () => {
  const r = replicaModel({ config: cfg(AUTO_DEV), devModel: 'haiku', failures: 0 });
  assert.equal(r.model, 'haiku');
  assert.match(r.why, /saves nothing/);
});

test('Scenario: The developer is set in the configuration - every replica keeps that name', () => {
  const c = cfg('agents:\n  dev:\n    model: opus\n');
  [0, 1, 2, 3].forEach((failures) => assert.equal(replicaModel({ config: c, devModel: 'opus', failures }).model, 'opus'));
});

test('a model that is not in the ladder is kept', () => {
  assert.equal(replicaModel({ config: cfg(AUTO_DEV), devModel: 'mystery', failures: 0 }).model, 'mystery');
});

function cli(args, cwd) {
  const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8', cwd });
  return { status: r.status, out: r.stdout ? JSON.parse(r.stdout) : null, err: r.stderr };
}

test('the check command exits 1 on a wrong recipe and reads Pattern: from the issue file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rp-'));
  writeFileSync(join(dir, 'tasks.md'), RECIPE('`pattern`'));
  writeFileSync(join(dir, 'issue.md'), 'Pattern: #4\n');
  writeFileSync(join(dir, 'none.md'), 'nothing\n');
  assert.equal(cli(['check', '--tasks', join(dir, 'tasks.md'), '--issue-file', join(dir, 'issue.md')]).status, 0);
  const bad = cli(['check', '--tasks', join(dir, 'tasks.md'), '--issue-file', join(dir, 'none.md')]);
  assert.equal(bad.status, 1);
  assert.equal(bad.out.ok, false);
  assert.equal(cli(['check']).status, 2);
});

test('the model command keeps the given model when the configuration is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rp-'));
  const r = cli(['model', '--dev-model', 'sonnet', '--failures', '0', '--config', join(dir, 'relevo.yml')]);
  assert.deepEqual([r.status, r.out.model], [0, 'sonnet']);
  writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\n${AUTO_DEV}`);
  assert.equal(cli(['model', '--dev-model', 'sonnet', '--failures', '0', '--config', join(dir, 'relevo.yml')]).out.model, 'haiku');
});

test('the template command lists the files of the checkpoint, without the specification', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rp-git-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(dir, 'base.txt'), 'b');
  git('add', '.');
  git('commit', '-qm', 'base');
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'openspec'));
  writeFileSync(join(dir, 'src/a.vue'), 'a');
  writeFileSync(join(dir, 'openspec/tasks.md'), 't');
  git('add', '.');
  git('commit', '-qm', checkpointSubject(7, 1, 3));
  writeFileSync(join(dir, 'src/b.vue'), 'b');
  git('add', '.');
  git('commit', '-qm', checkpointSubject(7, 2, 3));
  const r = cli(['template', '--k', '1', '--of', '3', '--issue', '7'], dir);
  assert.deepEqual([r.status, r.out.files], [0, ['src/a.vue']]);
  assert.equal(cli(['template', '--k', '3', '--of', '3', '--issue', '7'], dir).status, 1);
});

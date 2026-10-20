import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SIZE_BUDGET_BYTES, folderHash, hasScripts, lockDifferences, reservedForPerson, resolveRoleSkills, resolveSkill, skillBudget } from '../scripts/lib/role-skills.mjs';

const CLI = new URL('../scripts/role-skills.mjs', import.meta.url).pathname;
const PLUGIN_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
const put = (dir, name, text) => {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), text);
};
const SKILL = (extra = '') => `---\nname: s\ndescription: d\n${extra}---\nBody\n`;

/** A repository whose `origin/dev` holds the skills of the base branch; the working tree may hold more. */
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-skills-'));
  git(dir, 'init', '-q', '-b', 'dev');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  Object.entries(files).forEach(([n, t]) => put(dir, n, t));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  return dir;
}
const runner = (dir) => (args) => git(dir, ...args);
const one = (dir, name, extra = {}) => resolveSkill({ name, git: runner(dir), baseRef: 'origin/dev', ...extra });

test('Scenario: Skill for the developer - a skill on the base branch gives the path of its SKILL.md', () => {
  const dir = repo({ '.agents/skills/laravel-best-practices/SKILL.md': SKILL() });
  assert.deepEqual(one(dir, 'laravel-best-practices'), { name: 'laravel-best-practices', path: '.agents/skills/laravel-best-practices/SKILL.md', scripts: false });
});

test('Scenario: Skill added by the branch - in the working tree but not on the base branch is left out', () => {
  const dir = repo({ 'README.md': 'x' });
  put(dir, '.agents/skills/mine/SKILL.md', SKILL());
  assert.deepEqual(one(dir, 'mine'), { name: 'mine', left_out: true, reason: 'not on the base branch' });
});

test('Scenario: Skill reserved for the person - disable-model-invocation leaves it out', () => {
  const dir = repo({ '.agents/skills/grill-with-docs/SKILL.md': SKILL('disable-model-invocation: true\n') });
  assert.equal(one(dir, 'grill-with-docs').reason, 'reserved for the person');
  assert.equal(reservedForPerson(SKILL()), false);
  assert.equal(reservedForPerson(SKILL('disable-model-invocation: false\n')), false);
});

test('Scenario: Skill with scripts - left out, and used when skills.allow_scripts names it', () => {
  const dir = repo({ '.agents/skills/risky/SKILL.md': SKILL(), '.agents/skills/risky/scripts/run.sh': 'echo hi\n', '.agents/skills/plain/SKILL.md': SKILL(), '.agents/skills/plain/notes.md': 'n' });
  assert.equal(one(dir, 'risky').reason, 'has scripts and is not allowed');
  assert.deepEqual(one(dir, 'risky', { allowScripts: ['risky'] }), { name: 'risky', path: '.agents/skills/risky/SKILL.md', scripts: true });
  assert.equal(one(dir, 'plain').scripts, false, 'documents are not scripts');
});

test('scripts are recognised by folder and by extension', () => {
  assert.equal(hasScripts(['SKILL.md', 'scripts/a.txt']), true);
  assert.equal(hasScripts(['SKILL.md', 'helper.py']), true);
  assert.equal(hasScripts(['SKILL.md', 'rules/a.md', 'agents/openai.yaml']), false);
});

test('a link to a folder is followed through the folder it points to; a link alone is left out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-skills-'));
  git(dir, 'init', '-q', '-b', 'dev');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'T');
  put(dir, '.agents/skills/real/SKILL.md', SKILL());
  mkdirSync(join(dir, '.claude/skills'), { recursive: true });
  symlinkSync('../../.agents/skills/real', join(dir, '.claude/skills/real'));
  symlinkSync('/etc', join(dir, '.claude/skills/outside'));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/dev', 'HEAD');
  assert.equal(one(dir, 'real').path, '.agents/skills/real/SKILL.md');
  assert.equal(one(dir, 'outside').reason, 'is a link to a folder that is not on the base branch');
});

test('invalid names and folders without SKILL.md are left out', () => {
  const dir = repo({ '.agents/skills/empty/README.md': 'x' });
  assert.equal(one(dir, '../etc').reason, 'invalid name');
  assert.equal(one(dir, 'empty').reason, 'no SKILL.md on the base branch');
});

test('roles: fix uses the lists of dev and qa, each skill once; an unknown role is an error', () => {
  const dir = repo({ '.agents/skills/a/SKILL.md': SKILL(), '.agents/skills/b/SKILL.md': SKILL() });
  const profile = { skills: { dev: ['a', 'b'], qa: ['b'], issue: [], review: [] } };
  const names = (role) => resolveRoleSkills({ role, profile, git: runner(dir), baseRef: 'origin/dev' }).map((s) => s.name);
  assert.deepEqual(names('fix'), ['a', 'b']);
  assert.deepEqual(names('qa'), ['b']);
  assert.deepEqual(names('issue'), []);
  assert.throws(() => names('boss'), /unknown role "boss"/);
});

test('Scenario: Large skill set - 30 KB is over the budget, 10 KB is not', () => {
  assert.equal(SIZE_BUDGET_BYTES, 20480);
  assert.deepEqual(skillBudget([10 * 1024, 20 * 1024]), { bytes: 30720, over: true });
  assert.equal(skillBudget([10 * 1024]).over, false);
  assert.equal(skillBudget([]).over, false);
});

test('the folder hash is the one the skills installer writes: path then content, sorted without regard to case', () => {
  const files = [{ path: 'SKILL.md', content: 'S' }, { path: 'agents/openai.yaml', content: 'Y' }, { path: 'ADR-FORMAT.md', content: 'A' }];
  const expected = ['ADR-FORMAT.md', 'agents/openai.yaml', 'SKILL.md'];
  assert.equal(folderHash(files), folderHash([...files].reverse()));
  assert.equal(folderHash(files), folderHash(expected.map((p) => files.find((f) => f.path === p))));
  assert.notEqual(folderHash(files), folderHash([{ path: 'SKILL.md', content: 'S2' }, ...files.slice(1)]));
});

test('Scenario: Altered skill - a changed folder is named; a missing lock file or folder gives no difference', () => {
  const lock = { version: 1, skills: { a: { computedHash: 'h1' }, b: { computedHash: 'h2' }, c: { computedHash: 'h3' } } };
  assert.deepEqual(lockDifferences(lock, { a: 'h1', b: 'other', c: null }), ['b']);
  assert.deepEqual(lockDifferences(null, { a: 'h1' }), []);
  assert.deepEqual(lockDifferences({}, { a: 'h1' }), []);
});

// ---------- the command

const CONFIG = 'limits:\n  run_max_cost: 5\nplatforms:\n  web:\n    stack: vue\n    path: apps/web\nskills:\n  allow_scripts: [with-scripts]\n';
const VUE = (skills) => `---\nstack: vue\ncommands:\n  analyze: vue-tsc\n  test: vitest\nskills:\n  dev: [${skills}]\n---\n`;

test('the command lists each skill with its path or the reason it was left out', () => {
  const dir = repo({
    'relevo.yml': CONFIG,
    '.relevo/stacks/vue.md': VUE('good, with-scripts, missing'),
    '.agents/skills/good/SKILL.md': SKILL(),
    '.agents/skills/with-scripts/SKILL.md': SKILL(),
    '.agents/skills/with-scripts/scripts/x.sh': 'x',
  });
  const r = spawnSync('node', [CLI, '--role', 'dev', '--platform', 'web'], { encoding: 'utf8', cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.base, 'origin/dev');
  assert.deepEqual(out.skills.map((s) => s.left_out ?? s.path), ['.agents/skills/good/SKILL.md', '.agents/skills/with-scripts/SKILL.md', true]);
  assert.equal(out.skills[2].reason, 'not on the base branch');
});

test('the command exits 2 without a role or with a platform it does not know, and 1 without a profile', () => {
  const dir = repo({ 'relevo.yml': CONFIG });
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8', cwd: dir }).status, 2);
  assert.equal(spawnSync('node', [CLI, '--role', 'dev', '--platform', 'zzz'], { encoding: 'utf8', cwd: dir }).status, 2);
  const cobol = repo({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: cobol\n' });
  const none = spawnSync('node', [CLI, '--role', 'dev'], { encoding: 'utf8', cwd: cobol });
  assert.equal(none.status, 1, 'the plugin ships no cobol profile and the repository defines none');
  assert.match(none.stderr, /no profile for stack "cobol"/);
  assert.ok(PLUGIN_ROOT);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchReferences } from '../scripts/lib/design-fetch.mjs';
import { intentToAdd } from '../scripts/lib/intent-to-add.mjs';
import { guardPath, projectList } from '../scripts/lib/guarded-fs.mjs';
import { RestrictedPathError, checkRestricted, filterRestricted, restrictedInDiff, unquoteGit } from '../scripts/lib/restricted-paths.mjs';
import { parse as parseYaml } from '../scripts/lib/yaml-lite.mjs';

const script = (name) => new URL(`../scripts/${name}`, import.meta.url).pathname;
// A value that no real secret has: if it ever shows in an output, a script read a restricted file.
const CANARY = 'canary-value-must-never-appear-0123456789';
const CONFIG = 'limits:\n  run_max_cost: 5\nrestricted_paths:\n  - infra/prod.tfvars\n';

function folder() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-restricted-scripts-'));
  writeFileSync(join(dir, 'relevo.yml'), CONFIG);
  writeFileSync(join(dir, '.env'), `API_KEY=${CANARY}\n`);
  mkdirSync(join(dir, 'infra'));
  writeFileSync(join(dir, 'infra', 'prod.tfvars'), `password = "${CANARY}"\n`);
  writeFileSync(join(dir, '.env.example'), 'API_KEY=\n');
  return dir;
}

// Every script that reads a path it was given, with that path set to a restricted file.
const CASES = [
  ['add-corrections.mjs', ['.env', 'a task']],
  ['can-edit-issue.mjs', ['--input', '.env']],
  ['check-issue.mjs', ['--title', 'A title', '--body-file', '.env']],
  ['design-fetch.mjs', ['--body-file', '.env']],
  ['digest.mjs', ['--input', '.env']],
  ['fix-tasks.mjs', ['--file', '.env', '--stage', 'before']],
  ['go-plan.mjs', ['--input', '.env']],
  ['issue-coverage.mjs', ['--agreement', '.env', '--issue', '.env']],
  ['issue-hash.mjs', ['--input', '.env', '--expect', 'x']],
  ['issue-sections.mjs', ['--body-file', '.env', '--list']],
  ['platform-of.mjs', ['--input', '.env']],
  ['render-message.mjs', ['built', '--config', '.env']],
  ['requeue.mjs', ['--input', '.env']],
  ['review-brief.mjs', ['--issue', '1', '--title', 'T', '--body-file', '.env']],
  ['review-sla.mjs', ['--input', '.env']],
  ['run-usage.mjs', ['--file', '.env']],
  ['ship-check.mjs', ['--input', '.env', '--invoker', 'a']],
  ['spec-ready.mjs', ['--input', '.env']],
  ['status.mjs', ['--input', '.env']],
  ['usage-limit.mjs', ['--file', '.env']],
  ['validate-config.mjs', ['.env']],
];

for (const [name, args] of CASES) {
  test(`Scenario: A script is handed an environment file - ${name} refuses it, names the path and prints nothing of it`, () => {
    const dir = folder();
    const r = spawnSync(process.execPath, [script(name), ...args], { cwd: dir, encoding: 'utf8', input: '' });
    assert.equal(r.status, 2, `${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /\.env is a restricted file/);
    assert.ok(!`${r.stdout}${r.stderr}`.includes(CANARY), 'the content never reaches an output');
  });
}

test('a path of restricted_paths in relevo.yml is refused too, by an absolute path inside the folder', () => {
  const dir = folder();
  const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', join(dir, 'infra', 'prod.tfvars'), '--list'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /infra\/prod\.tfvars is a restricted file/);
  assert.ok(!r.stderr.includes(CANARY));
});

test('the example file is read as before', () => {
  const dir = folder();
  const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', '.env.example', '--list'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(r.status, 2, r.stderr);
  assert.doesNotMatch(r.stderr, /restricted/);
});

test('guardPath lets a file descriptor and an ordinary path through and refuses a restricted one before it is opened', () => {
  assert.doesNotThrow(() => guardPath(0));
  assert.doesNotThrow(() => guardPath('docs/readme.md', '/nowhere'));
  assert.throws(() => guardPath('api/.env.production', '/nowhere'), RestrictedPathError);
  assert.throws(() => guardPath('/work/repo/config/server.key', '/work/repo'), (e) => e.path === 'config/server.key');
  assert.ok(projectList('/nowhere').includes('.env'));
});

test('Scenario: A capture of the working folder - intent-to-add leaves a restricted file out and says that it did', () => {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (args[0] === 'check-ignore') throw new Error('not ignored');
    return '';
  };
  const r = intentToAdd({ git, exists: () => true, paths: ['lib/a.dart', '.env', 'k/server.pem', '.env.example'] });
  assert.deepEqual(r.marked, ['lib/a.dart', '.env.example']);
  assert.deepEqual(r.restricted, ['.env', 'k/server.pem']);
  assert.deepEqual(calls.find((c) => c[0] === 'add'), ['add', '--intent-to-add', '--', 'lib/a.dart', '.env.example']);
  const dir = folder();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  const out = spawnSync(process.execPath, [script('intent-to-add.mjs'), 'a.txt', 'infra/prod.tfvars'], { cwd: dir, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /marked 1 file\(s\) for the diff/);
  assert.match(out.stdout, /left out 1 restricted file \(infra\/prod\.tfvars\)/);
});

test('Scenario: A design reference to a restricted file is refused by name, with no read and no download', async () => {
  const touched = [];
  const r = await fetchReferences({
    references: [{ kind: 'path', target: '.env', path: '.env' }, { kind: 'repo-file', target: 'acme/api:keys/server.pem', repo: 'acme/api', path: 'keys/server.pem' }, { kind: 'path', target: 'docs/a.md', path: 'docs/a.md' }],
    links: ['acme/api'],
    exists: (p) => { touched.push(p); return true; },
    gh: () => { throw new Error('no call expected'); },
    ghRaw: () => { throw new Error('no call expected'); },
  });
  assert.deepEqual(r.files.map((f) => f.reference), ['docs/a.md']);
  assert.deepEqual(r.refused.map((x) => x.reference), ['.env', 'acme/api:keys/server.pem']);
  assert.ok(r.refused.every((x) => /restricted file/.test(x.reason)));
  assert.deepEqual(touched, ['docs/a.md']);
});

test('Scenario: A restricted file in the text a script is about to publish - scan-diff names it and prints nothing of its lines', () => {
  const diff = `diff --git a/config/private.pem b/config/private.pem\nnew file mode 100644\n--- /dev/null\n+++ b/config/private.pem\n@@ -0,0 +1 @@\n+-----BEGIN PRIVATE KEY-----${CANARY}\n`;
  assert.deepEqual(restrictedInDiff(diff), [{ path: 'config/private.pem', rule: '*.pem' }]);
  assert.deepEqual(restrictedInDiff('diff --git a/lib/a.dart b/lib/a.dart\n+++ b/lib/a.dart\n+x\n'), []);
  const r = spawnSync(process.execPath, [script('scan-diff.mjs')], { cwd: folder(), encoding: 'utf8', input: diff });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /config\/private\.pem {2}restricted file in the diff/);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(CANARY));
  const clean = spawnSync(process.execPath, [script('scan-diff.mjs')], { cwd: folder(), encoding: 'utf8', input: 'diff --git a/a b/a\n+++ b/a\n@@ -0,0 +1 @@\n+ok\n' });
  assert.equal(clean.status, 0);
});

// ---------- an invalid relevo.yml, and paths that are not written in their plain form

import { restrictedListFromText, isRestricted } from '../scripts/lib/restricted-paths.mjs';

test('Scenario: A relevo.yml that does not validate still restricts what it lists - restricted_paths is read from the text', () => {
  // No limits.run_max_cost, so the file as a whole is invalid.
  const text = 'restricted_paths:\n  - infra/prod.tfvars\n  - /etc/passwd\n  - "!.env"\n  - ../outside\n  - "*.secret"\nplatforms:\n  web:\n    stack: vue\n    path: apps/web\n';
  const list = restrictedListFromText(text);
  assert.ok(isRestricted('infra/prod.tfvars', list) && isRestricted('x/a.secret', list) && isRestricted('apps/web/secrets/k', list));
  assert.ok(isRestricted('.env', list), 'the base list stays');
  assert.ok(!list.includes('/etc/passwd') && !list.includes('!.env') && !list.includes('../outside'), 'only the entries that are not allowed are dropped');
  assert.deepEqual(restrictedListFromText('limits: [unclosed'), restrictedListFromText(''), 'text with no restricted_paths leaves the base list');
  assert.deepEqual(restrictedListFromText(null), restrictedListFromText(''));
  const dir = folder();
  writeFileSync(join(dir, 'relevo.yml'), 'restricted_paths:\n  - infra/prod.tfvars\n');
  const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', 'infra/prod.tfvars', '--list'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /infra\/prod\.tfvars is a restricted file/);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(CANARY));
});

test('the other scripts that read the list use the same helper, so an invalid relevo.yml does not open them either', () => {
  const dir = folder();
  writeFileSync(join(dir, 'relevo.yml'), 'restricted_paths:\n  - infra/prod.tfvars\n');
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 'a@b');
  git('config', 'user.name', 't');
  const commit = spawnSync(process.execPath, [script('commit-change.mjs'), '--message', 'm', '--', 'infra/prod.tfvars'], { cwd: dir, encoding: 'utf8' });
  assert.equal(commit.status, 1);
  assert.match(commit.stderr, /infra\/prod\.tfvars {2}restricted file in the diff/);
  git('add', '-f', 'infra/prod.tfvars');
  git('commit', '-qm', 'x');
  const check = spawnSync(process.execPath, [script('restricted-check.mjs')], { cwd: dir, encoding: 'utf8' });
  assert.equal(check.status, 1);
  assert.match(check.stderr, /infra\/prod\.tfvars {2}restricted file in the diff/);
  const settings = spawnSync(process.execPath, [script('restricted-settings.mjs')], { cwd: dir, encoding: 'utf8' });
  assert.equal(settings.status, 0, settings.stderr);
  assert.ok(JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).permissions.deny.includes('Read(./infra/prod.tfvars)'));
});

test('Scenario: A path that is not written plainly is the same name - four forms of a project entry and a basename pattern are refused', () => {
  const dir = folder();
  const name = dir.split('/').pop();
  const forms = ['infra/./prod.tfvars', 'infra//prod.tfvars', 'infra/../infra/prod.tfvars', `../${name}/infra/prod.tfvars`, `${dir}/infra/../infra/prod.tfvars`, './infra/prod.tfvars'];
  forms.forEach((form) => {
    const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', form, '--list'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 2, `${form}: ${r.stderr}`);
    assert.match(r.stderr, /infra\/prod\.tfvars is a restricted file/, form);
    assert.ok(!r.stderr.includes(CANARY));
  });
  ['./.env', 'sub/../.env', `../${name}/.env`, 'infra/../.env'].forEach((form) => {
    const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', form, '--list'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 2, form);
    assert.match(r.stderr, /\.env is a restricted file/, form);
  });
  assert.doesNotThrow(() => guardPath('infra/./README.md', dir));
  assert.throws(() => guardPath('infra/./prod.tfvars', dir), (e) => e.path === 'infra/prod.tfvars');
  assert.throws(() => guardPath('/somewhere/else/server.pem', dir), RestrictedPathError, 'outside the folder only the name can be judged');
});

test('a symbolic link to a restricted file is not followed: the check is by name', () => {
  const dir = folder();
  symlinkSync(join(dir, '.env'), join(dir, 'harmless.txt'));
  const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', 'harmless.txt', '--list'], { cwd: dir, encoding: 'utf8' });
  assert.doesNotMatch(r.stderr, /restricted file/, 'the name is not on the list, and the link is not followed');
});

test('Scenario: Added line that looks like a header - "++ x" in the content of a file is not read as the path of a file', () => {
  const diff = 'diff --git a/lib/a.dart b/lib/a.dart\n--- a/lib/a.dart\n+++ b/lib/a.dart\n@@ -0,0 +1,2 @@\n+++ b/config/private.pem\n+x\n';
  assert.deepEqual(restrictedInDiff(diff), [], 'the line is content (it starts with +, then ++ b/...)');
  const real = 'diff --git a/config/private.pem b/config/private.pem\n--- a/config/private.pem\n+++ b/config/private.pem\n@@ -1 +1 @@\n-a\n+b\n';
  assert.deepEqual(restrictedInDiff(real), [{ path: 'config/private.pem', rule: '*.pem' }]);
  assert.deepEqual(restrictedInDiff('--- /dev/null\n+++ b/k/server.key\n@@ -0,0 +1 @@\n+x\n'), [{ path: 'k/server.key', rule: '*.key' }], 'a diff with no diff --git line');
});

const parserRejects = (text) => assert.throws(() => parseYaml(text), 'the fixture must be a construct the lite parser rejects');

test('Scenario: A file the parser rejects still restricts what it lists - the entries are read from the lines of restricted_paths', () => {
  const inline = 'restricted_paths: [infra/prod.tfvars, "*.secret", /etc/passwd]\nrunner: {labels: [a]}\n';
  parserRejects(inline);
  const list = restrictedListFromText(inline);
  assert.ok(isRestricted('infra/prod.tfvars', list) && isRestricted('a/b.secret', list));
  assert.ok(!list.includes('/etc/passwd'), 'the same validation drops the entries that are not allowed');
  const block = '# my settings\nrestricted_paths:\n  # the state\n  - infra/prod.tfvars   # prod\n  - "!.env"\n  - \'*.secret\'\nrunner: {labels: [a]}\n';
  parserRejects(block);
  const listed = restrictedListFromText(block);
  assert.ok(isRestricted('infra/prod.tfvars', listed) && isRestricted('x.secret', listed));
  assert.ok(!listed.includes('!.env'));
  const dir = folder();
  writeFileSync(join(dir, 'relevo.yml'), inline);
  const r = spawnSync(process.execPath, [script('issue-sections.mjs'), '--body-file', 'infra/prod.tfvars', '--list'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /infra\/prod\.tfvars is a restricted file/);
});

test('Scenario: Every spelling of a path is one name - the matcher and each caller judge infra/./prod.tfvars and infra//prod.tfvars like infra/prod.tfvars', () => {
  const list = restrictedListFromText('restricted_paths:\n  - infra/prod.tfvars\n');
  ['infra/./prod.tfvars', 'infra//prod.tfvars', 'infra/x/../prod.tfvars', './infra/prod.tfvars', 'infra\\prod.tfvars'].forEach((p) => assert.ok(isRestricted(p, list), p));
  assert.ok(isRestricted('x/../secrets/a.txt') && isRestricted('secrets//a.txt') && isRestricted('secrets/./a.txt'));
  assert.ok(!isRestricted('docs/secrets/a.txt') && !isRestricted('a//b.md'));
  assert.ok(isRestricted('../x/.env') && isRestricted('../../k/server.pem'), 'a path that climbs out is judged by its name');
  assert.ok(!isRestricted('../x/readme.md'));
  assert.deepEqual(filterRestricted(['ok.txt', 'infra//prod.tfvars', '.env'], list), { kept: ['ok.txt'], left: ['infra//prod.tfvars', '.env'] });
  assert.deepEqual(checkRestricted(['infra/./prod.tfvars']).violations, [], 'without the entry it is an ordinary file');
  assert.equal(checkRestricted(['infra/./prod.tfvars'], list).violations[0].path, 'infra/prod.tfvars');
  // intent-to-add
  const marked = intentToAdd({ git: (a) => { if (a[0] === 'check-ignore') throw new Error('no'); return ''; }, exists: () => true, paths: ['infra/./prod.tfvars', 'infra//prod.tfvars', 'ok.txt', '.env'], list });
  assert.deepEqual(marked.marked, ['ok.txt']);
  assert.deepEqual(marked.restricted, ['infra/./prod.tfvars', 'infra//prod.tfvars', '.env']);
  const dir = folder();
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nrestricted_paths:\n  - infra/prod.tfvars\n');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'ok.txt'), 'a\n');
  const out = spawnSync(process.execPath, [script('intent-to-add.mjs'), 'infra/./prod.tfvars', 'infra//prod.tfvars', 'ok.txt', '.env'], { cwd: dir, encoding: 'utf8' });
  assert.match(out.stdout, /marked 1 file\(s\)/);
  assert.match(out.stdout, /left out 3 restricted files/);
});

test('design-fetch refuses a reference to a restricted file written with //, /./ or ..', async () => {
  const list = restrictedListFromText('restricted_paths:\n  - infra/prod.tfvars\n');
  const r = await fetchReferences({
    references: ['infra//prod.tfvars', 'infra/./prod.tfvars', 'x/../.env'].map((p) => ({ kind: 'path', target: p, path: p })),
    exists: () => { throw new Error('no read expected'); },
    restricted: list,
  });
  assert.deepEqual(r.files, []);
  assert.equal(r.refused.length, 3);
  assert.ok(r.refused.every((x) => /restricted file/.test(x.reason)));
});

test('Scenario: Git quotes a name - scan-diff exits 1 for an added clé.pem and prints nothing of its lines', () => {
  const diff = `diff --git "a/cl\\303\\251.pem" "b/cl\\303\\251.pem"\nnew file mode 100644\n--- /dev/null\n+++ "b/cl\\303\\251.pem"\n@@ -0,0 +1 @@\n+${CANARY}\n`;
  assert.deepEqual(restrictedInDiff(diff), [{ path: 'clé.pem', rule: '*.pem' }]);
  const r = spawnSync(process.execPath, [script('scan-diff.mjs')], { cwd: folder(), encoding: 'utf8', input: diff });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /clé\.pem {2}restricted file in the diff/);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(CANARY));
  const headerOnly = 'diff --git a/x.txt "b/t\\303\\251.key"\n--- a/x.txt\n+++ "b/t\\303\\251.key"\n';
  assert.equal(restrictedInDiff(headerOnly)[0].path, 'té.key', 'only one side quoted');
  assert.equal(unquoteGit('a\\tb\\"c\\\\d'), 'a\tb"c\\d');
  assert.deepEqual(restrictedInDiff('diff --git "a/plain dir/ok.txt" "b/plain dir/ok.txt"\n'), []);
});

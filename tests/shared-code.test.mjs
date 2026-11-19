import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importsOf, pathRule, resolveImport, sharedFiles, sharedLine } from '../scripts/lib/shared-code.mjs';

const CLI = new URL('../scripts/shared-code.mjs', import.meta.url).pathname;

function repo(base, branch) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-sc-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  const put = (files) => Object.entries(files).forEach(([p, c]) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); });
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  put(base);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'feature');
  put(branch);
  git('add', '-A');
  git('commit', '-q', '-m', 'work');
  return { dir, run: (...extra) => { const r = spawnSync('node', [CLI, '--repo-root', dir, ...extra], { encoding: 'utf8' }); return { ...r, json: JSON.parse(r.stdout || 'null') }; } };
}

const imp = (path) => `<script setup>\nimport Table from '${path}';\n</script>\n`;

test('Scenario: A modified component used by two screens - listed as modified, used by two files', () => {
  const { run } = repo(
    { 'src/components/Table.vue': '<template/>', 'src/views/A.vue': imp('@/components/Table.vue'), 'src/views/B.vue': imp('../components/Table'), 'src/views/C.vue': '<template/>' },
    { 'src/components/Table.vue': '<template><table/></template>' },
  );
  const r = run('--base', 'dev');
  assert.equal(r.status, 0);
  assert.deepEqual(r.json.shared.map((s) => [s.path, s.status, s.why, s.importers]), [['src/components/Table.vue', 'modified', 'in a shared folder (components/), used by 2 files', ['src/views/A.vue', 'src/views/B.vue']]]);
  assert.equal(r.json.line, 'src/components/Table.vue (modified, in a shared folder (components/), used by 2 files)');
});

test('Scenario: A new component in a shared folder - listed as added by the path rule before anything imports it', () => {
  const { run } = repo({ 'src/views/A.vue': '<template/>' }, { 'src/components/Badge.vue': '<template/>' });
  assert.deepEqual(run('--base', 'dev').json.shared.map((s) => [s.path, s.status, s.why]), [['src/components/Badge.vue', 'added', 'in a shared folder (components/)']]);
});

test('Scenario: A new component of one screen - not listed; two importers make it shared even outside a shared folder', () => {
  const one = repo({ 'src/views/orders/List.vue': '<template/>' }, { 'src/views/orders/Row.vue': '<template/>', 'src/views/orders/List.vue': imp('./Row.vue') });
  assert.deepEqual(one.run('--base', 'dev').json.shared, []);
  const two = repo({ 'src/views/orders/List.vue': '<template/>', 'src/views/users/List.vue': '<template/>' }, { 'src/views/orders/Row.vue': '<template/>', 'src/views/orders/List.vue': imp('./Row.vue'), 'src/views/users/List.vue': imp('../orders/Row.vue') });
  assert.deepEqual(two.run('--base', 'dev').json.shared.map((s) => [s.path, s.why]), [['src/views/orders/Row.vue', 'used by 2 files']]);
});

test('a components folder inside a feature is the code of that feature, not a shared folder', () => {
  const { run } = repo({ 'src/views/orders/List.vue': '<template/>' }, { 'src/views/orders/components/Row.vue': '<template/>' });
  assert.deepEqual(run('--base', 'dev').json.shared, []);
});

test('Scenario: Tests and documents - not listed, and a test that imports a file does not make it shared', () => {
  const { run } = repo(
    { 'src/lib/util.ts': 'export const a = 1;\n', 'src/views/A.ts': "import { a } from '../lib/util';\n", 'src/views/A.test.ts': "import { a } from '../lib/util';\n" },
    { 'src/lib/util.ts': 'export const a = 2;\n', 'src/components/Badge.test.ts': 'x', 'docs/components/guide.md': 'x', 'openspec/changes/x/design.md': 'x' },
  );
  assert.deepEqual(run('--base', 'dev').json.shared, [], 'one importer plus a test is one importer');
});

test('Dart: relative and package imports count, and the widgets of a feature folder are not a shared folder', () => {
  const { run } = repo(
    { 'lib/shared/button.dart': 'class B {}\n', 'lib/features/a/a.dart': "import 'package:app/shared/button.dart';\n", 'lib/features/b/b.dart': "import '../../shared/button.dart';\n" },
    { 'lib/shared/button.dart': 'class B { int x = 1; }\n', 'lib/features/a/widgets/row.dart': 'class R {}\n' },
  );
  assert.deepEqual(run('--base', 'dev').json.shared.map((s) => [s.path, s.why]), [['lib/shared/button.dart', 'in a shared folder (shared/), used by 2 files']]);
});

test('a barrel file counts as one importer and a language with no reader gets the path rule and a note', () => {
  const { run } = repo({ 'src/ui/index.ts': "export * from './Btn';\n", 'src/ui/Btn.ts': 'export const B = 1;\n' }, { 'app/Services/x.php': '<?php\n', 'app/shared/Money.php': '<?php\n' });
  const r = run('--base', 'dev').json;
  assert.deepEqual(r.shared.map((s) => s.path), ['app/shared/Money.php']);
  assert.match(r.notes.join(' '), /import graph is not read for \.php files/);
});

test('Scenario: The diff cannot be read - notes say so, nothing is listed, exit 0', () => {
  const { run } = repo({ 'a.txt': 'x' }, { 'b.txt': 'y' });
  const r = run('--base', 'nope');
  assert.equal(r.status, 0);
  assert.deepEqual([r.json.shared, r.json.line], [[], '']);
  assert.match(r.json.notes[0], /base branch nope could not be resolved/);
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
});

test('--shared adds a folder of the project, and an origin/<base> is preferred over a local one', () => {
  const { run } = repo({ 'src/kit/a.ts': 'x\n' }, { 'src/kit/a.ts': 'y\n' });
  assert.deepEqual(run('--base', 'dev').json.shared, []);
  assert.deepEqual(run('--base', 'dev', '--shared', 'src/kit/**').json.shared.map((s) => s.path), ['src/kit/a.ts']);
});

test('the pieces: imports, resolution, path rule and line', () => {
  assert.deepEqual(importsOf('a.ts', "import a from './a';\nimport './b';\nexport { c } from \"../c\";\nconst d = require('./d');\nconst e = await import('./e');\n").sort(), ['../c', './a', './b', './d', './e']);
  assert.deepEqual(importsOf('a.dart', "import 'package:x/y.dart';\nexport 'z.dart';\n// import 'no.dart';\n").sort(), ['package:x/y.dart', 'z.dart']);
  const files = new Set(['web/src/components/T.vue', 'web/src/views/A.vue', 'web/src/utils/index.ts']);
  assert.equal(resolveImport('web/src/views/A.vue', '@/components/T.vue', files), 'web/src/components/T.vue');
  assert.equal(resolveImport('web/src/views/A.vue', '../utils', files), 'web/src/utils/index.ts');
  assert.equal(resolveImport('web/src/views/A.vue', 'vue', files), null);
  assert.equal(pathRule('web/src/components/T.vue'), 'components/');
  assert.equal(pathRule('src/views/x/components/T.vue'), null);
  assert.equal(sharedLine([]), '');
  assert.deepEqual(sharedFiles({ changed: [], files: [], read: () => null }), { shared: [], notes: [] });
});

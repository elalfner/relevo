import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/design-fetch.mjs', import.meta.url).pathname;
const ISSUE = 'https://github.com/user-attachments/assets/0a1b2c3d-1111-2222-3333-444455556666';

/** A repository with relevo.yml, a picture, and a fake `gh` that answers the contents API of a linked repository. */
function repo({ config = '', body }) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-df-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\n${config}`);
  mkdirSync(join(dir, 'design'));
  writeFileSync(join(dir, 'design', 'home.png'), 'x');
  writeFileSync(join(dir, 'issue.md'), body);
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const text = '<template><div class="card"/></template>';
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\necho '{"type":"file","size":${text.length},"encoding":"base64","content":"${Buffer.from(text).toString('base64')}"}'\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  const run = (...args) => spawnSync('node', [CLI, '--body-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', join(dir, 'relevo.yml'), '--out', join(dir, '.relevo-design'), ...args], {
    encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  return { dir, run, manifest: () => JSON.parse(readFileSync(join(dir, '.relevo-design', 'manifest.json'), 'utf8')) };
}
const section = (refs) => `## Summary\n\nx\n\n## Design reference\n\n${refs}\n`;

test('an issue without the section needs nothing', () => {
  const r = repo({ body: '## Summary\n\nx\n' }).run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no Design reference/);
});

test('Scenario: Reference in the repository - a file that exists is available where it is, nothing is copied', () => {
  const t = repo({ body: section('- `design/home.png`: the layout') });
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /available: design\/home\.png -> design\/home\.png/);
  assert.deepEqual(t.manifest().files.map((f) => [f.kind, f.file]), [['path', 'design/home.png']]);
  assert.deepEqual(t.manifest().refused, []);
});

test('a missing file is refused with its reason and the exit code is 1', () => {
  const t = repo({ body: section('- `design/missing.png`: the layout') });
  const r = t.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused: design\/missing\.png: the file does not exist in the repository/);
  assert.equal(t.manifest().refused.length, 1);
});

test('Scenario: Images turned off - an attachment is refused and says how to fix it', () => {
  const t = repo({ body: section(`- ${ISSUE}: the empty state`) });
  const r = t.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /design\.images is off: turn it on in relevo\.yml, or commit the picture to the repository/);
});

test('an attachment outside the domains is refused even with design.images on', () => {
  const t = repo({ config: 'design:\n  images: true\n', body: section('- https://evil.example.com/a.png: the empty state') });
  const r = t.run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not a GitHub attachment/);
});

test('a file of a linked repository is read through gh and saved apart from the repository files', () => {
  const t = repo({ config: 'links: [acme/design]\n', body: section('- `acme/design:components/Card.vue`: the card') });
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  const entry = t.manifest().files[0];
  assert.equal(entry.kind, 'repo-file');
  assert.equal(readFileSync(entry.file, 'utf8'), '<template><div class="card"/></template>');
  assert.match(entry.file, /01-Card\.vue$/);
});

test('a repository that is not linked is refused', () => {
  const r = repo({ body: section('- `acme/design:components/Card.vue`: the card') }).run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /acme\/design is not in links of relevo\.yml/);
});

test('a malformed bullet is reported as a problem and the exit code is 1', () => {
  const r = repo({ body: section('- make it look nice') }).run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused: Design reference: .*is not a reference/);
});

test('Scenario: Downloaded files and git - the folder is excluded locally, once, and no git add can include it', () => {
  const t = repo({ config: 'links: [acme/design]\n', body: section('- `acme/design:components/Card.vue`: the card') });
  t.run();
  t.run();
  const exclude = readFileSync(join(t.dir, '.git', 'info', 'exclude'), 'utf8');
  assert.equal(exclude.split('\n').filter((l) => l === '/.relevo-design/').length, 1);
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: t.dir, encoding: 'utf8' }).includes('.relevo-design'), false);
  const add = spawnSync('git', ['add', '.relevo-design'], { cwd: t.dir, encoding: 'utf8' });
  assert.notEqual(add.status, 0, 'git refuses to add an excluded folder');
  assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: t.dir, encoding: 'utf8' }).trim(), '');
});

test('bad arguments exit 2, and an invalid relevo.yml is reported', () => {
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
  const t = repo({ config: 'design:\n  images: maybe\n', body: section('- `design/home.png`: x') });
  const r = t.run();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /design\.images/);
  assert.ok(existsSync(t.dir));
});

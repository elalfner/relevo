import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// What an installation holds: the files list of the package decides it, so a test compares it with what npm would
// publish and with the paths the plugin reads at run time. A file read from outside the list would work in this
// repository and fail on every other machine.
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const pkg = JSON.parse(read('package.json'));

function packed() {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
  return JSON.parse(out)[0].files.map((f) => f.path);
}

test('the package is public, scoped and named like the marketplace entry', () => {
  assert.equal(pkg.name, '@elalfner/relevo');
  assert.ok(!pkg.private, 'a private package cannot be published');
  assert.equal(pkg.publishConfig.access, 'public');
  const market = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(market.plugins[0].source.package, pkg.name);
  assert.equal(market.plugins[0].source.source, 'npm');
  assert.ok(!('version' in market.plugins[0].source), 'the entry follows the latest published version');
});

test('the package holds what runs and nothing else', () => {
  const files = packed();
  const allowed = [/^\.claude-plugin\/plugin\.json$/, /^(scripts|skills|agents|stacks|templates)\//, /^(LICENSE|NOTICE|package\.json|README(\.es)?\.md)$/];
  const stray = files.filter((f) => !allowed.some((re) => re.test(f)));
  assert.deepEqual(stray, [], 'these files would be installed on every machine');
  ['docs/', 'tests/', 'openspec/', 'CHANGELOG.md', 'TRADEMARKS.md', 'CLAUDE.md', '.claude-plugin/marketplace.json'].forEach((p) => {
    assert.ok(!files.some((f) => f === p || f.startsWith(p)), `${p} must not be installed`);
  });
  assert.ok(files.includes('.claude-plugin/plugin.json'));
  assert.ok(files.includes('scripts/cli.mjs'));
});

test('the command line is part of the package and is executable by node', () => {
  assert.equal(pkg.bin.relevo, 'scripts/cli.mjs');
  assert.ok(existsSync(`${root}scripts/cli.mjs`));
  assert.match(read('scripts/cli.mjs'), /^#!\/usr\/bin\/env node\n/);
});

test('no skill, agent or script reads a path that the package does not hold', () => {
  const shipped = new Set(packed());
  const inPackage = (p) => shipped.has(p) || [...shipped].some((f) => f.startsWith(`${p.replace(/\/$/, '')}/`));
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  const sources = [...walk('skills'), ...walk('agents'), ...walk('scripts')].filter((f) => /\.(md|mjs)$/.test(f));
  sources.forEach((f) => {
    const text = read(f);
    [...text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)].forEach((m) => {
      const path = m[1].replace(/[.,;:)]+$/, '');
      assert.ok(inPackage(path), `${f} reads ${path}, which is not in the package`);
    });
    [...text.matchAll(/\bPLUGIN_ROOT\b[^\n]*?['"`]\.\.\/(docs|tests|openspec)\b/g)].forEach(() => assert.fail(`${f} reads outside the plugin`));
  });
});

test('the package version, the manifest and the changelog agree', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(pkg.version, plugin.version);
  const latest = /^## \[(\d+\.\d+\.\d+)\]/m.exec(read('CHANGELOG.md'));
  assert.equal(pkg.version, latest[1]);
});

test('the files list names only things that exist', () => {
  pkg.files.forEach((f) => assert.ok(existsSync(`${root}${f}`), `${f} is in "files" but missing`));
  const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((n, e) => n + size(join(p, e)), 0) : statSync(p).size);
  const total = pkg.files.reduce((n, f) => n + size(join(root, f)), 0);
  assert.ok(total < 2 * 1024 * 1024, `the package would be ${total} bytes; keep it lean`);
});

test('a tag publishes the package only when the tag is its version, the tests pass and the token exists', () => {
  const text = read('.github/workflows/release.yml');
  assert.match(text, /tags: \['v\*'\]/);
  assert.match(text, /"\$TAG" != "v\$version"/);
  assert.ok(text.indexOf('npm test') < text.indexOf('npm publish'), 'tests run before publishing');
  assert.match(text, /npm publish --provenance --access public/);
  assert.match(text, /secrets\.NPM_TOKEN/);
  assert.doesNotMatch(text, /npm_[A-Za-z0-9]{20,}/, 'no token in the file');
});

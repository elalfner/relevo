import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The version in the plugin manifest, the changelog and the git tag of a release must agree (task 8.4).
const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const changelog = read('CHANGELOG.md');
const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm)];

test('the changelog lists releases with a semantic version and an ISO date, newest first', () => {
  assert.ok(versions.length >= 1);
  const cmp = (a, b) => a.split('.').map(Number).reduce((r, n, i) => r || n - Number(b.split('.')[i]), 0);
  versions.slice(1).forEach((v, i) => assert.ok(cmp(versions[i][1], v[1]) > 0, `${versions[i][1]} must come before ${v[1]}`));
  versions.forEach((v) => assert.ok(!Number.isNaN(Date.parse(v[2])), `${v[1]} has a valid date`));
});

test('a fixed version in plugin.json is the latest release of the changelog', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  if (plugin.version === undefined) return; // development: the commit is the version
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.equal(plugin.version, versions[0][1], 'bump the changelog together with the manifest');
});

test('package.json and the manifest do not disagree about the version', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const pkg = JSON.parse(read('package.json'));
  if (plugin.version !== undefined) assert.equal(pkg.version, plugin.version);
});

test('each release lists what was added and what is known not to work yet', () => {
  const first = changelog.split(/^## \[/m).slice(1).find((section) => /^\d/.test(section)); // an [Unreleased] section is not a release yet
  assert.match(first, /### Added/);
  assert.match(first, /### Known limits/);
  assert.doesNotMatch(first, /sk-ant-|ghp_|\/Users\//);
});

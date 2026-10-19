import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProtected, formatViolations, hardPathsInAllow, matchesGlob } from '../scripts/lib/protected-paths.mjs';

test('Scenario: Workflow edited - refused even when the issue lists the path', () => {
  const r = checkProtected(['.github/workflows/ci.yml'], { allow: ['.github/workflows/ci.yml', '.github/**'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, [{ path: '.github/workflows/ci.yml', tier: 'hard', rule: '.github/' }]);
});

test('the Relevo configuration, its stack folder and the folders of skills are hard-protected', () => {
  ['relevo.yml', '.relevo/stacks/vue.md', '.claude/skills/x/SKILL.md', '.agents/skills/y/SKILL.md'].forEach((path) => {
    const r = checkProtected([path], { allow: ['**'] });
    assert.equal(r.violations[0]?.tier, 'hard', path);
  });
});

test('the file with the project rules is hard-protected, so a defect cannot be fixed by rewriting the rule', () => {
  assert.equal(checkProtected(['CLAUDE.md'], { rulesFile: 'CLAUDE.md' }).violations[0].tier, 'hard');
  assert.equal(checkProtected(['CLAUDE.md']).ok, true, 'without a rules file, an ordinary file');
  assert.equal(checkProtected(['docs/rules.md'], { rulesFile: './docs/rules.md' }).violations[0].tier, 'hard');
});

test('hard rules are anchored at the root: a similar name deeper in the tree is an ordinary file', () => {
  assert.equal(checkProtected(['lib/relevo.yml', 'docs/.github/x.md', 'lib/.claude/skills/a.md']).ok, true);
});

test('Scenario: Lock file without permission - refused', () => {
  const r = checkProtected(['pubspec.lock', 'lib/main.dart']);
  assert.deepEqual(r.violations, [{ path: 'pubspec.lock', tier: 'soft', rule: 'pubspec.lock' }]);
});

test('Scenario: Lock file with permission - the guard lets it pass', () => {
  assert.equal(checkProtected(['pubspec.yaml', 'pubspec.lock'], { allow: ['pubspec.yaml', 'pubspec.lock'] }).ok, true);
  assert.equal(checkProtected(['pubspec.lock'], { allow: ['pubspec.yaml'] }).ok, false, 'only the listed file');
});

test('manifests are found at any depth, and a glob can allow several', () => {
  assert.equal(checkProtected(['apps/web/package.json']).violations[0].tier, 'soft');
  assert.equal(checkProtected(['apps/web/package.json', 'apps/web/package-lock.json'], { allow: ['apps/web/*'] }).ok, true);
  assert.equal(checkProtected(['apps/web/package.json'], { allow: ['package.json'] }).ok, true, 'a name without a slash matches at any depth');
});

test('every manifest and lock file of the supported ecosystems is soft-protected', () => {
  ['pubspec.yaml', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'composer.json', 'composer.lock', 'Gemfile', 'Gemfile.lock']
    .forEach((file) => assert.equal(checkProtected([file]).violations[0]?.tier, 'soft', file));
});

test('ordinary files, repeated paths and ./ prefixes are handled', () => {
  assert.equal(checkProtected(['lib/main.dart', './lib/main.dart', 'test/main_test.dart']).ok, true);
  assert.equal(checkProtected(['./pubspec.lock', 'pubspec.lock']).violations.length, 1);
  assert.equal(checkProtected([]).ok, true);
});

test('globs: * stays inside a folder, ** crosses folders, a trailing slash means the whole folder', () => {
  assert.equal(matchesGlob('apps/web/package.json', 'apps/*/package.json'), true);
  assert.equal(matchesGlob('apps/web/src/package.json', 'apps/*/package.json'), false);
  assert.equal(matchesGlob('apps/web/src/package.json', 'apps/**/package.json'), true);
  assert.equal(matchesGlob('apps/package.json', 'apps/**/package.json'), true);
  assert.equal(matchesGlob('docs/a/b.md', 'docs/'), true);
  assert.equal(matchesGlob('docs.md', 'docs/'), false);
  assert.equal(matchesGlob('a.lock', '?.lock'), true);
});

test('Scenario: Allow-paths names a path that can never be allowed - found by the check', () => {
  assert.deepEqual(hardPathsInAllow(['pubspec.yaml', '.github/workflows/ci.yml', 'relevo.yml']), ['.github/workflows/ci.yml', 'relevo.yml']);
  assert.deepEqual(hardPathsInAllow(['**']), ['**'], 'a glob that would cover a hard path is refused as well');
  assert.deepEqual(hardPathsInAllow(['CLAUDE.md'], { rulesFile: 'CLAUDE.md' }), ['CLAUDE.md']);
  assert.deepEqual(hardPathsInAllow(['pubspec.yaml', 'pubspec.lock']), []);
});

test('the report names the path and the reason, and what to do', () => {
  const text = formatViolations(checkProtected(['.github/a.yml', 'composer.lock']).violations);
  assert.match(text, /\.github\/a\.yml {2}protected path/);
  assert.match(text, /composer\.lock {2}dependency file: the issue must list it in an Allow-paths: line/);
});

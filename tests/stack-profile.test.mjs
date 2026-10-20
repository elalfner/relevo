import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyChecks, mergeProfiles, parseProfile, profileLookups, resolveProfile } from '../scripts/lib/stack-profile.mjs';

const CLI = new URL('../scripts/stack-profile.mjs', import.meta.url).pathname;
const PLUGIN_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const header = (extra = '') => `---\nstack: vue\ncommands:\n  analyze: vue-tsc\n  test: vitest\ngenerated: ['dist/**']\ntools: [node]\n${extra}---\n`;

test('a profile has a header scripts read and a body for the agents', () => {
  const { profile, errors } = parseProfile(`${header()}\n# Vue\n\nHygiene.\n`);
  assert.deepEqual(errors, []);
  assert.equal(profile.stack, 'vue');
  assert.deepEqual(profile.commands, { analyze: 'vue-tsc', test: 'vitest' });
  assert.deepEqual(profile.skills, { dev: [], qa: [], issue: [], review: [] });
  assert.match(profile.body, /Hygiene\./);
});

test('Scenario: Stack with no body - a header alone resolves', () => {
  const { profile, errors } = parseProfile(header());
  assert.deepEqual(errors, []);
  assert.equal(profile.body, '');
});

test('profile errors name what is wrong', () => {
  assert.match(parseProfile('no header').errors[0], /between two "---" lines/);
  assert.match(parseProfile('---\ncolour: red\n---\n').errors.join(' '), /unknown header key "colour"/);
  assert.match(parseProfile('---\nstack: vue\nskills:\n  boss: [x]\n---\n').errors.join(' '), /unknown role "boss"/);
  assert.match(parseProfile('---\nstack: Vue!\n---\n').errors.join(' '), /needs "stack"/);
});

const plugin = parseProfile(`${header('skills:\n  dev: [a]\ntargets:\n  web: ""\n')}\nPlugin body.\n`).profile;

test('Scenario: Extra hygiene - the plugin body is followed by the repository body, and lists are joined', () => {
  const repo = parseProfile('---\nstack: vue\ngenerated: [\'coverage/**\']\nskills:\n  dev: [b]\n---\nRepository body.\n').profile;
  const merged = mergeProfiles(plugin, repo);
  assert.deepEqual(merged.layers, ['plugin', 'repository']);
  assert.equal(merged.body, 'Plugin body.\n\nRepository body.');
  assert.deepEqual(merged.generated, ['dist/**', 'coverage/**']);
  assert.deepEqual(merged.skills.dev, ['a', 'b']);
});

test('Scenario: A repository tries to remove a check - the plugin command is kept and the difference is reported', () => {
  const repo = parseProfile('---\nstack: vue\ncommands:\n  test: echo skipped\n  build: vite build\n---\n').profile;
  const merged = mergeProfiles(plugin, repo);
  assert.equal(merged.commands.test, 'vitest');
  assert.equal(merged.commands.build, 'vite build', 'a new command is an addition');
  assert.deepEqual(merged.ignored, [{ key: 'commands.test', value: 'echo skipped', kept: 'vitest' }]);
  assert.deepEqual(mergeProfiles(plugin, parseProfile('---\nstack: vue\ncommands:\n  test: vitest\n---\n').profile).ignored, [], 'the same value is not a difference');
});

test('Scenario: Command replaced the supported way - platforms.<name>.checks wins', () => {
  const p = applyChecks(plugin, { test: 'pnpm test' });
  assert.equal(p.commands.test, 'pnpm test');
  assert.equal(p.commands.analyze, 'vue-tsc');
  assert.deepEqual(p.overridden, ['test']);
});

const fs = (files) => (path) => files[path] ?? null;

test('Scenario: Stack defined only by the repository - that file is the whole profile', () => {
  const read = fs({ '.relevo/stacks/elixir.md': '---\nstack: elixir\ncommands:\n  test: mix test\n---\nBody.\n' });
  const r = resolveProfile({ platform: { stack: 'elixir' }, pluginRoot: '/p', read });
  assert.equal(r.ok, true);
  assert.deepEqual(r.profile.layers, ['repository']);
  assert.equal(r.profile.commands.test, 'mix test');
});

test('Scenario: Unknown stack - names the stack and the two places where a profile can be defined', () => {
  const r = resolveProfile({ platform: { stack: 'cobol' }, pluginRoot: '/p', read: fs({}) });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /no profile for stack "cobol"/);
  assert.match(r.errors[0], /stacks\/cobol\.md in the plugin or \.relevo\/stacks\/cobol\.md in the repository/);
});

test('an invalid profile file is an error that names the file', () => {
  const r = resolveProfile({ platform: { stack: 'vue' }, pluginRoot: '/p', read: fs({ '/p/stacks/vue.md': 'nothing' }) });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /^\/p\/stacks\/vue\.md: /);
});

test('lookups give the targets and commands of a stack for validating relevo.yml, and null when there is no profile', () => {
  const read = fs({ '/p/stacks/vue.md': `${header('targets:\n  web: ""\n')}` });
  const { knownTargets, knownChecks } = profileLookups({ pluginRoot: '/p', read });
  assert.deepEqual(knownTargets('vue'), ['web']);
  assert.deepEqual(knownChecks('vue'), ['analyze', 'test']);
  assert.equal(knownTargets('cobol'), null);
});

test('Scenario: Flutter profile - the plugin ships it with the commands, generated files and targets', () => {
  const r = resolveProfile({ platform: { stack: 'flutter' }, pluginRoot: PLUGIN_ROOT, read: (p) => { try { return readFileSync(p.startsWith('/') ? p : join('/nonexistent', p), 'utf8'); } catch { return null; } } });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.profile.commands.analyze, 'flutter analyze --no-pub');
  assert.equal(r.profile.commands.test, 'flutter test --reporter=compact --no-pub');
  assert.deepEqual(r.profile.generated, ['*.g.dart', '*.freezed.dart']);
  assert.deepEqual(Object.keys(r.profile.targets), ['android', 'ios', 'web']);
});

// ---------- the command

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-profile-'));
  Object.entries(files).forEach(([name, text]) => {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  });
  return dir;
}
const run = (dir, ...args) => spawnSync('node', [CLI, '--config', join(dir, 'relevo.yml'), ...args], { encoding: 'utf8', cwd: dir });
const CONFIG = (extra = '') => `limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: flutter\n    targets: [android, web]\n${extra}`;

test('the command prints the resolved profile with the layers used', () => {
  const dir = repo({ 'relevo.yml': CONFIG(), '.relevo/stacks/flutter.md': '---\nstack: flutter\n---\nOur own rule.\n' });
  const r = run(dir, '--plugin-root', PLUGIN_ROOT);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.layers, ['plugin', 'repository']);
  assert.deepEqual(out.target_tools, { android: 'adb', web: '' });
  assert.match(out.body, /Our own rule\.$/);
  assert.equal(out.platform, 'app', 'the only platform needs no --platform');
});

test('the command applies checks, and exits 1 for a stack with no profile and 2 for bad usage', () => {
  const checks = run(repo({ 'relevo.yml': CONFIG('    checks:\n      test: fvm flutter test\n') }), '--plugin-root', PLUGIN_ROOT);
  assert.equal(JSON.parse(checks.stdout).commands.test, 'fvm flutter test');
  assert.deepEqual(JSON.parse(checks.stdout).overridden, ['test']);
  const none = run(repo({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: cobol\n' }), '--plugin-root', PLUGIN_ROOT);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /no profile for stack "cobol"/);
  const two = repo({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nplatforms:\n  a:\n    stack: flutter\n  b:\n    stack: flutter\n' });
  assert.equal(run(two, '--plugin-root', PLUGIN_ROOT).status, 2, 'several platforms need --platform');
  assert.equal(run(two, '--platform', 'zzz', '--plugin-root', PLUGIN_ROOT).status, 2);
  assert.equal(run(repo({ 'relevo.yml': 'oops: 1\n' }), '--plugin-root', PLUGIN_ROOT).status, 2);
});

test('nothing of the hygiene the agents used to carry was lost when it moved to the Flutter profile', () => {
  const body = parseProfile(readFileSync(join(PLUGIN_ROOT, 'stacks/flutter.md'), 'utf8')).profile.body;
  // The sentences of the Flutter text of agents/dev.md and agents/qa.md before they became generic.
  [
    'check `mounted` before using a `BuildContext` or calling `setState` after an `await`',
    'Dispose every controller, stream subscription and listener you create',
    'Avoid the null-assertion operator unless a prior check makes it provably safe',
    'loading, empty and error states',
    'Prevent double submission of actions',
    'Keep layouts from overflowing on small screens',
    'Prefer the Dart tooling server',
    'Do not claim the code compiles, analyses clean or passes tests unless you ran the tools and saw it',
    'a `BuildContext` use or `setState` after an `await` without a `mounted` check',
    'a controller, stream subscription or listener created and never disposed',
    'an unchecked null-assertion operator that can throw at runtime',
    'unconstrained content that can overflow on a small screen',
    'missing loading, empty or error states; an action that can be triggered twice',
    'an external-app launch with no handling for the app being missing, permission use without handling denial, behaviour on the back button',
  ].forEach((sentence) => assert.ok(body.toLowerCase().includes(sentence.toLowerCase()), `the Flutter profile lost: ${sentence}`));
});

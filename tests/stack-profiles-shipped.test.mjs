import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { parseProfile, profileLookups } from '../scripts/lib/stack-profile.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const profile = (stack) => {
  const { profile: p, errors } = parseProfile(readFileSync(`${ROOT}/stacks/${stack}.md`, 'utf8'));
  assert.deepEqual(errors, [], `${stack}: ${errors.join('; ')}`);
  return p;
};
const WRITES = /--fix\b|--write\b|\s-w\b|--force\b|\bformat\b(?!ter)|--update-snapshots\b|\s-u\b/;

test('Scenario: Vue profile - analyze type-checks and lints without a fix option, test runs once, format writes with Prettier, target web', () => {
  const p = profile('vue');
  assert.equal(p.commands.analyze, 'npx --no-install vue-tsc --build && npx --no-install eslint . --cache');
  assert.equal(p.commands.test, 'npx --no-install vitest run');
  assert.equal(p.commands.format, 'npx --no-install prettier --write src/');
  assert.deepEqual(p.targets, { web: '' });
  assert.deepEqual(p.tools, ['node', 'npm']);
});

test('Scenario: Defaults of Laravel - the review block has the log under storage/logs, php artisan test and no serve; the section Review is not in the body of dev and qa', () => {
  const p = profile('laravel');
  assert.deepEqual(p.review, { log: 'storage/logs/*.log', test: 'php artisan test' });
  assert.equal(p.review.serve, undefined);
  assert.match(p.reviewBody, /never read `\.env`/);
  assert.doesNotMatch(p.body, /feature test of its scenario/);
  assert.deepEqual(p.targets, {}, 'Targets: None is unchanged');
});

test('Scenario: Laravel profile - analyze is Pint in test mode, test is php artisan test, format is Pint, no targets', () => {
  const p = profile('laravel');
  assert.equal(p.commands.analyze, 'vendor/bin/pint --test');
  assert.equal(p.commands.test, 'php artisan test');
  assert.equal(p.commands.format, 'vendor/bin/pint');
  assert.deepEqual(p.targets, {});
  assert.deepEqual(p.tools, ['php', 'composer']);
});

test('the commands QA runs write nothing: no fix, write or update option in analyze or test', () => {
  ['vue', 'laravel', 'flutter'].forEach((stack) => {
    const p = profile(stack);
    ['analyze', 'test'].forEach((name) => {
      const withoutPlaceholders = p.commands[name].replace(/\bflutter analyze\b/, '');
      assert.doesNotMatch(withoutPlaceholders, WRITES, `${stack} ${name}: ${p.commands[name]}`);
    });
    assert.ok(p.commands.analyze && p.commands.test && p.commands.format, `${stack} must define analyze, test and format`);
  });
});

test('a profile of the plugin requires no skill that the plugin does not ship, and lists none by default', () => {
  ['vue', 'laravel', 'flutter'].forEach((stack) => {
    const p = profile(stack);
    assert.deepEqual(p.requires_skills, [], stack);
    Object.values(p.skills).forEach((list) => assert.deepEqual(list, [], stack));
  });
});

test('every profile has the three parts of the body and a section of questions that is not in the body', () => {
  ['vue', 'laravel', 'flutter'].forEach((stack) => {
    const p = profile(stack);
    assert.match(p.body, /^## Verification/m, stack);
    assert.match(p.body, /^## Hygiene for the developer/m, stack);
    assert.match(p.body, /^## What the auditor looks for in the diff/m, stack);
    assert.ok(p.questions.split('\n').filter((l) => l.startsWith('- ')).length >= 5, `${stack} has questions for the issue writer`);
    assert.doesNotMatch(p.body, /Questions for the issue writer/, stack);
  });
});

test('the bodies name the things the plan asked the auditor to look for', () => {
  const vue = profile('vue').body;
  ['destructur', 'v-for', ':key', 'v-html', 'loading', 'double submit', 'listener'].forEach((word) => assert.ok(vue.toLowerCase().includes(word.toLowerCase()), `vue: ${word}`));
  const laravel = profile('laravel').body;
  ['N+1', 'mass assignment', 'authoris', 'validat', 'migration', 'idempot'].forEach((word) => assert.ok(laravel.toLowerCase().includes(word.toLowerCase()), `laravel: ${word}`));
});

test('the Laravel questions cover the ones the plan listed', () => {
  const q = profile('laravel').questions;
  ['error', 'authorised', 'reversible', 'twice'].forEach((word) => assert.match(q, new RegExp(word, 'i'), word));
});

test('the bodies carry nothing from a private origin', () => {
  ['vue', 'laravel', 'flutter'].forEach((stack) => {
    assert.doesNotMatch(readFileSync(`${ROOT}/stacks/${stack}.md`, 'utf8'), /jira|atlassian|urban|funcionario/i, stack);
  });
});

test('relevo.yml accepts platforms of both stacks and checks their targets against the profiles', () => {
  const lookups = profileLookups({ pluginRoot: ROOT, read });
  const ok = loadConfig('limits:\n  run_max_cost: 5\nplatforms:\n  web:\n    stack: vue\n    path: apps/web\n    targets: [web]\n  api:\n    stack: laravel\n    path: apps/api\n', lookups);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  const bad = loadConfig('limits:\n  run_max_cost: 5\nplatforms:\n  api:\n    stack: laravel\n    path: apps/api\n    targets: [web]\n', lookups);
  assert.equal(bad.ok, false);
  assert.match(bad.errors.map((e) => e.message).join(' '), /unknown target "web".*laravel/);
  const badCheck = loadConfig('limits:\n  run_max_cost: 5\nplatforms:\n  web:\n    stack: vue\n    checks:\n      lint: npm run lint\n', lookups);
  assert.equal(badCheck.ok, false, 'a check the profile does not name is refused');
  const goodCheck = loadConfig('limits:\n  run_max_cost: 5\nplatforms:\n  api:\n    stack: laravel\n    checks:\n      analyze: vendor/bin/pint --test && vendor/bin/phpstan analyse\n', lookups);
  assert.equal(goodCheck.ok, true, JSON.stringify(goodCheck.errors));
});

test('Scenario: Flutter profile - the rules of the official docs are in the body, mocks are generated, and no architecture is imposed', () => {
  const p = profile('flutter');
  assert.deepEqual(p.generated, ['*.g.dart', '*.freezed.dart', '*.mocks.dart']);
  ['ListView', 'Column', 'TextField', 'Row', 'showDialog', 'ScrollController', 'builder constructors', 'Opacity', 'Isolate.run', 'dart:html', 'package:web', 'analyze_files', 'read_package_uris', 'run_tests', 'dart_format', 'dart_fix', 'hot_reload', 'launch_app', 'MissingPluginException', 'build_runner'].forEach((word) => assert.ok(p.body.includes(word), `flutter: ${word}`));
  assert.match(p.body, /Command and Result objects, and any state-management package, are not required by this profile/);
  assert.match(p.body, /report only what breaks a rule the project wrote down/);
  assert.doesNotMatch(p.body, /\b(must|always) use (Command|Result|provider|freezed)/i);
  assert.doesNotMatch(p.body, /AI rules/i);
  assert.ok(Buffer.byteLength(p.body) <= 8 * 1024, `the Flutter body is ${Buffer.byteLength(p.body)} bytes`);
});

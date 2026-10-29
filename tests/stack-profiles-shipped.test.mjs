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

test('a profile of the plugin requires no skill, and only Flutter lists skills by default', () => {
  ['vue', 'laravel', 'flutter'].forEach((stack) => {
    assert.deepEqual(profile(stack).requires_skills, [], stack);
  });
  ['vue', 'laravel'].forEach((stack) => {
    Object.values(profile(stack).skills).forEach((list) => assert.deepEqual(list, [], stack));
  });
});

// Sizes in bytes of the SKILL.md files of flutter/agent-plugins, read on 2026-10-29 (the full set is 211 KB).
const DEFAULT_SKILL_BYTES = { 'flutter-add-widget-test': 6381, 'dart-add-unit-test': 4709 };

test('Scenario: The set - Flutter lists the same short set for dev and qa, and none for issue and review', () => {
  const { skills } = profile('flutter');
  const set = ['flutter-add-widget-test', 'dart-add-unit-test'];
  assert.deepEqual(skills.dev, set);
  assert.deepEqual(skills.qa, set);
  assert.deepEqual(skills.issue, []);
  assert.deepEqual(skills.review, []);
});

test('Scenario: Budget - the default set of each role is under 20 KB', () => {
  const { skills } = profile('flutter');
  ['dev', 'qa'].forEach((role) => {
    const bytes = skills[role].reduce((sum, name) => sum + DEFAULT_SKILL_BYTES[name], 0);
    assert.ok(bytes < 20 * 1024, `${role}: ${bytes} bytes`);
  });
});

test('Scenario: No imposed architecture - the set holds no skill that prescribes an architecture or a package', () => {
  const { skills } = profile('flutter');
  const imposing = ['flutter-apply-architecture-best-practices', 'flutter-use-http-package', 'flutter-setup-declarative-routing', 'flutter-implement-json-serialization', 'dart-generate-test-mocks', 'dart-run-static-analysis', 'flutter-fix-layout-issues'];
  imposing.forEach((name) => ['dev', 'qa'].forEach((role) => assert.ok(!skills[role].includes(name), `${role} lists ${name}`)));
});

// Sizes in bytes of the SKILL.md files, read on 2026-10-29: Laravel Boost 2.10 on a fresh Laravel 13 project, and vuejs-ai/skills.
const WHEN_INSTALLED_BYTES = { 'laravel-best-practices': 4644, 'testing-best-practices': 4225, 'vue-best-practices': 10475, 'vue-testing-best-practices': 2129 };
// The length of the body of the Vue profile before the checklist of the official documentation was added.
const VUE_BODY_BEFORE = 4057;

test('Scenario: The set - Laravel uses two Boost skills for dev and qa when installed, and requires or lists none', () => {
  const p = profile('laravel');
  const set = ['laravel-best-practices', 'testing-best-practices'];
  assert.deepEqual(p.skillsWhenInstalled.dev, set);
  assert.deepEqual(p.skillsWhenInstalled.qa, set);
  assert.deepEqual(p.skillsWhenInstalled.issue, []);
  assert.deepEqual(p.requires_skills, []);
  Object.values(p.skills).forEach((list) => assert.deepEqual(list, []));
  assert.ok(!JSON.stringify(p.skillsWhenInstalled).includes('livewire'), 'a skill that applies only when a package is used is not listed');
});

test('Scenario: The set - Vue uses two community skills for dev and qa when installed, and requires or lists none', () => {
  const p = profile('vue');
  const set = ['vue-best-practices', 'vue-testing-best-practices'];
  assert.deepEqual(p.skillsWhenInstalled.dev, set);
  assert.deepEqual(p.skillsWhenInstalled.qa, set);
  assert.deepEqual(p.requires_skills, []);
  Object.values(p.skills).forEach((list) => assert.deepEqual(list, []));
  assert.doesNotMatch(p.body, /official skills? of Vue/i, 'the profile does not call them official');
});

test('Scenario: Budget - the skills used when installed of each role are under 20 KB', () => {
  ['laravel', 'vue'].forEach((stack) => {
    const { skillsWhenInstalled } = profile(stack);
    ['dev', 'qa'].forEach((role) => {
      const bytes = skillsWhenInstalled[role].reduce((sum, name) => sum + WHEN_INSTALLED_BYTES[name], 0);
      assert.ok(bytes < 20 * 1024, `${stack} ${role}: ${bytes} bytes`);
    });
  });
});

test('Scenario: Security, performance and tests in the diff - the body of Vue names the points of the official documentation', () => {
  const body = profile('vue').body;
  const has = (re, what) => assert.match(body, re, what);
  has(/template.{0,60}user text/i, 'a template built from user text');
  has(/innerHTML/, 'innerHTML in a render function');
  has(/javascript:/, 'a javascript: URL');
  has(/:style/, ':style from a CSS string a user wrote');
  has(/:active-id/, 'a shared prop that changes for every item');
  has(/virtualiz/i, 'a long list that is not virtualized');
  has(/shallowRef/, 'shallowRef for large data');
  has(/snapshot/i, 'a snapshot as the only assertion');
  has(/host component/i, 'a composable tested through a host component');
  has(/not how|calling its methods/i, 'test what a component does, not how');
});

test('Scenario: Size - the checklist grew the body of Vue by less than 2 KB, and the rule not to repeat analyze stays', () => {
  const p = profile('vue');
  assert.ok(p.body.length - VUE_BODY_BEFORE < 2048, `grew by ${p.body.length - VUE_BODY_BEFORE}`);
  assert.match(p.body, /Do not spend time re-checking what `analyze` already enforces/);
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

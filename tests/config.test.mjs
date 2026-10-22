import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';

const MINIMAL = 'limits:\n  run_max_cost: 5\n';

test('Scenario: Defaults - absent optional settings use the documented defaults', () => {
  const { ok, config } = loadConfig(MINIMAL);
  assert.equal(ok, true);
  assert.equal(config.branches.base, 'dev');
  assert.equal(config.branches.release, 'main');
  assert.equal(config.review.mode, 'peer');
  assert.equal(config.review.merger, 'approver');
  assert.equal(config.review.autopilot, 'off');
  assert.deepEqual(config.review.allowed_origins, []);
  assert.equal(config.limits.built_unreviewed_per_person, 2);
  assert.equal(config.limits.concurrent_agents, 3);
  assert.equal(config.limits.review_sla_hours, 8);
  assert.equal(config.limits.run_max_turns, 100);
  assert.equal(config.qa.retries, 1);
  assert.equal(config.evidence.policy, 'attach_to_pr');
  assert.equal(config.language, 'en');
  assert.equal(config.trust, 'private-team');
});

test('Scenario: Cost limit is mandatory - validation fails without run_max_cost', () => {
  const { ok, errors } = loadConfig('review:\n  mode: none\n');
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'limits.run_max_cost' && /required/.test(e.message)));
});

test('Scenario: Invalid value - names the setting, the value and the allowed values', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}review:\n  mode: sometimes\n`);
  assert.equal(ok, false);
  const e = errors.find((x) => x.path === 'review.mode');
  assert.ok(e);
  assert.match(e.message, /review\.mode/);
  assert.match(e.message, /"sometimes"/);
  assert.match(e.message, /"none", "peer", "roles"/);
});

test('numeric limits are range checked', () => {
  const bad = loadConfig('limits:\n  run_max_cost: 0\n  concurrent_agents: 0\n');
  assert.ok(bad.errors.some((e) => e.path === 'limits.run_max_cost'));
  assert.ok(bad.errors.some((e) => e.path === 'limits.concurrent_agents'));
});

test('unknown settings are errors (catches typos)', () => {
  const { errors } = loadConfig(`${MINIMAL}reveiw:\n  mode: none\nreview:\n  merge: author\n`);
  assert.ok(errors.some((e) => e.path === 'reveiw'));
  assert.ok(errors.some((e) => e.path === 'review.merge'));
});

test('Scenario: Secret detected in configuration - validation fails and points to the secret store', () => {
  const byValue = loadConfig(`${MINIMAL}qa:\n  rules_from: ghp_abcdefghijklmnopqrstuvwxyz0123456789\n`);
  assert.equal(byValue.ok, false);
  assert.ok(byValue.errors.some((e) => /secret store/.test(e.message)));
  const byKey = loadConfig(`${MINIMAL}anthropic_api_key: abc\n`);
  assert.equal(byKey.ok, false);
  assert.ok(byKey.errors.some((e) => /secret store/.test(e.message)));
  const opaque = loadConfig(`${MINIMAL}team:\n  spec_writer: ${'a1B2c3D4'.repeat(6)}\n`);
  assert.equal(opaque.ok, false);
});

test('roles mode requires approvers; peer mode warns about a missing second person', () => {
  const roles = loadConfig(`${MINIMAL}review:\n  mode: roles\n`);
  assert.ok(roles.errors.some((e) => e.path === 'team.approvers'));
  const peer = loadConfig(`${MINIMAL}team:\n  members: [ana]\n`);
  assert.equal(peer.ok, true);
  assert.ok(peer.warnings.some((w) => w.path === 'team.members'));
  const solo = loadConfig(`${MINIMAL}review:\n  mode: none\n`);
  assert.equal(solo.warnings.length, 0);
});

test('labels: renameable, known keys only, unique, at most 50 characters', () => {
  assert.equal(loadConfig(`${MINIMAL}labels:\n  ready: listo\n`).ok, true);
  assert.equal(loadConfig(`${MINIMAL}labels:\n  nope: x\n`).ok, false);
  assert.equal(loadConfig(`${MINIMAL}labels:\n  ready: same\n  built: same\n`).ok, false);
  assert.equal(loadConfig(`${MINIMAL}labels:\n  ready: ${'x'.repeat(51)}\n`).ok, false);
});

test('Scenario: Spanish messages - language is a tag; unknown catalogs warn and fall back', () => {
  const languageWarnings = (cfg) => cfg.warnings.filter((w) => w.path === 'language');
  assert.equal(languageWarnings(loadConfig(`${MINIMAL}language: es\n`)).length, 0);
  assert.equal(languageWarnings(loadConfig(`${MINIMAL}language: es-MX\n`)).length, 0);
  const fr = loadConfig(`${MINIMAL}language: fr\n`);
  assert.equal(fr.ok, true);
  assert.ok(fr.warnings.some((w) => w.path === 'language'));
  assert.equal(loadConfig(`${MINIMAL}language: Spanish\n`).ok, false);
});

test('a file that is not valid YAML is reported as an error, not a crash', () => {
  const { ok, errors } = loadConfig('limits:\n\trun_max_cost: 5\n');
  assert.equal(ok, false);
  assert.match(errors[0].message, /not valid/);
});

test('Scenario: Legacy setting - platform: flutter-android is one platform with stack flutter, path . and targets android', () => {
  const { ok, config } = loadConfig(`${MINIMAL}platform: flutter-android\n`);
  assert.equal(ok, true);
  assert.deepEqual(config.platforms, { app: { stack: 'flutter', path: '.', targets: ['android'] } });
  assert.equal('platform' in config, false, 'the commands read platforms, never platform');
});

test('no platform set: the default is the legacy platform', () => {
  assert.deepEqual(loadConfig(MINIMAL).config.platforms.app, { stack: 'flutter', path: '.', targets: ['android'] });
});

test('Scenario: Monorepo - two platforms with different stacks and paths', () => {
  const text = `${MINIMAL}platforms:\n  web:\n    stack: vue\n    path: apps/web\n  api:\n    stack: laravel\n    path: apps/api\n`;
  const { ok, config } = loadConfig(text);
  assert.equal(ok, true);
  assert.deepEqual(Object.keys(config.platforms), ['web', 'api']);
  assert.deepEqual(config.platforms.web, { stack: 'vue', path: 'apps/web', targets: [] });
});

test('Scenario: Both forms - platform and platforms together fail and say to keep platforms', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}platform: flutter-android\nplatforms:\n  app:\n    stack: flutter\n`);
  assert.equal(ok, false);
  assert.match(errors.find((e) => e.path === 'platforms').message, /keep only platforms/);
});

test('Scenario: Bad path or target - names the platform, the value and the targets the stack defines', () => {
  const abs = loadConfig(`${MINIMAL}platforms:\n  web:\n    stack: vue\n    path: /etc\n`);
  assert.match(abs.errors.find((e) => e.path === 'platforms.web.path').message, /platforms\.web\.path.*"\/etc"/);
  const up = loadConfig(`${MINIMAL}platforms:\n  web:\n    stack: vue\n    path: ../x\n`);
  assert.equal(up.ok, false);
  const known = (stack) => (stack === 'flutter' ? ['android', 'ios', 'web'] : null);
  const bad = loadConfig(`${MINIMAL}platforms:\n  app:\n    stack: flutter\n    targets: [android, tv]\n`, { knownTargets: known });
  const e = bad.errors.find((x) => x.path === 'platforms.app.targets');
  assert.match(e.message, /"tv"/);
  assert.match(e.message, /android, ios, web/);
  assert.equal(loadConfig(`${MINIMAL}platforms:\n  app:\n    stack: flutter\n    targets: [android, ios]\n`, { knownTargets: known }).ok, true);
});

test('platform entries are checked: unknown keys, missing stack, bad name', () => {
  assert.equal(loadConfig(`${MINIMAL}platforms:\n  app:\n    path: .\n`).ok, false);
  assert.equal(loadConfig(`${MINIMAL}platforms:\n  app:\n    stack: flutter\n    colour: red\n`).ok, false);
  assert.equal(loadConfig(`${MINIMAL}platforms:\n  Bad_Name:\n    stack: flutter\n`).ok, false);
  assert.equal(loadConfig(`${MINIMAL}platform: android-only\n`).ok, false);
});

test('qa.rules_from is a file name or a list, and is always a list once validated', () => {
  assert.deepEqual(loadConfig(MINIMAL).config.qa.rules_from, []);
  assert.deepEqual(loadConfig(`${MINIMAL}qa:\n  rules_from: CLAUDE.md\n`).config.qa.rules_from, ['CLAUDE.md']);
  assert.deepEqual(loadConfig(`${MINIMAL}qa:\n  rules_from: [CLAUDE.md, .ai/rules/backend.md]\n`).config.qa.rules_from, ['CLAUDE.md', '.ai/rules/backend.md']);
  assert.equal(loadConfig(`${MINIMAL}qa:\n  rules_from: []\n`).ok, false);
});

test('Scenario: Checks override - checks are kept per platform and an unknown command fails when the profile is known', () => {
  const text = `${MINIMAL}platforms:\n  web:\n    stack: vue\n    checks:\n      test: pnpm test\n`;
  assert.deepEqual(loadConfig(text).config.platforms.web.checks, { test: 'pnpm test' });
  const valid = (stack) => (stack === 'vue' ? ['analyze', 'test', 'format'] : null);
  assert.equal(loadConfig(text, { knownChecks: valid }).ok, true);
  const bad = loadConfig(text.replace('test: pnpm test', 'tset: pnpm test'), { knownChecks: valid });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0].message, /analyze, test, format/);
});

test('skills.allow_scripts is a list of skill names', () => {
  assert.deepEqual(loadConfig(MINIMAL).config.skills.allow_scripts, []);
  assert.deepEqual(loadConfig(`${MINIMAL}skills:\n  allow_scripts: [laravel-best-practices]\n`).config.skills.allow_scripts, ['laravel-best-practices']);
  assert.equal(loadConfig(`${MINIMAL}skills:\n  allow_scripts: 5\n`).ok, false);
});

test('validate-config checks targets against the profile of the stack', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(`${tmpdir()}/relevo-vc-`);
  writeFileSync(`${dir}/relevo.yml`, `${MINIMAL}platforms:\n  app:\n    stack: flutter\n    targets: [android, tv]\n`);
  const bad = spawnSync('node', [new URL('../scripts/validate-config.mjs', import.meta.url).pathname, `${dir}/relevo.yml`], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown target "tv".*android, ios, web/);
  writeFileSync(`${dir}/relevo.yml`, `${MINIMAL}platforms:\n  app:\n    stack: flutter\n    targets: [android, ios]\n    checks:\n      test: fvm flutter test\n`);
  assert.equal(spawnSync('node', [new URL('../scripts/validate-config.mjs', import.meta.url).pathname, `${dir}/relevo.yml`], { encoding: 'utf8' }).status, 0);
});

test('Scenario: Linked repositories setting - a valid list, a malformed name and a repeated one', () => {
  const ok = loadConfig(`${MINIMAL}links: [acme/api, acme/design]\n`);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.config.links, ['acme/api', 'acme/design']);
  const bad = loadConfig(`${MINIMAL}links: [acme, acme/api/extra]\n`);
  assert.equal(bad.ok, false);
  assert.match(bad.errors.map((e) => e.message).join('\n'), /"acme" is not a repository; the form is owner\/repo/);
  assert.match(bad.errors.map((e) => e.message).join('\n'), /"acme\/api\/extra"/);
  const twice = loadConfig(`${MINIMAL}links: [acme/api, acme/api]\n`);
  assert.match(twice.errors[0].message, /lists "acme\/api" more than once/);
  assert.equal(loadConfig(`${MINIMAL}links: acme/api\n`).ok, false, 'it must be a list');
});

test('a configuration without links still validates and links is an empty list', () => {
  assert.deepEqual(loadConfig(MINIMAL).config.links, []);
  assert.deepEqual(loadConfig(`${MINIMAL}links: []\n`).config.links, []);
});

test('Scenario: Alert for a build that stopped reporting - default 3, and 0 or 2.5 are rejected naming the setting', () => {
  assert.equal(loadConfig(MINIMAL).config.limits.building_alert_hours, 3);
  assert.equal(loadConfig(`limits:\n  run_max_cost: 5\n  building_alert_hours: 6\n`).config.limits.building_alert_hours, 6);
  ['0', '2.5', 'soon'].forEach((v) => {
    const r = loadConfig(`limits:\n  run_max_cost: 5\n  building_alert_hours: ${v}\n`);
    assert.equal(r.ok, false, v);
    assert.equal(r.errors[0].path, 'limits.building_alert_hours');
  });
});

// ---------- review autopilot

test('Scenario: Invalid autopilot value - validation names review.autopilot and the allowed values', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}review:\n  autopilot: always\n`);
  assert.equal(ok, false);
  const e = errors.find((x) => x.path === 'review.autopilot');
  assert.ok(e);
  assert.match(e.message, /"off", "precheck", "verify"/);
  ['off', 'precheck', 'verify'].forEach((v) => assert.equal(loadConfig(`${MINIMAL}review:\n  autopilot: ${v}\n`).config.review.autopilot, v));
});

test('Scenario: Origins - a list of web origins is read, and an entry that is not an origin is rejected', () => {
  const good = loadConfig(`${MINIMAL}review:\n  allowed_origins: [https://staging.example.com, http://localhost:5173]\n`);
  assert.equal(good.ok, true, JSON.stringify(good.errors));
  assert.deepEqual(good.config.review.allowed_origins, ['https://staging.example.com', 'http://localhost:5173']);
  ['staging.example.com', 'https://staging.example.com/app', 'ftp://example.com', 'https://'].forEach((bad) => {
    const r = loadConfig(`${MINIMAL}review:\n  allowed_origins: ["${bad}"]\n`);
    assert.equal(r.ok, false, bad);
    assert.ok(r.errors.some((e) => e.path === 'review.allowed_origins' && e.message.includes(bad)), bad);
  });
  assert.equal(loadConfig(`${MINIMAL}review:\n  allowed_origins: nope\n`).ok, false);
});

// ---------- design images

test('Scenario: Default - design.images is false unless the file sets it', () => {
  assert.equal(loadConfig(MINIMAL).config.design.images, false);
  assert.equal(loadConfig(`${MINIMAL}design:\n  images: true\n`).config.design.images, true);
  assert.equal(loadConfig(`${MINIMAL}design:\n  images: false\n`).config.design.images, false);
});

test('Scenario: Invalid value - design.images must be true or false and the error names the setting', () => {
  ['sometimes', '1', '"yes"'].forEach((v) => {
    const r = loadConfig(`${MINIMAL}design:\n  images: ${v}\n`);
    assert.equal(r.ok, false, v);
    assert.ok(r.errors.some((e) => e.path === 'design.images' && /true or false/.test(e.message)), v);
  });
});

test('agent.build defaults to claude, and only claude and antigravity are accepted', () => {
  assert.equal(loadConfig(MINIMAL).config.agent.build, 'claude');
  const { ok, errors } = loadConfig('agent:\n  build: gemini\nlimits:\n  run_max_cost: 5\n');
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'agent.build' && /allowed values/.test(e.message)));
});

test('Scenario: A cost limit with Antigravity - validation fails and says what is the limit instead', () => {
  const { ok, errors } = loadConfig('agent:\n  build: antigravity\nlimits:\n  run_max_cost: 5\n  run_max_tokens: 2000000\n');
  assert.equal(ok, false);
  const e = errors.find((x) => x.path === 'limits.run_max_cost');
  assert.match(e.message, /no effect with agent\.build "antigravity"/);
  assert.match(e.message, /limits\.run_max_tokens/);
  assert.match(e.message, /quota of the Google Cloud project/);
});

test('with Antigravity the token limit is required, and a valid configuration needs no cost limit', () => {
  const missing = loadConfig('agent:\n  build: antigravity\n');
  assert.ok(missing.errors.some((e) => e.path === 'limits.run_max_tokens' && /is required/.test(e.message)));
  assert.ok(!missing.errors.some((e) => e.path === 'limits.run_max_cost'), 'the cost limit is not asked for');
  const good = loadConfig('agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 2000000\n');
  assert.equal(good.ok, true, JSON.stringify(good.errors));
  assert.equal(good.config.limits.run_max_tokens, 2000000);
  assert.equal(good.config.limits.run_max_cost, null);
  assert.ok(loadConfig('agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 10\n').errors.some((e) => e.path === 'limits.run_max_tokens' && />= 1000/.test(e.message)));
});

test('with Claude the token limit has no effect and is refused, so no one believes it limits the run', () => {
  const { ok, errors } = loadConfig('limits:\n  run_max_cost: 5\n  run_max_tokens: 2000000\n');
  assert.equal(ok, false);
  assert.match(errors.find((e) => e.path === 'limits.run_max_tokens').message, /no effect with agent\.build "claude": the run is limited by limits\.run_max_cost/);
});

test('Scenario: Public repositories - trust public is refused with Antigravity', () => {
  const { ok, errors } = loadConfig('trust: public\nagent:\n  build: antigravity\nreview:\n  mode: peer\nlimits:\n  run_max_tokens: 2000000\n');
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'trust' && /antigravity/.test(e.message)));
  assert.equal(loadConfig('trust: public\nlimits:\n  run_max_cost: 5\n').ok, true, 'with Claude it still works');
});

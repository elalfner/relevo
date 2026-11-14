import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';
import { resolveProfile } from '../scripts/lib/stack-profile.mjs';
import { restrictedList } from '../scripts/lib/restricted-paths.mjs';

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

test('Scenario: Unattended ships without CI - review.ship_without_ci defaults to false', () => {
  assert.equal(loadConfig(MINIMAL).config.review.ship_without_ci, false);
  assert.equal(loadConfig(`${MINIMAL}review:\n  ship_without_ci: true\n`).config.review.ship_without_ci, true);
});

test('Scenario: Invalid ship setting - review.ship_without_ci must be true or false', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}review:\n  ship_without_ci: yes\n`);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'review.ship_without_ci' && /true or false/.test(e.message)));
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

test('Scenario: Run time limit setting - default 50, a valid value is kept, and below 5 or not a whole number is rejected naming the setting', () => {
  assert.equal(loadConfig(MINIMAL).config.limits.run_max_minutes, 50);
  assert.equal(loadConfig('limits:\n  run_max_cost: 5\n  run_max_minutes: 30\n').config.limits.run_max_minutes, 30);
  ['4', '0', '12.5', 'soon'].forEach((v) => {
    const r = loadConfig(`limits:\n  run_max_cost: 5\n  run_max_minutes: ${v}\n`);
    assert.equal(r.ok, false, v);
    assert.equal(r.errors[0].path, 'limits.run_max_minutes');
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

test('Scenario: Default runner - without a runner key the workflows run on ubuntu-latest', () => {
  const { ok, config } = loadConfig(MINIMAL);
  assert.equal(ok, true);
  assert.deepEqual(config.runner.labels, ['ubuntu-latest']);
});

test('Scenario: Self-hosted runner with labels - a list of labels is accepted as written', () => {
  const { ok, config } = loadConfig(`${MINIMAL}runner:\n  labels: [self-hosted, linux-build]\n`);
  assert.equal(ok, true);
  assert.deepEqual(config.runner.labels, ['self-hosted', 'linux-build']);
});

test('Scenario: Empty list - validation fails and says the list needs at least one label', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}runner:\n  labels: []\n`);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'runner.labels' && /at least one label/.test(e.message)));
});

test('Scenario: A single string - validation fails and says it must be a list of labels', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}runner:\n  labels: self-hosted\n`);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'runner.labels' && /list of runner labels/.test(e.message)));
});

test('a runner label that is not a string is rejected', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}runner:\n  labels: [self-hosted, 3]\n`);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'runner.labels' && /non-empty strings/.test(e.message)));
});

test('Scenario: A persistence key - runner.ephemeral does not exist and the message says why', () => {
  const { ok, errors } = loadConfig(`${MINIMAL}runner:\n  ephemeral: true\n`);
  assert.equal(ok, false);
  const e = errors.find((x) => x.path === 'runner.ephemeral');
  assert.match(e.message, /assumes every runner persists/);
});

test('Scenario: Restricted paths default - without the setting only the base list applies', () => {
  const { ok, config } = loadConfig(MINIMAL);
  assert.equal(ok, true);
  assert.deepEqual(config.restricted_paths, []);
  assert.deepEqual(restrictedList(config), restrictedList());
});

test('Scenario: A project adds its own - a valid entry is kept and the file is restricted besides the base list', () => {
  const { ok, config } = loadConfig(`${MINIMAL}restricted_paths:\n  - infra/prod.tfvars\n  - "*.secret"\n`);
  assert.equal(ok, true);
  assert.deepEqual(config.restricted_paths, ['infra/prod.tfvars', '*.secret']);
  const list = restrictedList(config);
  assert.ok(list.includes('infra/prod.tfvars') && list.includes('.env') && list.includes('*.pem'));
});

test('Scenario: Invalid value - an absolute path or a path outside the repository is rejected and named', () => {
  ['/etc/passwd', '../outside'].forEach((entry) => {
    const { ok, errors } = loadConfig(`${MINIMAL}restricted_paths:\n  - ${entry}\n`);
    assert.equal(ok, false, entry);
    assert.ok(errors.some((e) => e.path === 'restricted_paths' && e.message.includes(`"${entry}"`)), entry);
  });
  const notList = loadConfig(`${MINIMAL}restricted_paths: .env\n`);
  assert.equal(notList.ok, false);
  assert.ok(notList.errors.some((e) => e.path === 'restricted_paths' && /list of paths/.test(e.message)));
});

test('Scenario: A project tries to lift a base entry - a negation is refused and .env stays restricted', () => {
  const { ok, errors, config } = loadConfig(`${MINIMAL}restricted_paths:\n  - "!.env"\n`);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.path === 'restricted_paths' && /base list cannot be reduced/.test(e.message)));
  assert.ok(restrictedList(config).includes('.env'), 'whatever the file says, the list keeps the base');
});

test('Scenario: A project tries to lift a base entry - a profile that names .env is refused with the same reason', () => {
  const profile = (extra) => `---\nstack: own\n${extra}---\n`;
  const resolve = (text) => resolveProfile({ platform: { stack: 'own' }, pluginRoot: '/p', read: (path) => (path === '.relevo/stacks/own.md' ? text : null) });
  const generated = resolve(profile("generated: ['.env', 'dist/**']\n"));
  assert.equal(generated.ok, false);
  assert.match(generated.errors.join('\n'), /"generated" lists ".env", a restricted file: the base list cannot be reduced/);
  const log = resolve(profile('review:\n  log: config/server.key\n'));
  assert.equal(log.ok, false);
  assert.match(log.errors.join('\n'), /"review.log" names "config\/server\.key"/);
  assert.equal(resolve(profile("generated: ['dist/**']\nreview:\n  log: storage/logs/*.log\n")).ok, true, 'an ordinary profile is accepted');
});

// ---- agent settings (specialist-review-lenses)
import { AGENT_DEFAULTS, EFFORTS, QA_LENSES } from '../scripts/lib/config.mjs';

const agents = (yaml) => `${MINIMAL}agents:\n${yaml}`;

test('Scenario: A project that changes nothing - each role has its default, and the default of dev is what it always was', () => {
  const { ok, config } = loadConfig(MINIMAL);
  assert.equal(ok, true);
  assert.deepEqual(config.agents, AGENT_DEFAULTS);
  assert.deepEqual(config.agents.dev, { model: 'sonnet', effort: 'high' });
  assert.deepEqual(config.agents.qa, { spec: { model: 'opus', effort: 'high' }, security: { model: 'opus', effort: 'high' }, code: { model: 'sonnet', effort: 'high' }, interface: { model: 'sonnet', effort: 'medium' } });
  assert.deepEqual(config.agents_given, []);
});

test('Scenario: A setting for one lens - the other roles keep their defaults', () => {
  const { ok, config } = loadConfig(agents('  qa:\n    security:\n      model: haiku\n'));
  assert.equal(ok, true);
  assert.deepEqual(config.agents.qa.security, { model: 'haiku', effort: 'high' });
  assert.deepEqual(config.agents.qa.spec, AGENT_DEFAULTS.qa.spec);
  assert.deepEqual(config.agents.dev, AGENT_DEFAULTS.dev);
  assert.deepEqual(config.agents_given, ['agents.qa.security.model']);
});

test('the developer agent can be set, with a model alias or a full identifier and an effort from the list', () => {
  const { ok, config } = loadConfig(agents('  dev:\n    model: claude-sonnet-5-5\n    effort: xhigh\n'));
  assert.equal(ok, true);
  assert.deepEqual(config.agents.dev, { model: 'claude-sonnet-5-5', effort: 'xhigh' });
  EFFORTS.forEach((e) => assert.equal(loadConfig(agents(`  dev:\n    effort: ${e}\n`)).ok, true, e));
});

test('Scenario: invalid values - an empty model, an unknown effort and an unknown lens fail and name the key', () => {
  const messages = (yaml) => loadConfig(agents(yaml)).errors.map((e) => e.message).join(' | ');
  assert.match(messages('  dev:\n    model: ""\n'), /agents\.dev\.model must be a non-empty model name/);
  assert.match(messages('  qa:\n    code:\n      effort: huge\n'), /agents\.qa\.code\.effort has invalid value "huge"; allowed values: "low", "medium", "high", "xhigh", "max"/);
  assert.match(messages('  qa:\n    style:\n      model: x\n'), /unknown lens "style" in agents\.qa/);
  assert.match(messages('  dev:\n    temperature: 1\n'), /unknown setting "agents\.dev\.temperature"/);
  assert.match(messages('  reviewer:\n    model: x\n'), /unknown setting "agents\.reviewer"/);
});

test('Scenario: An attempt to turn a lens off - validation fails because the key does not exist', () => {
  for (const yaml of ['  qa:\n    security:\n      enabled: false\n', '  qa:\n    security: off\n', '  qa:\n    code:\n      blocking: false\n']) {
    const r = loadConfig(agents(yaml));
    assert.equal(r.ok, false, yaml);
  }
  assert.equal(QA_LENSES.length, 4);
});

test('Scenario: Antigravity warns and passes - the settings are accepted, not applied, and a rejected key still fails', () => {
  const base = 'agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 200000\n';
  const r = loadConfig(`${base}agents:\n  qa:\n    security:\n      model: opus\n`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.warnings.some((w) => w.path === 'agents' && /agents\.qa\.security\.model is not applied with this agent/.test(w.message)));
  assert.equal(loadConfig(base).warnings.some((w) => w.path === 'agents'), false, 'no settings, no warning');
  assert.equal(loadConfig(`${base}  run_max_cost: 5\n`).ok, false, 'a rejected key still fails');
  assert.equal(loadConfig(`${MINIMAL}agents:\n  dev:\n    model: opus\n`).warnings.some((w) => w.path === 'agents'), false, 'Claude applies the model');
});

// ---- the design system (interface-decisions-upfront)
const withSystem = (yaml) => `${MINIMAL}design:\n  system:\n${yaml}`;

test('Scenario: Declared paths - folders inside the repository are valid and read as lists', () => {
  const r = loadConfig(withSystem('    tokens: [lib/theme]\n    components: [lib/widgets]\n    references: [docs/design]\n'));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.config.design.system, { tokens: ['lib/theme'], components: ['lib/widgets'], references: ['docs/design'] });
});

test('Scenario: Nothing declared - the file is valid and the lists are empty', () => {
  const r = loadConfig(MINIMAL);
  assert.equal(r.ok, true);
  assert.deepEqual(r.config.design.system, { tokens: [], components: [], references: [] });
});

test('Scenario: A path outside the repository - validation names the key and the path', () => {
  for (const bad of ['../outside', '/etc/passwd', '~/design', 'a/../../b']) {
    const r = loadConfig(withSystem(`    tokens: ["${bad}"]\n`));
    assert.equal(r.ok, false, bad);
    assert.match(r.errors.map((e) => e.message).join(' '), new RegExp(`design\\.system\\.tokens: "${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" leaves the repository`));
  }
});

test('Scenario: A restricted path - validation says why', () => {
  const r = loadConfig(withSystem('    references: [.env]\n'));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join(' '), /design\.system\.references: ".env" is a restricted file/);
});

test('a protected path is refused too, and an unknown key under design.system is a typo', () => {
  assert.match(loadConfig(withSystem('    components: [.github/workflows]\n')).errors.map((e) => e.message).join(' '), /protected path/);
  assert.match(loadConfig(withSystem('    token: [lib]\n')).errors.map((e) => e.message).join(' '), /unknown setting "design\.system\.token"/);
});

// ---------- The ladder, auto and the range of a role (model-per-issue)

test('Scenario: The default ladder - low to high, without a line in relevo.yml', () => {
  const { ok, config } = loadConfig(MINIMAL);
  assert.equal(ok, true);
  assert.deepEqual(config.agents.ladder, ['haiku', 'sonnet', 'opus']);
});

test('Scenario: A ladder of the repository - its order is the one the ranges are read against', () => {
  const { ok, config, errors } = loadConfig(agents('  ladder: [sonnet, opus]\n  dev:\n    model: auto\n    ceiling: opus\n'));
  assert.equal(ok, true, JSON.stringify(errors));
  assert.deepEqual(config.agents.ladder, ['sonnet', 'opus']);
  assert.deepEqual(config.agents.dev, { model: 'auto', effort: 'high', floor: 'sonnet', ceiling: 'opus' });
  assert.ok(config.agents_given.includes('agents.ladder'));
});

test('Scenario: An invalid ladder - an empty list, a repeat or something that is not a name is reported by name', () => {
  for (const yaml of ['  ladder: []\n', '  ladder: [a, a]\n', '  ladder: [a, ""]\n', '  ladder: sonnet\n']) {
    const r = loadConfig(agents(yaml));
    assert.equal(r.ok, false, yaml);
    assert.ok(r.errors.some((e) => e.path === 'agents.ladder'), yaml);
  }
});

test('Scenario: Auto with the defaults - the ceiling is the default model and the floor one step below', () => {
  const { ok, config } = loadConfig(agents('  dev:\n    model: auto\n  qa:\n    security:\n      model: auto\n    interface:\n      model: auto\n    code:\n      model: auto\n'));
  assert.equal(ok, true);
  assert.deepEqual(config.agents.dev, { model: 'auto', effort: 'high', floor: 'haiku', ceiling: 'sonnet' });
  assert.deepEqual(config.agents.qa.security, { model: 'auto', effort: 'high', floor: 'sonnet', ceiling: 'opus' }, 'a lens that defaults to the stronger model is never below one step of it');
  assert.deepEqual(config.agents.qa.interface, { model: 'auto', effort: 'medium', floor: 'sonnet', ceiling: 'sonnet' }, 'haiku did not pass the lens evaluation');
  assert.deepEqual(config.agents.qa.code, { model: 'auto', effort: 'high', floor: 'sonnet', ceiling: 'sonnet' });
});

test('Scenario: The ceiling is raised - the floor follows it by default', () => {
  const { config } = loadConfig(agents('  dev:\n    model: auto\n    ceiling: opus\n'));
  assert.deepEqual([config.agents.dev.floor, config.agents.dev.ceiling], ['sonnet', 'opus']);
});

test('Scenario: The lowest name of the ladder as ceiling - the floor is the ceiling itself', () => {
  const { config } = loadConfig(agents('  dev:\n    model: auto\n    ceiling: haiku\n'));
  assert.deepEqual([config.agents.dev.floor, config.agents.dev.ceiling], ['haiku', 'haiku']);
});

test('Scenario: A floor above the ceiling - reported with the role', () => {
  const r = loadConfig(agents('  dev:\n    model: auto\n    floor: opus\n    ceiling: sonnet\n'));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join(' | '), /agents\.dev\.floor "opus" is above agents\.dev\.ceiling "sonnet"/);
});

test('Scenario: A name outside the ladder - reported with the role and the ladder', () => {
  const r = loadConfig(agents('  dev:\n    model: auto\n    ceiling: gpt\n'));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join(' | '), /agents\.dev\.ceiling must be a name in agents\.ladder \(haiku, sonnet, opus\)/);
});

test('Scenario: A role that is not on auto keeps its model - floor and ceiling are kept as written and do not decide anything', () => {
  const { ok, config } = loadConfig(agents('  qa:\n    code:\n      model: sonnet\n      floor: haiku\n'));
  assert.equal(ok, true);
  assert.equal(config.agents.qa.code.model, 'sonnet');
});

test('Scenario: The default model of a role is not in the ladder - auto asks for a ceiling', () => {
  const r = loadConfig(agents('  ladder: [haiku, opus]\n  dev:\n    model: auto\n'));
  assert.equal(r.ok, false);
  assert.match(r.errors.map((e) => e.message).join(' | '), /agents\.dev is auto and the default model "sonnet" of the role is not in agents\.ladder.*set agents\.dev\.ceiling/);
  assert.equal(loadConfig(agents('  ladder: [haiku, opus]\n  dev:\n    model: auto\n    ceiling: opus\n')).ok, true);
});

test('Scenario: With Antigravity - auto, the ladder, floor and ceiling are accepted and reported as not applied', () => {
  const base = 'agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 200000\n';
  const r = loadConfig(`${base}agents:\n  ladder: [sonnet, opus]\n  dev:\n    model: auto\n    ceiling: opus\n`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const w = r.warnings.find((x) => x.path === 'agents');
  assert.ok(w);
  assert.match(w.message, /agents\.ladder/);
  assert.match(w.message, /agents\.dev\.model/);
  assert.match(w.message, /agents\.dev\.ceiling/);
});

test('Scenario: A floor written for a lens - only the default is raised', () => {
  const { config } = loadConfig(agents('  qa:\n    code:\n      model: auto\n      floor: haiku\n'));
  assert.deepEqual([config.agents.qa.code.floor, config.agents.qa.code.ceiling], ['haiku', 'sonnet']);
});

test('Scenario: A lens with a ceiling below sonnet - the floor is the ceiling', () => {
  const { config } = loadConfig(agents('  qa:\n    code:\n      model: auto\n      ceiling: haiku\n'));
  assert.deepEqual([config.agents.qa.code.floor, config.agents.qa.code.ceiling], ['haiku', 'haiku']);
});

test('Scenario: Full agent output setting - off by default, a boolean, and refused with trust public', () => {
  const base = 'limits:\n  run_max_cost: 5\n';
  assert.equal(loadConfig(base).config.run.full_output, false);
  assert.equal(loadConfig(`${base}run:\n  full_output: true\n`).config.run.full_output, true);
  const bad = loadConfig(`${base}run:\n  full_output: "yes"\n`);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.path === 'run.full_output'));
  const pub = loadConfig(`trust: public\n${base}run:\n  full_output: true\n`);
  assert.equal(pub.ok, false);
  assert.ok(pub.errors.some((e) => e.path === 'run.full_output' && /public/.test(e.message)));
  assert.equal(loadConfig(`trust: public\n${base}run:\n  full_output: false\n`).ok, true);
  assert.equal(loadConfig(`trust: private-team\n${base}run:\n  full_output: true\n`).ok, true);
});

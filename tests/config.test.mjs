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

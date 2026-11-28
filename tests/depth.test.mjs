import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_DEFAULTS, DEFAULT_LADDER, QA_LENSES, QA_MIN_MODEL, agentDefaults, loadConfig } from '../scripts/lib/config.mjs';
import { planModels } from '../scripts/lib/model-plan.mjs';

const BASE = 'limits:\n  run_max_cost: 5\n';
const cfg = (extra = '', depth = null) => {
  const { ok, config, errors } = loadConfig(`${BASE}${depth ? `depth: ${depth}\n` : ''}${extra}`);
  assert.equal(ok, true, JSON.stringify(errors));
  return config;
};
const rank = (m) => DEFAULT_LADDER.indexOf(m);
const ISSUE = { title: 'Counter', body: '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n' };

test('Scenario: No setting - depth standard is what Relevo always did, byte for byte', () => {
  assert.equal(cfg().depth, 'standard');
  assert.deepEqual(cfg().agents, AGENT_DEFAULTS);
  assert.deepEqual(cfg('', 'standard').agents, AGENT_DEFAULTS);
  assert.deepEqual(agentDefaults(), AGENT_DEFAULTS);
});

test('Scenario: Prototype defaults - the developer and each lens take one effort step less, and no lens defaults above the floor model', () => {
  const a = cfg('', 'prototype').agents;
  assert.equal(a.dev.effort, 'medium');
  assert.equal(AGENT_DEFAULTS.dev.effort, 'high');
  const expected = { spec: ['sonnet', 'medium'], security: ['sonnet', 'medium'], code: ['sonnet', 'medium'], interface: ['sonnet', 'low'], bugs: ['sonnet', 'medium'] };
  QA_LENSES.forEach((lens) => assert.deepEqual([a.qa[lens].model, a.qa[lens].effort], expected[lens], lens));
  assert.equal(a.dev.model, AGENT_DEFAULTS.dev.model, 'the developer keeps its model');
});

test('Scenario: Explicit value - a value under agents wins over the depth, and the others still take the depth', () => {
  const a = cfg('agents:\n  qa:\n    spec:\n      model: opus\n      effort: high\n', 'prototype').agents;
  assert.deepEqual([a.qa.spec.model, a.qa.spec.effort], ['opus', 'high']);
  assert.equal(a.qa.security.model, 'sonnet');
  assert.equal(a.dev.effort, 'medium');
  const dev = cfg('agents:\n  dev:\n    effort: max\n', 'prototype').agents;
  assert.equal(dev.dev.effort, 'max');
});

test('Scenario: Prototype QA - all five lenses run and none uses a model below the floor, at both depths', () => {
  ['standard', 'prototype'].forEach((depth) => {
    const plan = planModels({ config: cfg('', depth), issue: ISSUE });
    assert.deepEqual(Object.keys(plan.qa).sort(), [...QA_LENSES].sort(), `all lenses at ${depth}`);
    QA_LENSES.forEach((lens) => assert.ok(rank(plan.qa[lens].model) >= rank(QA_MIN_MODEL), `${lens} at ${depth} is not below ${QA_MIN_MODEL}`));
  });
});

test('the plan says that a default comes from the prototype depth, and keeps "set in relevo.yml" for what the file wrote', () => {
  const plan = planModels({ config: cfg('agents:\n  qa:\n    code:\n      effort: low\n', 'prototype'), issue: ISSUE });
  assert.equal(plan.qa.spec.why, 'the default of the prototype depth');
  assert.equal(plan.qa.code.why, 'set in relevo.yml');
  assert.equal(planModels({ config: cfg(), issue: ISSUE }).qa.spec.why, 'set in relevo.yml', 'standard says what it always said');
});

test('Scenario: Retries and the gate - depth touches nothing but agents and itself', () => {
  const standard = { ...cfg('', 'standard') };
  const prototype = { ...cfg('', 'prototype') };
  assert.equal(prototype.qa.retries, standard.qa.retries);
  for (const key of ['depth', 'agents']) { delete standard[key]; delete prototype[key]; }
  assert.deepEqual(prototype, standard, 'checks, limits, qa and every other setting are the same, so the validation gate runs identically');
});

test('depth never lowers an effort below low', () => {
  const twice = agentDefaults('prototype');
  Object.values(twice.qa).concat(twice.dev).forEach((r) => assert.ok(['low', 'medium', 'high', 'xhigh', 'max'].includes(r.effort)));
  assert.equal(twice.qa.interface.effort, 'low');
});

test('Scenario: Prototype defaults for Antigravity - lowers main.effort to medium while dev and all five QA lenses stay on inherit', () => {
  const { ok, config, errors } = loadConfig('agent:\n  build: antigravity\ndepth: prototype\nlimits:\n  run_max_tokens: 2000000\n');
  assert.equal(ok, true, JSON.stringify(errors));
  assert.deepEqual(config.agents.main, { model: 'gemini-4-neon', effort: 'medium' });
  assert.equal(config.agents.dev.model, 'inherit');
  assert.equal(config.agents.dev.effort, null);
  QA_LENSES.forEach((lens) => {
    assert.equal(config.agents.qa[lens].model, 'inherit', lens);
    assert.equal(config.agents.qa[lens].effort, null, lens);
  });

  const explicit = loadConfig('agent:\n  build: antigravity\ndepth: prototype\nlimits:\n  run_max_tokens: 2000000\nagents:\n  antigravity:\n    main:\n      effort: high\n');
  assert.equal(explicit.ok, true, JSON.stringify(explicit.errors));
  assert.equal(explicit.config.agents.main.effort, 'high', 'explicit main.effort wins over prototype depth');
});

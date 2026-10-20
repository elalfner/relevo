import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';

const TEMPLATE = new URL('../templates/relevo.yml', import.meta.url).pathname;
const CLI = new URL('../scripts/validate-config.mjs', import.meta.url).pathname;

test('the shipped template is itself a valid configuration', () => {
  const { ok, errors } = loadConfig(readFileSync(TEMPLATE, 'utf8'));
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
});

test('the template documents every supported setting', () => {
  const text = readFileSync(TEMPLATE, 'utf8');
  ['base:', 'release:', 'tracker:', 'git_provider:', 'platforms:', 'members:', 'spec_writer:', 'approvers:', 'mode:', 'merger:',
    'built_unreviewed_per_person:', 'concurrent_agents:', 'review_sla_hours:', 'run_max_turns:', 'run_max_cost:', 'retries:',
    'rules_from:', 'policy:', 'language:', 'trust:', 'labels:'].forEach((key) => assert.ok(text.includes(key), `template is missing ${key}`));
});

test('Scenario: Missing configuration - the CLI stops and tells the user to run /relevo:init', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const run = spawnSync('node', [CLI, join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /\/relevo:init/);
});

test('the CLI reports success, failure and --effective output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const good = join(dir, 'good.yml');
  writeFileSync(good, 'limits:\n  run_max_cost: 3\n');
  const ok = execFileSync('node', [CLI, good, '--effective'], { encoding: 'utf8' });
  assert.match(ok, /is valid/);
  assert.equal(JSON.parse(ok.slice(ok.indexOf('{'))).limits.run_max_cost, 3);

  const bad = join(dir, 'bad.yml');
  writeFileSync(bad, 'review:\n  mode: sometimes\n');
  const run = spawnSync('node', [CLI, bad], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /run_max_cost is required/);
  assert.match(run.stderr, /review\.mode has invalid value "sometimes"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideOutput } from '../scripts/lib/run-output.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

const root = new URL('../', import.meta.url).pathname;
const cfg = (extra = '') => {
  const r = loadConfig(`limits:\n  run_max_cost: 5\n${extra}`);
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r.config;
};

test('Scenario: Output off - neither the setting nor the input asks for it', () => {
  assert.deepEqual(decideOutput({ config: cfg() }), { output: false, transcript: true, refused: false, reason: null });
  assert.equal(decideOutput({ config: cfg(), input: 'false' }).output, false);
  assert.equal(decideOutput({ config: cfg(), input: '' }).output, false);
});

test('Scenario: Output turned on for one run - the input, with the setting off', () => {
  assert.equal(decideOutput({ config: cfg(), input: 'true' }).output, true);
  assert.equal(decideOutput({ config: cfg(), input: true }).output, true);
});

test('Scenario: Output turned on for the repository - the setting', () => {
  assert.equal(decideOutput({ config: cfg('run:\n  full_output: true\n') }).output, true);
  assert.equal(decideOutput({ config: cfg('run:\n  full_output: true\n'), input: 'false' }).output, true, 'a manual start cannot turn the setting off');
});

test('Scenario: Manual start in a public repository - the input is refused and nothing is saved', () => {
  const d = decideOutput({ config: cfg('trust: public\nreview:\n  mode: peer\nteam:\n  members: [a, b, c]\n  spec_writer: a\n'), input: 'true' });
  assert.equal(d.output, false);
  assert.equal(d.transcript, false);
  assert.equal(d.refused, true);
  assert.match(d.reason, /public/);
});

test('a public repository that asks for nothing is not "refused" but still saves no transcript', () => {
  const d = decideOutput({ config: cfg('trust: public\nreview:\n  mode: peer\nteam:\n  members: [a, b, c]\n  spec_writer: a\n') });
  assert.deepEqual([d.output, d.transcript, d.refused, d.reason], [false, false, false, null]);
});

test('a configuration that cannot be read fails closed', () => {
  const d = decideOutput({ config: null, input: 'true' });
  assert.deepEqual([d.output, d.transcript, d.refused], [false, false, true]);
  assert.equal(decideOutput({ config: null }).refused, false);
});

test('the script prints the decision as JSON, fails closed on a missing or invalid file, and exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-output-'));
  const file = join(dir, 'relevo.yml');
  writeFileSync(file, 'limits:\n  run_max_cost: 5\nrun:\n  full_output: true\n');
  const run = (args) => spawnSync('node', [`${root}scripts/run-output.mjs`, ...args], { encoding: 'utf8', cwd: dir });
  const on = run(['--config', file]);
  assert.equal(on.status, 0);
  assert.equal(JSON.parse(on.stdout).output, true);
  writeFileSync(file, 'trust: public\nlimits:\n  run_max_cost: 5\nrun:\n  full_output: true\n');
  const bad = run(['--config', file]);
  assert.equal(bad.status, 0);
  assert.deepEqual([JSON.parse(bad.stdout).output, JSON.parse(bad.stdout).transcript], [false, false]);
  const none = run(['--config', join(dir, 'nope.yml'), '--input', 'true']);
  assert.equal(none.status, 0);
  assert.equal(JSON.parse(none.stdout).refused, true);
});

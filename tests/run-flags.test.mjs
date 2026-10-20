import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { ALLOWED_TOOLS, DISALLOWED_TOOLS, runFlags } from '../scripts/lib/run-flags.mjs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));

test('the flags carry the limits of relevo.yml and the closed lists of tools', () => {
  assert.deepEqual(runFlags(config), ['--max-turns', '100', '--max-budget-usd', '5', '--allowedTools', ALLOWED_TOOLS, '--disallowedTools', DISALLOWED_TOOLS]);
  const custom = loadConfig('limits:\n  run_max_cost: 2.5\n  run_max_turns: 40\n').config;
  assert.deepEqual(runFlags(custom).slice(0, 4), ['--max-turns', '40', '--max-budget-usd', '2.5']);
});

test('Scenario: Template and local run agree - the claude_args of the go workflow carry the same limits and tools', () => {
  const workflow = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
  const args = workflow.match(/claude_args: >-\n([\s\S]*?)\n\n/)?.[1] ?? '';
  const flags = runFlags(config);
  assert.ok(args.includes(`--max-turns ${flags[1]}`), 'turns');
  assert.ok(args.includes(`--max-budget-usd ${flags[3]}`), 'cost');
  assert.ok(args.includes(`--allowedTools "${flags[5]}"`), 'allowed tools');
  assert.ok(args.includes(`--disallowedTools "${flags[7]}"`), 'disallowed tools');
});

test('the lists are closed: no web access and no downloader in the allowed list', () => {
  assert.doesNotMatch(ALLOWED_TOOLS, /Web|curl|wget/);
  assert.match(DISALLOWED_TOOLS, /WebFetch/);
  assert.match(DISALLOWED_TOOLS, /Bash\(curl:\*\)/);
});

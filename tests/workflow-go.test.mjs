import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { resolveLabelNames } from '../scripts/lib/labels.mjs';

const root = new URL('../', import.meta.url).pathname;
const workflow = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));

test('Scenario: Authorised label - the workflow starts only on the ready label applied by a person', () => {
  const ready = resolveLabelNames({}).ready;
  assert.ok(workflow.includes(`github.event.label.name == '${ready}'`));
  assert.match(workflow, /github\.event\.sender\.type == 'User'/);
  assert.match(workflow, /types: \[labeled\]/);
});

test('Scenario: Duplicate trigger - one run per issue, never cancelled midway', () => {
  assert.match(workflow, /group: relevo-go-\$\{\{ github\.event\.issue\.number \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('Scenario: Run exceeds its budget - the workflow caps turns and cost like the template config', () => {
  assert.ok(workflow.includes(`--max-turns ${config.limits.run_max_turns}`));
  assert.ok(workflow.includes(`--max-budget-usd ${config.limits.run_max_cost}`));
  assert.match(workflow, /timeout-minutes: \d+/);
});

test('the workflow runs the go skill of this plugin with the issue number', () => {
  assert.match(workflow, /prompt: \/relevo:go \$\{\{ github\.event\.issue\.number \}\}/);
  assert.ok(existsSync(`${root}skills/go/SKILL.md`));
});

test('Scenario: Fork pull request - the key comes from the secret store and nothing is triggered by forks', () => {
  assert.match(workflow, /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/);
  assert.doesNotMatch(workflow, /pull_request/);
  assert.doesNotMatch(workflow, /sk-ant-/);
});

test('OpenSpec is installed with telemetry off', () => {
  assert.match(workflow, /npm install --global @fission-ai\/openspec/);
  assert.match(workflow, /OPENSPEC_TELEMETRY: '0'/);
});

test('Scenario: Subagent in the background - the unattended run keeps subagents in the foreground', () => {
  assert.match(workflow, /CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'/);
});

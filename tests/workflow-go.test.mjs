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
  assert.match(workflow, /group: relevo-go-\$\{\{ github\.event\.issue\.number \|\| inputs\.issue \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('Scenario: Run exceeds its budget - the workflow caps turns and cost like the template config', () => {
  assert.ok(workflow.includes(`--max-turns ${config.limits.run_max_turns}`));
  assert.ok(workflow.includes(`--max-budget-usd ${config.limits.run_max_cost}`));
  assert.match(workflow, /timeout-minutes: \d+/);
});

test('the workflow runs the go skill of this plugin with the issue number', () => {
  assert.match(workflow, /prompt: \/relevo:go \$\{\{ github\.event\.issue\.number \|\| inputs\.issue \}\}/);
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

test('Scenario: Run ends without an outcome - a final step always runs and moves the issue to qa-failed with the run link', () => {
  assert.match(workflow, /if: always\(\)/);
  assert.ok(workflow.indexOf('anthropics/claude-code-action') < workflow.indexOf('Report a run that ended without an outcome'));
  assert.match(workflow, /grep -qxE 'relevo:\(ready\|building\)'/);
  assert.match(workflow, /--remove-label relevo:ready --remove-label relevo:building --add-label relevo:qa-failed/);
  assert.match(workflow, /RUN_URL: \$\{\{ github\.server_url \}\}\/\$\{\{ github\.repository \}\}\/actions\/runs\/\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /gh issue comment "\$ISSUE"/);
});

test('Scenario: Run ends with an outcome - the final step leaves the issue alone', () => {
  const guard = workflow.indexOf("grep -qxE 'relevo:(ready|building)'");
  assert.ok(guard !== -1 && workflow.indexOf('exit 0', guard) < workflow.indexOf('--add-label relevo:qa-failed'));
});

test('the final step uses the default labels of the template', () => {
  const names = resolveLabelNames({});
  for (const key of ['ready', 'building', 'qa-failed']) assert.ok(workflow.includes(names[key]), `${names[key]} must appear`);
});

test('Scenario: Private plugin repository or subscription - the template shows both as ready-to-use alternatives', () => {
  assert.match(workflow, /# claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/);
  assert.match(workflow, /tr -d '\[:space:\]'/);
  assert.match(workflow, /# plugin_marketplaces: https:\/\/x-access-token:\$\{\{ secrets\.RELEVO_PLUGIN_TOKEN \}\}@github\.com\//);
  // The defaults stay active and the alternatives stay commented out.
  assert.match(workflow, /^ {10}anthropic_api_key: /m);
  assert.match(workflow, /^ {10}plugin_marketplaces: https:\/\/github\.com\/[^@\n]+$/m);
  assert.doesNotMatch(workflow, /^ {10}claude_code_oauth_token:/m);
  assert.doesNotMatch(workflow, /sk-ant-|ghp_|github_pat_/);
});

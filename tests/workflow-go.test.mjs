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
  assert.ok(workflow.indexOf('anthropics/claude-code-action') < workflow.lastIndexOf('Report a run that ended without an outcome'), 'the build job reports after the agent step');
  assert.match(workflow, /grep -qxE 'relevo:\(ready\|building\)'/);
  assert.match(workflow, /--remove-label relevo:ready --remove-label relevo:queued --remove-label relevo:building --add-label relevo:qa-failed/);
  assert.match(workflow, /RUN_URL: \$\{\{ github\.server_url \}\}\/\$\{\{ github\.repository \}\}\/actions\/runs\/\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /gh issue comment "\$ISSUE"/);
});

test('Scenario: Run ends with an outcome - the final step leaves the issue alone', () => {
  const guard = workflow.indexOf("grep -qxE 'relevo:(ready|building)'");
  assert.ok(guard !== -1 && workflow.indexOf('exit 0', guard) < workflow.indexOf('--add-label relevo:qa-failed', guard));
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

test('Scenario: Run started by the queue - the final step reports on the dispatched issue too', () => {
  assert.match(workflow, /ISSUE: \$\{\{ github\.event\.issue\.number \|\| inputs\.issue \}\}/);
  assert.match(workflow, /workflow_dispatch:/);
});

test('Scenario: Dispatched run fails before claiming the issue - it is reported, so the queue does not retry it forever', () => {
  assert.match(workflow, /\[ "\$JOB_STATUS" != "success" \] && printf '%s\\n' "\$labels" \| grep -qx 'relevo:queued'/);
});

test('Scenario: Run ends normally with the issue queued - nothing is reported', () => {
  const guard = workflow.indexOf('JOB_STATUS" != "success"');
  assert.ok(guard !== -1 && workflow.indexOf('exit 0', guard) < workflow.indexOf('--add-label relevo:qa-failed', guard));
});

// ---------- two jobs: a light gate and a heavy build

const jobText = (name) => {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.ok(start !== -1, `job ${name} exists`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
};

test('Scenario: Issue not ready to build - only the light decide job runs, and it never installs a toolchain or starts the agent', () => {
  const decide = jobText('decide');
  assert.ok(!/flutter-action|install --global|claude-code-action/.test(decide.replace(/^\s*#.*$/gm, '')), 'decide must stay light');
  assert.match(decide, /go-plan\.mjs --repo "\$GITHUB_REPOSITORY" --only "\$ISSUE" --apply --claim --github-output "\$GITHUB_OUTPUT"/);
  assert.match(decide, /timeout-minutes: 10/);
  assert.match(decide, /action: \$\{\{ steps\.plan\.outputs\.action \}\}/);
  assert.match(decide, /decision_b64: \$\{\{ steps\.plan\.outputs\.decision_b64 \}\}/);
});

test('Scenario: Gates pass - the build job runs only when the decision is start and receives it with the prompt', () => {
  const build = jobText('build');
  assert.match(build, /needs: decide/);
  assert.match(build, /if: needs\.decide\.outputs\.action == 'start'/);
  assert.match(build, /prompt: \/relevo:go \$\{\{ github\.event\.issue\.number \|\| inputs\.issue \}\} --decision \$\{\{ needs\.decide\.outputs\.decision_b64 \}\}/);
  assert.match(build, /anthropics\/claude-code-action/);
  assert.ok(workflow.indexOf('\n  decide:') < workflow.indexOf('\n  build:'));
});

test('the event gate is on decide, so build is skipped with it', () => {
  const decide = jobText('decide');
  assert.match(decide, /if: github\.event_name == 'workflow_dispatch' \|\| \(github\.event\.label\.name == 'relevo:ready' && github\.event\.sender\.type == 'User'\)/);
  assert.ok(!/^\s+if: github\.event_name/m.test(jobText('build')));
});

test('Scenario: The plugin cannot be cloned - decide reports it, because the issue is still ready or queued', () => {
  const decide = jobText('decide');
  assert.match(decide, /Report a run that ended without an outcome/);
  assert.match(decide, /if: always\(\)/);
  assert.match(decide, /grep -qxE 'relevo:\(ready\|queued\|building\)'/);
  assert.match(decide, /token: \$\{\{ secrets\.RELEVO_PLUGIN_TOKEN \|\| github\.token \}\}/);
  assert.match(decide, /\[ "\$JOB_STATUS" = "success" \]/);
});

test('least privilege: decide only reads contents, build is the one that can push', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read\n {2}issues: write\n {2}pull-requests: read\n/m);
  assert.doesNotMatch(jobText('decide'), /contents: write|id-token/);
  assert.match(jobText('build'), /permissions:\n {6}contents: write/);
});

test('Scenario: the template says a run may be cut at its limits and shows installs without package scripts', () => {
  const t = readFileSync(new URL('../templates/workflows/relevo-go.yml', import.meta.url), 'utf8').replace(/\n\s*#\s*/g, ' ');
  assert.match(t, /run reached --max-turns or --max-budget-usd \(the runner cuts it/);
  assert.match(t, /npm ci --ignore-scripts/);
  assert.match(t, /composer install --no-scripts/);
  assert.match(t, /`flutter pub get` and `dart pub get` run no install-time scripts/);
});

test('Scenario: Output for a start - the decide job exposes platform, stack and path, and the setup examples are guarded by the stack', () => {
  ['platform', 'stack', 'path'].forEach((k) => assert.match(workflow, new RegExp(`${k}: \\$\\{\\{ steps\\.plan\\.outputs\\.${k} \\}\\}`), `decide does not expose ${k}`));
  // The setup examples of the toolchains are comments; every one is guarded by the stack it installs.
  const flat = workflow.replace(/\n\s*#\s*/g, '\n');
  const guards = [...flat.matchAll(/- if: needs\.decide\.outputs\.stack == '([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(guards)].sort(), ['flutter', 'laravel', 'vue']);
  assert.match(workflow, /working-directory: \$\{\{ needs\.decide\.outputs\.path \}\}/);
  assert.match(workflow, /npm ci --ignore-scripts/);
});

test('the guarded examples name only stacks the plugin ships or documents, and the build job still has no pull_request_target', () => {
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /so an issue for the front does not install the back's tools/);
});

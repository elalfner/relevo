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

test('Scenario: Built after an urgent start - the go skill carries urgent and built_waiting from the decision to the message', () => {
  const skill = readFileSync(`${root}skills/go/SKILL.md`, 'utf8');
  assert.match(skill, /`urgent` \(true\) and `built_waiting`/, 'the start decision lists the fields');
  assert.match(skill, /`urgent` and `built_waiting` copied from the decision when it has them/, 'the built message receives them');
  // The workflow starts the skill with the decision as it is: no input of the workflow changes for the urgent label.
  assert.doesNotMatch(workflow, /urgent/);
});

test('Scenario: Fork pull request - the key comes from the secret store and nothing is triggered by forks', () => {
  assert.match(workflow, /anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}/);
  assert.doesNotMatch(workflow, /pull_request/);
  assert.doesNotMatch(workflow, /sk-ant-/);
});

test('OpenSpec is installed with telemetry off', () => {
  assert.match(workflow, /OPENSPEC_TELEMETRY: '0'/);
});

test('Scenario: OpenSpec is installed per job - the pinned version goes under the temporary folder, never globally', () => {
  const active = workflow.replace(/^\s*#.*$/gm, '');
  assert.match(active, /npm install --prefix "\$RUNNER_TEMP\/openspec" "@fission-ai\/openspec@\$OPENSPEC_VERSION"/);
  assert.match(active, /echo "\$RUNNER_TEMP\/openspec\/node_modules\/\.bin" >> "\$GITHUB_PATH"/);
  assert.match(workflow, /^  OPENSPEC_VERSION: '\d+\.\d+\.\d+'$/m);
  assert.doesNotMatch(active, /npm install --global|npm i -g/);
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

test('Scenario: Subscription - the template shows the token as a ready-to-use alternative to the API key', () => {
  assert.match(workflow, /# claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/);
  assert.match(workflow, /tr -d '\[:space:\]'/);
  // The default stays active and the alternative stays commented out.
  assert.match(workflow, /^ {10}anthropic_api_key: /m);
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
  assert.match(decide, /go-plan\.mjs --repo "\$GITHUB_REPOSITORY" --only "\$ISSUE" --apply --claim --credential "\$HAS_CREDENTIAL" --github-output "\$GITHUB_OUTPUT"/);
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
  assert.match(decide, /if: vars\.RELEVO_CLOUD_GO != 'off' && \(github\.event_name == 'workflow_dispatch' \|\| \(github\.event\.label\.name == 'relevo:ready' && github\.event\.sender\.type == 'User'\)\)/);
  assert.ok(!/^\s+if: github\.event_name/m.test(jobText('build')));
});

test('Scenario: The plugin cannot be installed - decide reports it, because the issue is still ready or queued', () => {
  const decide = jobText('decide');
  assert.match(decide, /Report a run that ended without an outcome/);
  assert.match(decide, /if: always\(\)/);
  assert.match(decide, /grep -qxE 'relevo:\(ready\|queued\|building\)'/);
  assert.match(decide, /npm pack "@elalfner\/relevo@\$RELEVO_VERSION"/);
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
  assert.deepEqual([...new Set(guards)].sort(), ['flutter', 'laravel', 'supabase', 'vue']);
  assert.match(workflow, /working-directory: \$\{\{ needs\.decide\.outputs\.path \}\}/);
  assert.match(workflow, /npm ci --ignore-scripts/);
});

test('Scenario: Issue for a Supabase platform - the Supabase CLI step is active, guarded by the stack, and comes before the agent', () => {
  const build = jobText('build');
  const active = build.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(active, /- if: needs\.decide\.outputs\.stack == 'supabase'\n\s+uses: supabase\/setup-cli@v1/);
  assert.ok(active.indexOf('supabase/setup-cli') < active.indexOf('name: Check the toolchain'), 'the CLI is installed before the toolchain check');
  assert.ok(active.indexOf('supabase/setup-cli') < active.indexOf('anthropics/claude-code-action'));
});

test('Scenario: An issue for a Flutter platform - the Flutter and Laravel steps are active and guarded, Vue and the dependencies stay comments', () => {
  const build = jobText('build');
  const active = build.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(active, /- if: needs\.decide\.outputs\.stack == 'flutter'\n\s+uses: subosito\/flutter-action@v2\n\s+with:\n\s+channel: stable\n\s+cache: true/);
  assert.match(active, /- if: needs\.decide\.outputs\.stack == 'laravel'\n\s+uses: shivammathur\/setup-php@v2/);
  assert.doesNotMatch(active, /npm ci|composer install/, 'installing the dependencies is the project\'s choice');
  assert.doesNotMatch(active, /stack == 'vue'/, 'Vue needs only Node, which the job installs');
  assert.match(build, /# Vue needs only Node/);
  assert.match(build, /# Installing the dependencies is the project's choice/);
  assert.ok(active.indexOf('flutter-action') < active.indexOf('anthropics/claude-code-action'), 'the toolchain comes before the agent');
  assert.ok(active.indexOf('shivammathur/setup-php') < active.indexOf('anthropics/claude-code-action'));
});

test('the guarded examples name only stacks the plugin ships or documents, and the build job still has no pull_request_target', () => {
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /so an issue for the front does not install the back's tools/);
});

test('Scenario: Private linked repository - the gate step of go and the queue step map the read-only secret, and nothing else does', () => {
  const queue = readFileSync(`${root}templates/workflows/relevo-queue.yml`, 'utf8');
  const mapping = /GH_LINKS_TOKEN: \$\{\{ secrets\.RELEVO_LINKS_TOKEN \}\}/g;
  assert.equal((workflow.match(mapping) ?? []).length, 1, 'go maps it once');
  assert.equal((queue.match(mapping) ?? []).length, 1, 'the queue maps it once');
  // In go it belongs to the `decide` job, which only reads and comments; the build job never sees it.
  assert.match(jobText('decide'), mapping);
  assert.doesNotMatch(jobText('build'), /RELEVO_LINKS_TOKEN|GH_LINKS_TOKEN/);
  // The token that can push stays the default one.
  assert.doesNotMatch(workflow, /github_token: \$\{\{ secrets\.RELEVO_LINKS_TOKEN/);
  assert.match(workflow, /never to write/);
});

test('Scenario: Paused - RELEVO_CLOUD_GO=off is read by the gate of go and by the queue, and the missing credential is passed on', () => {
  const queue = readFileSync(`${root}templates/workflows/relevo-queue.yml`, 'utf8');
  assert.match(jobText('decide'), /if: vars\.RELEVO_CLOUD_GO != 'off'/);
  assert.match(queue, /requeue:\n[^\n]*\n\s+if: vars\.RELEVO_CLOUD_GO != 'off'/);
  const credential = /HAS_CREDENTIAL: \$\{\{ secrets\.ANTHROPIC_API_KEY != '' \|\| secrets\.CLAUDE_CODE_OAUTH_TOKEN != '' \}\}/;
  assert.match(jobText('decide'), credential);
  assert.match(queue, credential);
  assert.match(queue, /requeue\.mjs --repo "\$GITHUB_REPOSITORY" --credential "\$HAS_CREDENTIAL"/);
  // Only the presence of the secrets is tested; their values are never mapped into an environment variable.
  [jobText('decide'), queue].forEach((t) => assert.doesNotMatch(t.replace(credential, ''), /secrets\.(ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN)/));
  assert.match(workflow, /pauses the cloud/);
});

test('Scenario: Limit reached / Another failure - the final step tells a usage limit from other failures, and keeps running always', () => {
  const build = jobText('build');
  const finalStep = build.slice(build.indexOf('name: Report a run that ended without an outcome'));
  assert.match(finalStep, /if: always\(\)/);
  assert.match(finalStep, /EXECUTION_FILE: \$\{\{ steps\.agent\.outputs\.execution_file \}\}/);
  assert.match(finalStep, /usage-limit\.mjs --file "\$EXECUTION_FILE"/);
  assert.match(finalStep, /usage limit \(or the credit\) of the model account was reached/);
  assert.match(finalStep, /The run ended without a result \(job status: \$JOB_STATUS\)/, 'the generic text stays for any other failure');
  assert.match(build, /- id: agent\n\s+uses: anthropics\/claude-code-action@v1/);
});

test('Scenario: Log with usage / without usage - the consumption step runs after the agent, cannot fail the job and posts only what it finds', () => {
  const build = jobText('build');
  const step = build.slice(build.indexOf('name: Report what the run used'));
  assert.ok(build.indexOf('name: Report what the run used') > build.indexOf('uses: anthropics/claude-code-action@v1'), 'after the agent');
  assert.match(step, /if: always\(\)\n\s+continue-on-error: true/);
  assert.match(step, /run-usage\.mjs --file "\$EXECUTION_FILE" \$flag/);
  assert.match(step, /gh issue comment "\$ISSUE" --body "\$line"/, 'the whole output of the script is posted, so the hidden marker travels with the sentence');
  assert.match(step, /ONLY_SUBSCRIPTION: \$\{\{ secrets\.ANTHROPIC_API_KEY == '' && secrets\.CLAUDE_CODE_OAUTH_TOKEN != '' \}\}/);
  assert.match(step, /\[ -n "\$line" \] && gh issue comment/);
  assert.match(step, /exit 0/);
});

test('the Relevo scripts for the reports are unpacked after the agent, never before (the agent needs a clean tree)', () => {
  const build = jobText('build');
  const step = build.indexOf('name: Install the Relevo scripts for the reports');
  assert.ok(step > build.indexOf('uses: anthropics/claude-code-action@v1'));
  assert.match(build.slice(step, step + 400), /continue-on-error: true/);
  assert.equal((build.match(/mkdir -p \.relevo-plugin/g) ?? []).length, 1, 'once in the build job, and only after the agent');
});

test('Scenario: A runner without the toolchain - the check stops the job before the agent, outside the workspace, and says why', () => {
  const build = jobText('build');
  const step = build.indexOf('name: Check the toolchain');
  assert.ok(step > build.indexOf('name: Install OpenSpec'), 'after the toolchain steps and OpenSpec');
  assert.ok(step < build.indexOf('uses: anthropics/claude-code-action@v1'), 'before the agent: no model turn is spent');
  const text = build.slice(step, build.indexOf('# relevo:agent-step begin'));
  assert.match(text, /npm pack "@elalfner\/relevo@\$RELEVO_VERSION"/);
  assert.match(text, /--strip-components=1 -C "\$RUNNER_TEMP\/relevo"/);
  assert.doesNotMatch(text.replace(/^\s*#.*$/gm, ''), /\.relevo-plugin/, 'nothing is written in the workspace: the agent needs a clean tree');
  assert.match(text, /toolchain-check\.mjs" --platform "\$PLATFORM" --plugin-root "\$RUNNER_TEMP\/relevo"/);
  assert.match(text, /render-message\.mjs" toolchain_missing --config relevo\.yml/);
  assert.match(text, /--remove-label relevo:ready --remove-label relevo:queued --remove-label relevo:building --add-label relevo:qa-failed/);
  assert.match(text, /gh issue comment "\$ISSUE" --body "\$body"/);
  assert.match(text, /exit 1\s*$/, 'the job fails after it commented');
});

test('the toolchain check names the guard of the scripts it runs, and runs nothing for a pass', () => {
  const text = workflow.slice(workflow.indexOf('name: Check the toolchain'), workflow.indexOf('# relevo:agent-step begin'));
  assert.match(text, /for f in scripts\/toolchain-check\.mjs scripts\/render-message\.mjs \.claude-plugin\/plugin\.json; do/);
  assert.match(text, /lacks \$f/);
  assert.match(text, /if result=\$\(node [^\n]*\); then\n\s+exit 0\n\s+fi/, 'a complete toolchain passes silently');
});

test('Scenario: No marketplace in the workflow - the Claude step loads the unpacked package and names no marketplace, plugin or plugin token', () => {
  const step = workflow.slice(workflow.indexOf('# relevo:agent-step begin'), workflow.indexOf('# relevo:agent-step end'));
  const active = step.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(active, /plugin_marketplaces|^\s+plugins:/m);
  assert.doesNotMatch(workflow, /RELEVO_PLUGIN_TOKEN/, 'nothing is cloned from the plugin repository, so no token is needed');
  assert.match(active, /claude_args: >-\n(?:\s+--[^\n]*\n)*\s+--plugin-dir \$\{\{ runner\.temp \}\}\/relevo\n/);
  // The folder is the one the toolchain step unpacks the pinned package into.
  assert.match(workflow, /tar -xzf "\$RUNNER_TEMP"\/elalfner-relevo-\*\.tgz --strip-components=1 -C "\$RUNNER_TEMP\/relevo"/);
});

test('Scenario: The limits stay - adding the plugin directory changes none of the turn, cost or tool limits', () => {
  const args = /claude_args: >-\n((?:\s+--[^\n]*\n)+)/.exec(workflow)[1].split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(args, ['--max-turns 100', '--max-budget-usd 5', '--plugin-dir ${{ runner.temp }}/relevo', '--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task"', '--disallowedTools "WebFetch,WebSearch,Bash(curl:*),Bash(wget:*)"']);
});

test('Scenario: The package has no manifest - the run stops before the agent and names the missing path', () => {
  const guard = workflow.slice(workflow.indexOf('name: Check the toolchain'), workflow.indexOf('# relevo:agent-step begin'));
  const loop = /for f in ([^;]+); do\n\s+\[ -f "\$RUNNER_TEMP\/relevo\/\$f" \] \|\| \{ echo "::error::The Relevo package \$RELEVO_VERSION lacks \$f"; exit 1; \}/.exec(guard);
  assert.ok(loop, 'a guard that names the missing file');
  assert.ok(loop[1].split(/\s+/).includes('.claude-plugin/plugin.json'));
  assert.ok(workflow.indexOf('name: Check the toolchain') < workflow.indexOf('# relevo:agent-step begin'), 'the guard is before the agent');
});

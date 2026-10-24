import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The ship workflow: started by a person's label, no model, nothing run from the pull request, the App token only
// where it is needed, and a last step that reports a run without an outcome.
const root = new URL('../', import.meta.url).pathname;
const text = readFileSync(`${root}templates/workflows/relevo-ship.yml`, 'utf8');
const active = text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

test('Scenario: Approved issue shipped by label - it runs on the ship label of an issue', () => {
  assert.match(active, /^on:\n  issues:\n    types: \[labeled\]\n/m);
  assert.match(active, /github\.event\.label\.name == 'relevo:ship'/);
  assert.match(active, /!github\.event\.issue\.pull_request/);
  assert.doesNotMatch(active, /pull_request_target|workflow_run/);
});

test('Scenario: Paused - RELEVO_CLOUD_SHIP set to off starts nothing', () => {
  assert.match(active, /if: vars\.RELEVO_CLOUD_SHIP != 'off' &&/);
});

test('Scenario: No model credential - the workflow runs no model', () => {
  assert.doesNotMatch(active, /claude-code-action|ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN/);
});

test('the person who applied the label is passed through the environment, never inlined in a command', () => {
  assert.match(active, /ACTOR: \$\{\{ github\.event\.sender\.login \}\}/);
  assert.match(active, /ACTOR_TYPE: \$\{\{ github\.event\.sender\.type \}\}/);
  active.split('\n').filter((l) => /^\s+(run: |node |git |gh )/.test(l)).forEach((l) => assert.doesNotMatch(l, /\$\{\{/, l));
});

test('Scenario: Scripts changed in the pull request - nothing from the branch is installed or run', () => {
  assert.doesNotMatch(active, /npm (ci|install)(?! --global @fission-ai\/openspec)/);
  assert.doesNotMatch(active, /composer|flutter|pub get|\bmake\b/);
  assert.doesNotMatch(active, /ref:.*head/);
  assert.match(active, /node "\$RUNNER_TEMP\/relevo\/scripts\/ship-unattended\.mjs"/);
});

test('the App token exists only with both secrets and is used only for the checkout that pushes and for the push client', () => {
  assert.match(active, /HAS_APP: \$\{\{ secrets\.RELEVO_SHIP_APP_ID != '' && secrets\.RELEVO_SHIP_APP_KEY != '' \}\}/);
  assert.match(active, /if: env\.HAS_APP == 'true'\n\s+uses: actions\/create-github-app-token@v1/);
  const uses = [...active.matchAll(/steps\.app\.outputs\.token/g)];
  assert.equal(uses.length, 2, 'the checkout token and GH_PUSH_TOKEN');
  assert.match(active, /token: \$\{\{ steps\.app\.outputs\.token \|\| github\.token \}\}/);
  assert.match(active, /GH_PUSH_TOKEN: \$\{\{ steps\.app\.outputs\.token \|\| github\.token \}\}/);
  assert.match(active, /GH_TOKEN: \$\{\{ github\.token \}\}/);
});

test('Scenario: Run fails without an outcome - the last step removes the label and comments', () => {
  const last = active.slice(active.indexOf('Report a run that ended without an outcome'));
  assert.match(last, /if: always\(\)/);
  assert.match(last, /--remove-label relevo:ship/);
  assert.match(last, /ship_failed/);
});

test('one ship per issue, and enough time to wait for the checks', () => {
  assert.match(active, /group: relevo-ship-\$\{\{ github\.event\.issue\.number \}\}\n\s+cancel-in-progress: false/);
  assert.match(active, /timeout-minutes: 45/);
});

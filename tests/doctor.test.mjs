import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SKILLS, WORKFLOW_FILES, gatherFacts, readOnlyGh, refMatches, renderReport, runChecks, summarizeProtection, versionAtLeast } from '../scripts/lib/doctor.mjs';
import { labelDefinitions } from '../scripts/lib/labels.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

const CONFIG_TEXT = 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b]\nplatform: flutter-android\n';
const config = loadConfig(CONFIG_TEXT).config;
const allLabels = labelDefinitions({}).map((l) => l.name);
const PROTECTED = { protected: true, pullRequestRequired: true, approvals: 1, dismissStale: false, blocksDeletion: true, blocksForcePush: true };

function healthy(over = {}) {
  return {
    repo: 'o/r', platform: 'flutter-android', node: '22.1.0', openspec: '1.14.1', git: true, gh: true, ghAuth: true, toolchain: true, adb: true,
    skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])),
    configText: CONFIG_TEXT, config, configErrors: [], rulesFileMissing: false,
    openspecRoot: true, openspecRootTracked: true, evidenceIgnored: true,
    workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, { present: true, enabled: true }])),
    pluginMarketplace: 'https://github.com/o/relevo.git', pluginRepoPrivate: false, hasCi: true,
    defaultBranch: 'main', labels: allLabels, branches: { base: true, release: true },
    protectionUnavailable: null, protection: { base: PROTECTED, release: PROTECTED }, pushScope: true, canApprove: false, secrets: ['ANTHROPIC_API_KEY'],
    ...over,
  };
}
const byId = (results, id) => results.find((r) => r.id === id);
const failing = (results) => results.filter((r) => r.status === 'fail').map((r) => r.id);

test('Scenario: Healthy repository - every check passes', () => {
  const results = runChecks(healthy());
  assert.deepEqual(failing(results), []);
  assert.deepEqual(results.filter((r) => r.status === 'warn'), []);
  assert.match(renderReport(results), /All green\./);
});

test('Scenario: A failing check - the report shows it as failed with the fix next to it', () => {
  const results = runChecks(healthy({ git: false }));
  const git = byId(results, 'tools.git');
  assert.equal(git.status, 'fail');
  assert.ok(git.fix);
  const text = renderReport(results);
  assert.match(text, /\[FAIL\] git is not installed\n {7}fix: /);
  assert.match(text, /1 check\(s\) failed\./);
});

test('Scenario: Invalid configuration - the check fails and shows the validation messages', () => {
  const results = runChecks(healthy({ config: null, configErrors: ['limits.run_max_cost is required'] }));
  assert.equal(byId(results, 'config.valid').status, 'fail');
  assert.match(byId(results, 'config.valid').message, /limits\.run_max_cost is required/);
  assert.equal(byId(runChecks(healthy({ configText: null, config: null })), 'config.valid').fix, 'run /relevo:init');
});

test('Scenario: OpenSpec missing - the install command and the Node.js requirement are shown', () => {
  const r = byId(runChecks(healthy({ openspec: null })), 'tools.openspec');
  assert.equal(r.status, 'fail');
  assert.match(r.fix, /npm install --global @fission-ai\/openspec/);
  assert.match(r.fix, /20\.19/);
  assert.equal(byId(runChecks(healthy({ node: '18.0.0' })), 'tools.node').status, 'fail');
  assert.ok(versionAtLeast('20.19.0', '20.19') && versionAtLeast('22.1.0', '20.19') && !versionAtLeast('20.18.9', '20.19'));
});

test('Scenario: Skill missing - think needs openspec-explore, grill-with-docs, grilling and domain-modeling', () => {
  const skills = { ...healthy().skills, 'domain-modeling': false };
  const r = byId(runChecks(healthy({ skills })), 'skills.domain-modeling');
  assert.equal(r.status, 'fail');
  assert.match(r.fix, /npx skills add mattpocock\/skills/);
  assert.match(byId(runChecks(healthy({ skills: { ...skills, 'openspec-explore': false } })), 'skills.openspec-explore').fix, /openspec init/);
});

test('the device bridge is only a warning, because only review needs it', () => {
  assert.equal(byId(runChecks(healthy({ adb: false })), 'tools.device-bridge').status, 'warn');
});

test('Scenario: Approvals dismissed on push - a failure explaining that the archive commit would dismiss the approval', () => {
  const results = runChecks(healthy({ protection: { base: { ...PROTECTED, dismissStale: true }, release: PROTECTED } }));
  const r = byId(results, 'repo.dismiss-stale.base');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /archive commit/);
});

test('Scenario: Misconfigured repository - automation allowed to approve pull requests', () => {
  const r = byId(runChecks(healthy({ canApprove: true })), 'repo.automation-approve');
  assert.equal(r.status, 'fail');
  assert.match(r.fix, /Allow GitHub Actions to create and approve pull requests/);
});

test('a branch without a required pull request fails; review.mode none does not need an approval', () => {
  const open = { ...PROTECTED, pullRequestRequired: false };
  assert.equal(byId(runChecks(healthy({ protection: { base: open, release: PROTECTED } })), 'repo.protection.base').status, 'fail');
  const noApprovals = { ...PROTECTED, approvals: 0 };
  assert.equal(byId(runChecks(healthy({ protection: { base: noApprovals, release: PROTECTED } })), 'repo.protection.base').status, 'fail');
  const solo = loadConfig(`${CONFIG_TEXT}review:\n  mode: none\n`).config;
  assert.equal(byId(runChecks(healthy({ config: solo, protection: { base: noApprovals, release: PROTECTED } })), 'repo.protection.base').status, 'pass');
});

test('Scenario: Protection unavailable - a warning that says what enforces approval meanwhile', () => {
  const results = runChecks(healthy({ protectionUnavailable: 'Upgrade to GitHub Pro', protection: {} }));
  const r = byId(results, 'repo.protection');
  assert.equal(r.status, 'warn');
  assert.match(r.fix, /written confirmation in `ship`/);
  assert.equal(byId(results, 'repo.protection.base'), undefined);
});

test('automation readiness: secret, workflows, objective CI and the private plugin repository', () => {
  assert.equal(byId(runChecks(healthy({ secrets: [] })), 'automation.secret').status, 'fail');
  assert.equal(byId(runChecks(healthy({ secrets: ['CLAUDE_CODE_OAUTH_TOKEN'] })), 'automation.secret').status, 'pass');
  assert.equal(byId(runChecks(healthy({ secrets: null })), 'automation.secret').status, 'warn');
  const wf = healthy().workflows;
  assert.equal(byId(runChecks(healthy({ workflows: { ...wf, 'relevo-go.yml': { present: false } } })), 'automation.workflow.relevo-go.yml').status, 'fail');
  assert.equal(byId(runChecks(healthy({ workflows: { ...wf, 'relevo-sla.yml': { present: false } } })), 'automation.workflow.relevo-sla.yml').status, 'warn');
  assert.equal(byId(runChecks(healthy({ workflows: { ...wf, 'relevo-go.yml': { present: true, enabled: false } } })), 'automation.workflow.relevo-go.yml').status, 'fail');
  assert.equal(byId(runChecks(healthy({ hasCi: false })), 'automation.ci').status, 'fail');
  const priv = byId(runChecks(healthy({ pluginRepoPrivate: true })), 'automation.plugin-clone');
  assert.equal(priv.status, 'fail');
  assert.match(priv.fix, /RELEVO_PLUGIN_TOKEN/);
});

test('missing labels, a missing base branch, an untracked OpenSpec root and a missing ignore line are failures with fixes', () => {
  const results = runChecks(healthy({ labels: allLabels.slice(2), branches: { base: false, release: true }, openspecRootTracked: false, evidenceIgnored: false }));
  assert.deepEqual(failing(results).sort(), ['evidence.ignored', 'openspec.root', 'repo.base-branch', 'repo.labels']);
  assert.match(byId(results, 'repo.labels').message, new RegExp(allLabels[0]));
});

test('without a repository or a sign-in, the GitHub checks are skipped with a warning', () => {
  const results = runChecks(healthy({ repo: null }));
  assert.equal(byId(results, 'repo.checks').status, 'warn');
  assert.equal(byId(results, 'repo.labels'), undefined);
});

test('ruleset patterns: exact branch, default branch, all branches and globs', () => {
  assert.ok(refMatches('refs/heads/dev', 'dev', 'main'));
  assert.ok(!refMatches('refs/heads/dev', 'main', 'main'));
  assert.ok(refMatches('~DEFAULT_BRANCH', 'main', 'main') && !refMatches('~DEFAULT_BRANCH', 'dev', 'main'));
  assert.ok(refMatches('~ALL', 'x', 'main'));
  assert.ok(refMatches('refs/heads/release/*', 'release/1.0', 'main'));
});

test('protection comes from active rulesets and from classic branch protection', () => {
  const ruleset = {
    target: 'branch', enforcement: 'active', conditions: { ref_name: { include: ['refs/heads/dev'], exclude: [] } },
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 2, dismiss_stale_reviews_on_push: true } }, { type: 'deletion' }, { type: 'non_fast_forward' }],
  };
  const a = summarizeProtection({ rulesets: [ruleset], branch: 'dev', defaultBranch: 'main' });
  assert.deepEqual(a, { protected: true, pullRequestRequired: true, approvals: 2, dismissStale: true, blocksDeletion: true, blocksForcePush: true });
  assert.equal(summarizeProtection({ rulesets: [ruleset], branch: 'main', defaultBranch: 'main' }).protected, false);
  assert.equal(summarizeProtection({ rulesets: [{ ...ruleset, enforcement: 'disabled' }], branch: 'dev', defaultBranch: 'main' }).protected, false);
  const classic = summarizeProtection({ classic: { required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: false } }, branch: 'dev', defaultBranch: 'main' });
  assert.equal(classic.pullRequestRequired, true);
  assert.equal(classic.approvals, 1);
});

test('Scenario: Running doctor - no write operation is performed', () => {
  const calls = [];
  const gh = readOnlyGh((args) => { calls.push(args); return '{}'; });
  gh(['api', 'repos/o/r']);
  gh(['api', '--paginate', '--slurp', 'repos/o/r/labels']);
  gh(['api', '-X', 'GET', 'repos/o/r']);
  assert.equal(calls.length, 3);
  for (const bad of [['api', '-X', 'POST', 'repos/o/r/labels'], ['api', '--method', 'DELETE', 'repos/o/r'], ['api', 'repos/o/r/labels', '-f', 'name=x'], ['api', 'repos/o/r', '--input', '-'], ['issue', 'edit', '1'], ['label', 'create', 'x']]) {
    assert.throws(() => gh(bad), /doctor is read-only/, bad.join(' '));
  }
  assert.equal(calls.length, 3);
});

test('gatherFacts reads tools, skills, files and the GitHub state through the injected probes', () => {
  const files = { 'relevo.yml': CONFIG_TEXT, 'openspec/config.yaml': 'schema: spec-driven\n', '.gitignore': 'node_modules\nevidence/\n',
    '.github/workflows/relevo-go.yml': '      plugin_marketplaces: https://github.com/o/relevo.git\n', '.github/workflows/ci.yml': 'name: ci\n', 'CLAUDE.md': '' };
  const dirs = new Set(['.claude/skills/openspec-explore', '.agents/skills/grilling']);
  const api = {
    'repos/o/r': { default_branch: 'main' },
    'repos/o/r/labels?per_page=100': [allLabels.map((name) => ({ name }))],
    'repos/o/r/branches/dev': {}, 'repos/o/r/branches/main': {},
    'repos/o/r/rulesets': [{ id: 7 }],
    'repos/o/r/rulesets/7': { target: 'branch', enforcement: 'active', conditions: { ref_name: { include: ['~ALL'], exclude: [] } }, rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 1 } }] },
    'repos/o/r/actions/permissions/workflow': { can_approve_pull_request_reviews: false },
    'repos/o/r/actions/secrets': { secrets: [{ name: 'ANTHROPIC_API_KEY' }] },
    'repos/o/r/actions/workflows': { workflows: [{ path: '.github/workflows/relevo-go.yml', state: 'active' }] },
    'repos/o/relevo': { private: true },
  };
  const f = gatherFacts({
    tool: (name, args) => { if (name === 'openspec') return '1.14.1\n'; if (name === 'adb') throw new Error('not found'); return name === 'git' && args[0] === 'ls-files' ? 'openspec/config.yaml\n' : 'ok'; },
    gh: (args) => { const path = args[args.length - 1]; if (!(path in api)) throw new Error(`HTTP 404 ${path}`); return JSON.stringify(api[path]); },
    exists: (p) => p in files || dirs.has(p), read: (p) => files[p], listDir: () => ['relevo-go.yml', 'ci.yml'],
    skillDirs: ['.claude/skills', '.agents/skills'], repo: 'o/r', platform: 'flutter-android',
  });
  assert.equal(f.openspec, '1.14.1');
  assert.equal(f.adb, false);
  assert.deepEqual(f.skills, { 'openspec-explore': true, 'grill-with-docs': false, grilling: true, 'domain-modeling': false });
  assert.equal(f.evidenceIgnored, true);
  assert.equal(f.hasCi, true);
  assert.equal(f.protection.base.approvals, 1);
  assert.equal(f.workflows['relevo-go.yml'].enabled, true);
  assert.equal(f.workflows['relevo-sla.yml'].present, false);
  assert.equal(f.pluginMarketplace, 'https://github.com/o/relevo.git');
  assert.equal(f.pluginRepoPrivate, true);
  assert.equal(f.openspecRootTracked, true);
});

test('Scenario: Agent tries to push outside feature branches - doctor warns when the push-scope ruleset is missing', () => {
  const r = byId(runChecks(healthy({ pushScope: false })), 'repo.push-scope');
  assert.equal(r.status, 'warn');
  assert.match(r.fix, /relevo-push-scope/);
  assert.equal(byId(runChecks(healthy()), 'repo.push-scope').status, 'pass');
  assert.equal(byId(runChecks(healthy({ protectionUnavailable: 'Upgrade', protection: {} })), 'repo.push-scope'), undefined);
});

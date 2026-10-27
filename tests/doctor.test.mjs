import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SKILLS, WORKFLOW_FILES, exitCode, gatherFacts, isVueWeb, reportHeader, playwrightFacts, pluginDeclaration, readOnlyGh, webHookDeclaration, WEB_HOOK_COMMAND, refMatches, renderReport, runChecks, summarizeProtection, versionAtLeast } from '../scripts/lib/doctor.mjs';
import { labelDefinitions } from '../scripts/lib/labels.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProfile } from '../scripts/lib/stack-profile.mjs';

const PLUGIN_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FLUTTER = resolveProfile({ platform: { stack: 'flutter' }, pluginRoot: PLUGIN_ROOT, read: (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } } }).profile;
/** The facts `doctor` gathers for one Flutter platform; `over` changes the tool and target-tool results. */
function flutterPlatform({ flutter = true, targets = { android: 'adb' }, available = { adb: true }, name = 'app', profile = FLUTTER } = {}) {
  return {
    name, stack: 'flutter', path: '.', targets: Object.keys(targets), profile, errors: [],
    tools: [{ tool: 'flutter', ok: flutter }],
    targetTools: Object.entries(targets).map(([target, tool]) => ({ target, tool, ok: tool === '' ? true : Boolean(available[tool]) })),
  };
}

const CONFIG_TEXT = 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a, persona-b]\nplatform: flutter-android\n';
const config = loadConfig(CONFIG_TEXT).config;
const allLabels = labelDefinitions({}).map((l) => l.name);
const PROTECTED = { protected: true, pullRequestRequired: true, approvals: 1, dismissStale: false, blocksDeletion: true, blocksForcePush: true };

function healthy(over = {}) {
  return {
    repo: 'o/r', node: '22.1.0', openspec: '1.14.1', git: true, gh: true, ghAuth: true, platformFacts: [flutterPlatform()], macos: false, roleSkills: null, skillLockDifferences: [],
    skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])),
    configText: CONFIG_TEXT, config, configErrors: [], rulesFileMissing: false,
    openspecRoot: true, openspecRootTracked: true, evidenceIgnored: true,
    workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, { present: true, enabled: true }])),
    pluginMarketplace: 'https://github.com/o/relevo.git', pluginRepoPrivate: false, pluginCheckouts: [], hasCi: true,
    defaultBranch: 'main', labels: allLabels, branches: { base: true, release: true },
    protectionUnavailable: null, protection: { base: PROTECTED, release: PROTECTED }, pushScope: true, secretScanning: { scanning: true, pushProtection: true }, canApprove: false, secrets: ['ANTHROPIC_API_KEY'],
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
  const bridge = (available) => byId(runChecks(healthy({ platformFacts: [flutterPlatform({ available })] })), 'tools.target.app.android');
  assert.equal(bridge({ adb: false }).status, 'warn');
  assert.match(bridge({ adb: false }).fix, /Android platform tools/);
  assert.equal(bridge({ adb: true }).status, 'pass');
});

test('Scenario: Flutter with Android and web - doctor checks flutter and adb, reports both targets and does not require xcrun', () => {
  const results = runChecks(healthy({ platformFacts: [flutterPlatform({ targets: { android: 'adb', web: '' }, available: { adb: true } })] }));
  assert.equal(byId(results, 'tools.flutter').status, 'pass');
  assert.equal(byId(results, 'tools.target.app.android').status, 'pass');
  assert.match(byId(results, 'tools.target.app.web').message, /needs no extra tool/);
  assert.equal(results.some((r) => /xcrun/.test(r.message)), false);
  assert.match(byId(results, 'platform.app.profile').message, /profile = default of the plugin/);
});

test('the toolchain of a stack is a failure with its install hint', () => {
  const r = byId(runChecks(healthy({ platformFacts: [flutterPlatform({ flutter: false })] })), 'tools.flutter');
  assert.equal(r.status, 'fail');
  assert.match(r.fix, /docs\.flutter\.dev/);
});

test('Scenario: iOS on Linux - a notice that iOS needs macOS, not a failure; on macOS the tool is checked', () => {
  const ios = (macos, available) => byId(runChecks(healthy({ macos, platformFacts: [flutterPlatform({ targets: { ios: 'xcrun' }, available })] })), 'tools.target.app.ios');
  assert.equal(ios(false, {}).status, 'note');
  assert.match(ios(false, {}).message, /only be built and reviewed on macOS/);
  assert.equal(ios(true, {}).status, 'warn');
  assert.equal(ios(true, { xcrun: true }).status, 'pass');
});

test('Scenario: Missing stack profile - doctor fails that check and says where to define one', () => {
  const missing = { name: 'api', stack: 'laravel', path: 'apps/api', targets: [], profile: null, errors: ['no profile for stack "laravel": define one'], tools: [], targetTools: [] };
  const r = byId(runChecks(healthy({ platformFacts: [missing] })), 'platform.api.profile');
  assert.equal(r.status, 'fail');
  assert.match(r.fix, /stacks\/laravel\.md in the plugin or \.relevo\/stacks\/laravel\.md in the repository/);
});

test('Scenario: A repository tries to remove a check - doctor warns that the value is ignored', () => {
  const profile = { ...FLUTTER, layers: ['plugin', 'repository'], ignored: [{ key: 'commands.test', value: 'echo skipped', kept: 'flutter test' }] };
  const results = runChecks(healthy({ platformFacts: [flutterPlatform({ profile })] }));
  assert.match(byId(results, 'platform.app.profile').message, /default of the plugin \+ \.relevo\/stacks\/flutter\.md/);
  const w = byId(results, 'platform.app.ignored.commands.test');
  assert.equal(w.status, 'warn');
  assert.match(w.fix, /platforms\.app\.checks/);
});

test('Scenario: Skill left out - doctor shows it with the reason; a skill with allowed scripts is a notice', () => {
  const roleSkills = { app: { dev: [{ name: 'a', left_out: true, reason: 'not on the base branch' }, { name: 'b', path: '.agents/skills/b/SKILL.md', scripts: true, bytes: 100 }], qa: [], issue: [], review: [] } };
  const results = runChecks(healthy({ roleSkills }));
  assert.match(byId(results, 'skills.role.app.dev.a').message, /left out: not on the base branch/);
  assert.equal(byId(results, 'skills.role.app.dev.a').status, 'warn');
  assert.equal(byId(results, 'skills.scripts.app.dev.b').status, 'pass');
});

test('Scenario: Large skill set - 30 KB warns, 10 KB does not', () => {
  const skills = (bytes) => ({ app: { dev: [{ name: 'a', path: 'p', scripts: false, bytes }], qa: [], issue: [], review: [] } });
  const big = byId(runChecks(healthy({ roleSkills: skills(30 * 1024) })), 'skills.size.app.dev');
  assert.equal(big.status, 'warn');
  assert.match(big.message, /30 KB/);
  assert.equal(byId(runChecks(healthy({ roleSkills: skills(10 * 1024) })), 'skills.size.app.dev'), undefined);
});

test('Scenario: Altered skill - doctor warns and names the skill', () => {
  const r = byId(runChecks(healthy({ skillLockDifferences: ['laravel-best-practices'] })), 'skills.lock.laravel-best-practices');
  assert.equal(r.status, 'warn');
});

test('Scenario: Missing file in the list - doctor warns and names it', () => {
  const r = byId(runChecks(healthy({ rulesFileMissing: true, rulesFilesMissing: ['docs/backend.md'] })), 'config.rules-file');
  assert.match(r.message, /"docs\/backend\.md"/);
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
  assert.equal(byId(runChecks(healthy({ secrets: [] })), 'automation.secret').status, 'warn');
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

test('Scenario: Repository set up earlier - doctor fails the labels check naming relevo:urgent and says init creates it', () => {
  const results = runChecks(healthy({ labels: allLabels.filter((n) => n !== 'relevo:urgent') }));
  assert.deepEqual(failing(results), ['repo.labels']);
  const labels = byId(results, 'repo.labels');
  assert.match(labels.message, /relevo:urgent/);
  assert.doesNotMatch(labels.message, /relevo:ready|relevo:ship/);
  assert.match(labels.fix, /\/relevo:init/);
});

test('Scenario: Renamed label - doctor checks for the name given in labels.urgent', () => {
  const text = `${CONFIG_TEXT}labels:\n  urgent: prio:now\n`;
  const renamed = loadConfig(text).config;
  const missing = runChecks(healthy({ configText: text, config: renamed, labels: allLabels }));
  assert.match(byId(missing, 'repo.labels').message, /prio:now/);
  const present = runChecks(healthy({ configText: text, config: renamed, labels: [...allLabels.filter((n) => n !== 'relevo:urgent'), 'prio:now'] }));
  assert.equal(byId(present, 'repo.labels').status, 'pass');
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
  assert.deepEqual(a, { protected: true, pullRequestRequired: true, approvals: 2, dismissStale: true, lastPushApproval: false, requiredChecks: false, blocksDeletion: true, blocksForcePush: true });
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
    'repos/o/r/contents/.github/workflows?ref=main': [{ name: 'relevo-go.yml' }, { name: 'ci.yml' }],
    'repos/o/r/contents/.github/workflows/relevo-go.yml?ref=main': { content: Buffer.from(files['.github/workflows/relevo-go.yml']).toString('base64') },
  };
  const f = gatherFacts({
    tool: (name, args) => { if (name === 'openspec') return '1.14.1\n'; if (name === 'adb') throw new Error('not found'); return name === 'git' && args[0] === 'ls-files' ? 'openspec/config.yaml\n' : 'ok'; },
    gh: (args) => { const path = args[args.length - 1]; if (!(path in api)) throw new Error(`HTTP 404 ${path}`); return JSON.stringify(api[path]); },
    exists: (p) => p in files || dirs.has(p), read: (p) => files[p], listDir: () => ['relevo-go.yml', 'ci.yml'],
    skillDirs: ['.claude/skills', '.agents/skills'], repo: 'o/r',
  });
  assert.equal(f.openspec, '1.14.1');
  assert.deepEqual(f.platformFacts[0].tools, [{ tool: 'flutter', ok: true }]);
  assert.deepEqual(f.platformFacts[0].targetTools, [{ target: 'android', tool: 'adb', ok: false }], 'adb is missing in this machine');
  assert.deepEqual(f.platformFacts[0].profile.layers, ['plugin']);
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

test('secret scanning and push protection are checked by reading them back, as a warning', () => {
  assert.equal(byId(runChecks(healthy()), 'repo.secret-scanning').status, 'pass');
  const off = byId(runChecks(healthy({ secretScanning: { scanning: false, pushProtection: false } })), 'repo.secret-scanning');
  assert.equal(off.status, 'warn');
  assert.match(off.message, /off/);
  assert.equal(byId(runChecks(healthy({ secretScanning: null })), 'repo.secret-scanning'), undefined);
});

test('Scenario: Workflows from before the package - the ones that clone the plugin repository are told to be replaced', () => {
  const bad = byId(runChecks(healthy({ pluginCheckouts: [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: false }, { file: 'relevo-sla.yml', repo: 'o/relevo', hasToken: true }] })), 'automation.plugin-layout');
  assert.equal(bad.status, 'fail');
  assert.match(bad.message, /relevo-queue\.yml, relevo-sla\.yml clone the plugin repository/);
  assert.match(bad.fix, /published package at a pinned version/);
  assert.equal(byId(runChecks(healthy({ pluginCheckouts: [] })), 'automation.plugin-layout'), undefined);
});

test('Scenario: Pinned version - a workflow without a pin fails, a different pin only warns, the same pin is silent', () => {
  const run = (pluginPins, pluginVersion = '0.3.0') => runChecks(healthy({ pluginPins, pluginVersion, pluginCheckouts: [] }));
  const none = byId(run({ 'relevo-go.yml': null, 'relevo-sla.yml': '0.3.0' }), 'automation.plugin-pin');
  assert.equal(none.status, 'fail');
  assert.match(none.message, /relevo-go\.yml/);
  assert.ok(!none.message.includes('relevo-sla.yml'));
  const old = byId(run({ 'relevo-go.yml': '0.2.0' }), 'automation.plugin-version');
  assert.equal(old.status, 'warn');
  assert.match(old.message, /relevo-go\.yml \(0\.2\.0\).*0\.3\.0/);
  assert.equal(byId(run({ 'relevo-go.yml': '0.3.0' }), 'automation.plugin-version'), undefined);
  assert.equal(byId(run({ 'relevo-go.yml': '0.3.0' }), 'automation.plugin-pin'), undefined);
});

test('Scenario: Incomplete installation - a plugin that lost a folder fails and says how to reinstall', () => {
  const bad = byId(runChecks(healthy({ pluginFolders: ['scripts', 'stacks'] })), 'plugin.install');
  assert.equal(bad.status, 'fail');
  assert.match(bad.message, /lacks scripts, stacks/);
  assert.match(bad.fix, /relevo install/);
  assert.equal(byId(runChecks(healthy({ pluginFolders: [], pluginVersion: '0.3.0' })), 'plugin.install').status, 'pass');
});

test('Scenario: Private plugin repository and no secret - the credential secret must exist', () => {
  const missing = byId(runChecks(healthy({ pluginRepoPrivate: true, secrets: ['ANTHROPIC_API_KEY'] })), 'automation.plugin-secret');
  assert.equal(missing.status, 'fail');
  assert.match(missing.fix, /RELEVO_PLUGIN_TOKEN/);
  assert.match(missing.fix, /read-only/);
  assert.match(missing.fix, /organization/);
});

test('Scenario: Private plugin repository and the secret exists', () => {
  const ok = byId(runChecks(healthy({ pluginRepoPrivate: true, secrets: ['ANTHROPIC_API_KEY', 'RELEVO_PLUGIN_TOKEN'] })), 'automation.plugin-secret');
  assert.equal(ok.status, 'pass');
});

test('Scenario: Public plugin repository - no plugin-secret check, with or without the secret', () => {
  assert.equal(byId(runChecks(healthy({ pluginRepoPrivate: false, secrets: ['ANTHROPIC_API_KEY'] })), 'automation.plugin-secret'), undefined);
  assert.equal(byId(runChecks(healthy({ pluginRepoPrivate: false, secrets: ['ANTHROPIC_API_KEY', 'RELEVO_PLUGIN_TOKEN'] })), 'automation.plugin-secret'), undefined);
});

test('Scenario: Visibility or secrets cannot be read - no plugin-secret check, the unreadable-secrets warning stays', () => {
  assert.equal(byId(runChecks(healthy({ pluginRepoPrivate: null, secrets: ['ANTHROPIC_API_KEY'] })), 'automation.plugin-secret'), undefined);
  const results = runChecks(healthy({ pluginRepoPrivate: true, secrets: null }));
  assert.equal(byId(results, 'automation.plugin-secret'), undefined);
  assert.equal(byId(results, 'automation.secret').status, 'warn');
});

test('a failed read of the branch rules is a warning, never a false failure', () => {
  const results = runChecks(healthy({ protectionError: 'gh: HTTP 502', protection: { base: { pullRequestRequired: false }, release: { pullRequestRequired: false } } }));
  assert.equal(byId(results, 'repo.protection').status, 'warn');
  assert.match(byId(results, 'repo.protection').message, /HTTP 502/);
  assert.deepEqual(failing(results), []);
  assert.equal(byId(results, 'repo.push-scope'), undefined);
});

test('a plugin_marketplaces URL that carries a credential is not reported as unreachable, and its repository is still found', () => {
  const files = { 'relevo.yml': CONFIG_TEXT, '.github/workflows/relevo-go.yml': '          plugin_marketplaces: https://x-access-token:${{ secrets.RELEVO_PLUGIN_TOKEN }}@github.com/o/relevo.git\n' };
  const api = {
    'repos/o/r': { default_branch: 'main' }, 'repos/o/relevo': { private: true },
    'repos/o/r/contents/.github/workflows?ref=main': [{ name: 'relevo-go.yml' }],
    'repos/o/r/contents/.github/workflows/relevo-go.yml?ref=main': { content: Buffer.from(files['.github/workflows/relevo-go.yml']).toString('base64') },
  };
  const f = gatherFacts({
    tool: () => 'ok', gh: (args) => { const path = args[args.length - 1]; if (!(path in api)) throw new Error(`HTTP 404 ${path}`); return JSON.stringify(api[path]); },
    exists: (p) => p in files, read: (p) => files[p], listDir: () => [], skillDirs: [], repo: 'o/r',
  });
  assert.equal(f.pluginMarketplaceHasToken, true);
  assert.equal(f.pluginRepoPrivate, true);
  assert.equal(byId(runChecks({ ...healthy(), ...f, config: healthy().config }), 'automation.plugin-clone'), undefined);
});

function probes({ localFiles, remote, files = {} }) {
  const api = {
    'repos/o/r': { default_branch: 'main' },
    'repos/o/r/contents/.github/workflows?ref=main': remote === null ? null : Object.keys(remote).map((name) => ({ name })),
    ...Object.fromEntries(Object.entries(remote ?? {}).map(([n, t]) => [`repos/o/r/contents/.github/workflows/${n}?ref=main`, { content: Buffer.from(t).toString('base64') }])),
    'repos/o/relevo': { private: true },
  };
  const all = { 'relevo.yml': CONFIG_TEXT, ...files, ...Object.fromEntries(Object.entries(localFiles).map(([n, t]) => [`.github/workflows/${n}`, t])) };
  return {
    tool: () => 'ok',
    gh: (args) => {
      const path = args[args.length - 1];
      if (!(path in api) || api[path] === null) throw new Error(`HTTP 404 ${path}`);
      return JSON.stringify(api[path]);
    },
    exists: (p) => p in all, read: (p) => all[p], listDir: () => Object.keys(localFiles), skillDirs: [], repo: 'o/r',
  };
}
const CHECKOUT = (token) => `      - uses: actions/checkout@v4\n        with:\n          repository: o/relevo\n          ref: main\n          path: .relevo-plugin\n${token ? '          token: ${{ secrets.RELEVO_PLUGIN_TOKEN }}\n' : ''}\n`;

test('Scenario: Workflow fixed only in the working copy - doctor judges what is on the default branch, not the local file (the old layout is judged by the checkout)', () => {
  const f = gatherFacts(probes({ localFiles: { 'relevo-queue.yml': CHECKOUT(true) }, remote: { 'relevo-queue.yml': CHECKOUT(false) } }));
  assert.equal(f.workflowSource, 'default branch (main)');
  assert.deepEqual(f.pluginCheckouts, [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: false }]);
  const bad = byId(runChecks({ ...healthy(), ...f, config }), 'automation.plugin-layout');
  assert.equal(bad.status, 'fail');
  assert.match(bad.message, /relevo-queue\.yml/);
});

test('Scenario: Workflow only in the working copy - a failure that says it must be pushed to the default branch', () => {
  const f = gatherFacts(probes({ localFiles: { 'relevo-go.yml': 'name: go\n', 'relevo-sla.yml': 'name: sla\n' }, remote: {} }));
  assert.equal(f.workflows['relevo-go.yml'].present, false);
  assert.equal(f.workflows['relevo-go.yml'].local, true);
  assert.equal(f.workflows['relevo-go.yml'].remote, false);
  const results = runChecks({ ...healthy(), ...f, config });
  const go = byId(results, 'automation.workflow.relevo-go.yml');
  assert.equal(go.status, 'fail');
  assert.match(go.message, /only in your working copy, not on the default branch/);
  assert.match(go.fix, /through a pull request if the branch is protected/);
  assert.equal(byId(results, 'automation.workflow.relevo-sla.yml').status, 'warn');
});

test('a workflow on the default branch counts even when the working copy does not have it', () => {
  const f = gatherFacts(probes({ localFiles: {}, remote: { 'relevo-go.yml': 'name: go\n', 'ci.yml': 'name: ci\n' } }));
  assert.equal(f.workflows['relevo-go.yml'].present, true);
  assert.equal(f.workflows['relevo-go.yml'].local, false);
  assert.equal(f.hasCi, true);
});

test('when the default branch cannot be read, doctor falls back to the working copy', () => {
  const p = probes({ localFiles: { 'relevo-go.yml': 'name: go\n' }, remote: null });
  const failing = { ...p, gh: (args) => { const path = args[args.length - 1]; if (path.includes('/contents/')) throw new Error('HTTP 502'); return p.gh(args); } };
  const f = gatherFacts(failing);
  assert.equal(f.workflowSource, 'working copy');
  assert.equal(f.workflows['relevo-go.yml'].present, true);
});

// ---------- skills that only the person can launch

const FM_RESERVED = '---\nname: grill-with-docs\ndescription: Grill the user\ndisable-model-invocation: true\n---\n\n# body\n';
const FM_OPEN = '---\nname: grilling\ndescription: Grill the user\n---\n\n# disable-model-invocation: true in the body does not count\n';
function skillFacts(files, dirs = ['.claude/skills', '.agents/skills']) {
  return gatherFacts({
    tool: () => 'ok', gh: () => '{}', exists: (p) => p in files, read: (p) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, listDir: () => [],
    skillDirs: dirs, repo: null,
  });
}

test('Scenario: Skill reserved for the person - doctor passes the check with a notice that it is launched by hand', () => {
  const f = skillFacts({
    '.claude/skills/grill-with-docs': true, '.claude/skills/grill-with-docs/SKILL.md': FM_RESERVED,
    '.claude/skills/grilling': true, '.claude/skills/grilling/SKILL.md': FM_OPEN,
    '.claude/skills/domain-modeling': true, '.claude/skills/domain-modeling/SKILL.md': FM_OPEN,
    '.claude/skills/openspec-explore': true, '.claude/skills/openspec-explore/SKILL.md': FM_OPEN,
  });
  assert.deepEqual(f.manualOnlySkills, ['grill-with-docs']);
  const results = runChecks({ ...healthy(), skills: f.skills, manualOnlySkills: f.manualOnlySkills });
  const r = byId(results, 'skills.grill-with-docs');
  assert.equal(r.status, 'note');
  assert.match(r.message, /reserved for you, so run \/grill-with-docs by hand/);
  assert.equal(byId(results, 'skills.grilling').message, 'skill grilling is installed');
  assert.deepEqual(failing(results), []);
});

test('only the frontmatter counts, an unreadable file counts as invocable, and a missing skill still fails', () => {
  const f = skillFacts({ '.agents/skills/grill-with-docs': true }); // folder with no readable SKILL.md
  assert.equal(f.skills['grill-with-docs'], true);
  assert.deepEqual(f.manualOnlySkills, []);
  const only = skillFacts({ '.claude/skills/grilling': true, '.claude/skills/grilling/SKILL.md': FM_OPEN });
  assert.deepEqual(only.manualOnlySkills, [], 'a line in the body is not the frontmatter');
  const results = runChecks({ ...healthy(), skills: { ...healthy().skills, 'domain-modeling': false }, manualOnlySkills: ['grill-with-docs'] });
  assert.equal(byId(results, 'skills.domain-modeling').status, 'fail');
  assert.equal(byId(results, 'skills.grill-with-docs').status, 'note');
});

test('a skill found in the second folder is read from that folder', () => {
  const f = skillFacts({ '.agents/skills/grill-with-docs': true, '.agents/skills/grill-with-docs/SKILL.md': FM_RESERVED });
  assert.deepEqual(f.manualOnlySkills, ['grill-with-docs']);
});

test('gatherFacts resolves the role skills from the base branch and compares the skills lock', () => {
  const files = {
    'relevo.yml': 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: flutter\n    targets: [android, web]\n',
    '.relevo/stacks/flutter.md': '---\nstack: flutter\nskills:\n  dev: [good, mine]\n---\nOur rule.\n',
    '.agents/skills/good/SKILL.md': '---\nname: good\n---\nbody of the skill\n',
    'skills-lock.json': JSON.stringify({ version: 1, skills: { good: { computedHash: 'not-the-real-hash' } } }),
  };
  const tree = { '.agents/skills/good': '100644 blob abc\t.agents/skills/good/SKILL.md' };
  const f = gatherFacts({
    tool: () => 'ok',
    gh: () => { throw new Error('no network'); },
    exists: (p) => p in files || p === '.agents/skills/good',
    read: (p) => files[p], listDir: () => [], skillDirs: [],
    git: (args) => {
      if (args[0] === 'rev-parse') return 'abc\n';
      if (args[0] === 'ls-tree') return tree[args[4]] ?? '';
      if (args[0] === 'show') return files['.agents/skills/good/SKILL.md'];
      throw new Error(`unexpected ${args.join(' ')}`);
    },
    readFolder: () => [{ path: 'SKILL.md', content: Buffer.from('body of the skill\n') }],
    repo: 'o/r',
  });
  assert.deepEqual(f.platformFacts[0].profile.layers, ['plugin', 'repository']);
  assert.deepEqual(f.platformFacts[0].targetTools.map((t) => t.target), ['android', 'web']);
  const dev = f.roleSkills.app.dev;
  assert.equal(dev[0].path, '.agents/skills/good/SKILL.md');
  assert.ok(dev[0].bytes > 0);
  assert.deepEqual(dev[1], { name: 'mine', left_out: true, reason: 'not on the base branch' });
  assert.deepEqual(f.skillLockDifferences, ['good']);
});

test('gatherFacts reports an invalid target of the profile and skips the skills when the base branch is unknown', () => {
  const files = { 'relevo.yml': 'limits:\n  run_max_cost: 5\nplatforms:\n  app:\n    stack: flutter\n    targets: [tv]\n' };
  const f = gatherFacts({ tool: () => 'ok', gh: () => { throw new Error('x'); }, exists: (p) => p in files, read: (p) => files[p], listDir: () => [], skillDirs: [], repo: null });
  assert.equal(f.config, null);
  assert.match(f.configErrors.join(' '), /unknown target "tv"/);
  assert.deepEqual(f.platformFacts, []);
  assert.equal(f.roleSkills, null);
});

// ---------- linked repositories

const link = (repo, over = {}) => ({ repo, reachable: true, private: false, ...over });

test('Scenario: Private linked repository without the secret - doctor fails and says what token to create', () => {
  const results = runChecks(healthy({ links: [link('acme/api', { private: true })], secrets: ['ANTHROPIC_API_KEY'] }));
  const r = byId(results, 'links.secret');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /acme\/api is private and there is no RELEVO_LINKS_TOKEN/);
  assert.match(r.fix, /read access to issues and pull requests.*RELEVO_LINKS_TOKEN/);
  assert.equal(byId(results, 'links.acme/api').status, 'pass');
});

test('Scenario: Public linked repositories - doctor warns that no secret is needed yet', () => {
  const r = byId(runChecks(healthy({ links: [link('acme/api'), link('acme/design')], secrets: ['ANTHROPIC_API_KEY'] })), 'links.secret');
  assert.equal(r.status, 'warn');
  assert.match(r.message, /every linked repository is public/);
});

test('the secret present passes, whether the linked repositories are private or not', () => {
  assert.equal(byId(runChecks(healthy({ links: [link('acme/api', { private: true })], secrets: ['RELEVO_LINKS_TOKEN'] })), 'links.secret').status, 'pass');
  assert.equal(byId(runChecks(healthy({ links: [link('acme/api')], secrets: ['RELEVO_LINKS_TOKEN'] })), 'links.secret').status, 'pass');
});

test('Scenario: No links - doctor does not mention the secret or any link', () => {
  const results = runChecks(healthy({ links: [] }));
  assert.equal(results.some((r) => r.id.startsWith('links.')), false);
  assert.equal(results.some((r) => /RELEVO_LINKS_TOKEN/.test(r.message)), false);
});

test('an unreachable link fails with the name to check; an unreadable secrets list is a warning', () => {
  const results = runChecks(healthy({ links: [link('acme/typo', { reachable: false, private: null })], secrets: ['RELEVO_LINKS_TOKEN'] }));
  assert.equal(byId(results, 'links.acme/typo').status, 'fail');
  assert.match(byId(results, 'links.acme/typo').fix, /check the name in links/);
  assert.equal(byId(runChecks(healthy({ links: [link('acme/api')], secrets: null })), 'links.secret').status, 'warn');
});

test('gatherFacts reads each linked repository once: reachable or not, private or public', () => {
  const files = { 'relevo.yml': 'limits:\n  run_max_cost: 5\nlinks: [acme/api, acme/design, acme/typo]\n' };
  const api = {
    'repos/o/r': { default_branch: 'main' },
    'repos/o/r/actions/secrets': { secrets: [{ name: 'RELEVO_LINKS_TOKEN' }] },
    'repos/acme/api': { private: true },
    'repos/acme/design': { private: false },
  };
  const asked = [];
  const f = gatherFacts({
    tool: () => 'ok',
    gh: (args) => { const path = args[args.length - 1]; asked.push(path); if (!(path in api)) throw new Error('HTTP 404'); return JSON.stringify(api[path]); },
    exists: (p) => p in files, read: (p) => files[p], listDir: () => [], skillDirs: [], repo: 'o/r',
  });
  assert.deepEqual(f.links, [{ repo: 'acme/api', reachable: true, private: true }, { repo: 'acme/design', reachable: true, private: false }, { repo: 'acme/typo', reachable: false, private: null }]);
  assert.equal(asked.filter((p) => p === 'repos/acme/api').length, 1);
});

// ---------- where go builds

test('Scenario: Subscription with several agents - doctor warns that the quota is shared and suggests 1', () => {
  const many = { ...config, limits: { ...config.limits, concurrent_agents: 3 } };
  const results = runChecks(healthy({ secrets: ['CLAUDE_CODE_OAUTH_TOKEN'], config: many }));
  assert.match(byId(results, 'execution.credential').message, /subscription token: run_max_cost is only a notional ceiling/);
  assert.equal(byId(results, 'execution.concurrency').status, 'warn');
  assert.match(byId(results, 'execution.concurrency').fix, /set limits\.concurrent_agents to 1/);
  assert.match(byId(results, 'execution.policy').message, /read the current Anthropic terms on automated use of a subscription token/);
  const one = { ...config, limits: { ...config.limits, concurrent_agents: 1 } };
  assert.equal(byId(runChecks(healthy({ secrets: ['CLAUDE_CODE_OAUTH_TOKEN'], config: one })), 'execution.concurrency'), undefined);
});

test('API key - run_max_cost is a real ceiling, and neither the policy reminder nor the quota warning appears', () => {
  const results = runChecks(healthy({ secrets: ['ANTHROPIC_API_KEY'] }));
  assert.match(byId(results, 'execution.credential').message, /API key: run_max_cost is a real ceiling/);
  assert.equal(byId(results, 'execution.policy'), undefined);
  assert.equal(byId(results, 'execution.concurrency'), undefined);
});

test('Both credentials - a warning that says which one the workflow uses when its text is known', () => {
  const workflows = Object.fromEntries(WORKFLOW_FILES.map((f) => [f, { present: true, enabled: true }]));
  workflows['relevo-go.yml'].text = 'with:\n  claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}\n  # anthropic_api_key: x\n';
  const r = byId(runChecks(healthy({ secrets: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'], workflows })), 'execution.credential');
  assert.equal(r.status, 'warn');
  assert.match(r.message, /both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN exist; the workflow uses the subscription token/);
  assert.equal(byId(runChecks(healthy({ secrets: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'] })), 'execution.credential').status, 'warn');
});

test('Scenario: No credential - the go workflow is installed, so doctor warns that a ready label only leaves a comment', () => {
  const results = runChecks(healthy({ secrets: [] }));
  const secret = byId(results, 'automation.secret');
  assert.equal(secret.status, 'warn');
  assert.match(secret.message, /the cloud cannot build: a ready label only leaves a comment that says to run \/relevo:go/);
  assert.match(byId(results, 'execution.credential').message, /no model credential: the cloud cannot build/);
  const noWorkflow = healthy({ secrets: [], workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, { present: false, enabled: null }])) });
  assert.match(byId(runChecks(noWorkflow), 'execution.credential').message, /no go workflow: go builds on machines only/);
});

test('Scenario: Cloud paused - the variable off is reported, and the other states are described', () => {
  assert.match(byId(runChecks(healthy({ cloudVariable: 'off' })), 'execution.cloud').message, /the cloud is paused \(RELEVO_CLOUD_GO is off\)/);
  assert.match(byId(runChecks(healthy({ cloudVariable: ' OFF ' })), 'execution.cloud').message, /paused/);
  assert.match(byId(runChecks(healthy({ cloudVariable: null })), 'execution.cloud').message, /the cloud builds ready issues \(set the repository variable RELEVO_CLOUD_GO to off to pause it\)/);
  const noWorkflow = healthy({ workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, { present: false, enabled: null }])) });
  assert.match(byId(runChecks(noWorkflow), 'execution.cloud').message, /not installed: ready issues are built on machines/);
});

test('a healthy repository with an API key and no variable has no new warning, and an unreadable secrets list adds nothing', () => {
  assert.deepEqual(runChecks(healthy()).filter((r) => r.status === 'warn'), []);
  assert.equal(runChecks(healthy({ secrets: null })).some((r) => r.id.startsWith('execution.')), false);
});

test('gatherFacts reads the variable that pauses the cloud, and keeps the text of the workflows for the credential line', () => {
  const files = { 'relevo.yml': 'limits:\n  run_max_cost: 5\n', '.github/workflows/relevo-go.yml': 'x: 1\n  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n' };
  const api = {
    'repos/o/r': { default_branch: 'main' },
    'repos/o/r/actions/variables/RELEVO_CLOUD_GO': { name: 'RELEVO_CLOUD_GO', value: 'off' },
    'repos/o/r/contents/.github/workflows?ref=main': [{ name: 'relevo-go.yml' }],
    'repos/o/r/contents/.github/workflows/relevo-go.yml?ref=main': { content: Buffer.from(files['.github/workflows/relevo-go.yml']).toString('base64') },
  };
  const f = gatherFacts({
    tool: () => 'ok',
    gh: (args) => { const path = args[args.length - 1]; if (!(path in api)) throw new Error('HTTP 404'); return JSON.stringify(api[path]); },
    exists: (p) => p in files, read: (p) => files[p], listDir: () => ['relevo-go.yml'], skillDirs: [], repo: 'o/r',
  });
  assert.equal(f.cloudVariable, 'off');
  assert.match(f.workflows['relevo-go.yml'].text, /anthropic_api_key/);
});

// ---------- review autopilot

function autopilotFacts({ mode, platforms, files = {}, playwright = true }) {
  const text = `limits:\n  run_max_cost: 5\nreview:\n  autopilot: ${mode}\nplatforms:\n${platforms}`;
  const all = { 'relevo.yml': text, ...files };
  return gatherFacts({
    tool: (name, args) => {
      if (name === 'node' && args[0] === '-e' && /playwright/.test(args[1]) && !playwright) throw new Error('Cannot find module');
      return 'ok';
    },
    gh: () => { throw new Error('no network'); },
    exists: (p) => p in all, read: (p) => all[p], listDir: () => [], skillDirs: [], repo: null,
  });
}
const AP_FLUTTER = '  app:\n    stack: flutter\n    targets: [android]\n';
const AP_VUE = '  site:\n    stack: vue\n    path: apps/site\n    targets: [web]\n';
const autopilotChecks = (f) => runChecks({ ...healthy(), ...f, config: f.config }).filter((r) => r.id.startsWith('autopilot.'));

test('Scenario: Flutter without the driver entry point - doctor warns and says to add it with enableFlutterDriverExtension()', () => {
  const f = autopilotFacts({ mode: 'precheck', platforms: AP_FLUTTER, files: { 'pubspec.yaml': 'dev_dependencies:\n  flutter_driver:\n    sdk: flutter\n' } });
  const results = autopilotChecks(f);
  const entry = results.find((r) => r.id === 'autopilot.app.entrypoint');
  assert.equal(entry.status, 'warn');
  assert.match(entry.fix, /enableFlutterDriverExtension\(\)/);
  assert.equal(results.find((r) => r.id === 'autopilot.app.dependency').status, 'pass');
});

test('a Flutter platform with the entry point and the dependency passes both, and a missing dependency warns', () => {
  const ok = autopilotChecks(autopilotFacts({ mode: 'verify', platforms: AP_FLUTTER, files: { 'lib/main_driver.dart': '', 'pubspec.yaml': 'dev_dependencies:\n  flutter_driver:\n    sdk: flutter\n' } }));
  assert.deepEqual(ok.map((r) => r.status), ['pass', 'pass']);
  const missing = autopilotChecks(autopilotFacts({ mode: 'verify', platforms: AP_FLUTTER, files: { 'lib/main_driver.dart': '', 'pubspec.yaml': 'dependencies:\n  flutter:\n    sdk: flutter\n' } }));
  const dep = missing.find((r) => r.id === 'autopilot.app.dependency');
  assert.equal(dep.status, 'warn');
  assert.match(dep.fix, /flutter_driver/);
});

test('the entry point is looked for inside the folder of the platform', () => {
  const platforms = '  app:\n    stack: flutter\n    path: apps/mobile\n    targets: [android]\n';
  const f = autopilotFacts({ mode: 'precheck', platforms, files: { 'apps/mobile/lib/main_driver.dart': '', 'apps/mobile/pubspec.yaml': 'dev_dependencies:\n  flutter_driver:\n    sdk: flutter\n' } });
  assert.deepEqual(autopilotChecks(f).map((r) => r.status), ['pass', 'pass']);
});

test('Scenario: Vue without Playwright - doctor warns, names /relevo:init and gives the install command of the platform folder', () => {
  const results = autopilotChecks(autopilotFacts({ mode: 'verify', platforms: AP_VUE, playwright: false }));
  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'warn');
  assert.match(results[0].fix, /run \/relevo:init/);
  assert.match(results[0].fix, /`cd apps\/site && npm install -D playwright && npx playwright install chromium`/);
  assert.equal(autopilotChecks(autopilotFacts({ mode: 'verify', platforms: AP_VUE, playwright: true }))[0].status, 'pass');
});

test('a stack without a driven review says so instead of staying silent', () => {
  const r = autopilotChecks(autopilotFacts({ mode: 'precheck', platforms: '  api:\n    stack: laravel\n    path: apps/api\n' }));
  assert.equal(r[0].status, 'warn');
  assert.match(r[0].message, /driven review of the stack laravel .* is not available/);
});

test('Scenario: Autopilot off - doctor adds no autopilot check', () => {
  const f = autopilotFacts({ mode: 'off', platforms: `${AP_FLUTTER}${AP_VUE}` });
  assert.equal(f.autopilot, null);
  assert.deepEqual(autopilotChecks(f), []);
});

// ---------- Vue and Laravel profiles

function stackFacts(platforms, missing = []) {
  const text = `limits:\n  run_max_cost: 5\nplatforms:\n${platforms}`;
  return gatherFacts({
    tool: (name) => {
      if (missing.includes(name)) throw new Error(`${name}: not found`);
      return 'ok';
    },
    gh: () => { throw new Error('no network'); },
    exists: (p) => p === 'relevo.yml', read: (p) => text, listDir: () => [], skillDirs: [], repo: null,
  });
}
const stackChecks = (f) => runChecks({ ...healthy(), ...f, config: f.config });
const TW = '  web:\n    stack: vue\n    path: apps/web\n    targets: [web]\n';
const TA = '  api:\n    stack: laravel\n    path: apps/api\n';

test('Scenario: Vue and Laravel - the shipped profiles resolve, their tools are probed and all pass when present', () => {
  const f = stackFacts(`${TW}${TA}`);
  assert.deepEqual(f.platformFacts.map((e) => [e.name, e.profile !== null]), [['web', true], ['api', true]]);
  assert.deepEqual(f.platformFacts[0].tools.map((t) => t.tool), ['node', 'npm']);
  assert.deepEqual(f.platformFacts[1].tools.map((t) => t.tool), ['php', 'composer']);
  const results = stackChecks(f);
  assert.equal(byId(results, 'platform.web.profile').status, 'pass');
  assert.match(byId(results, 'platform.api.profile').message, /default of the plugin/);
  ['tools.node', 'tools.npm', 'tools.php', 'tools.composer'].forEach((id) => assert.equal(byId(results, id).status, 'pass', id));
  assert.equal(byId(results, 'tools.target.web.web').status, 'pass', 'the web target needs no extra tool');
});

test('a missing npm or composer fails naming the platform and the install hint', () => {
  const npm = byId(stackChecks(stackFacts(TW, ['npm'])), 'tools.npm');
  assert.equal(npm.status, 'fail');
  assert.match(npm.message, /npm is not installed \(platform web, stack vue\)/);
  assert.match(npm.fix, /Node\.js, which includes npm/);
  const composer = byId(stackChecks(stackFacts(TA, ['composer'])), 'tools.composer');
  assert.equal(composer.status, 'fail');
  assert.match(composer.fix, /getcomposer\.org/);
  assert.equal(byId(stackChecks(stackFacts(TA, ['composer'])), 'tools.php').status, 'pass');
});

test('a Laravel platform with a target is refused by validation, so doctor never probes one', () => {
  const f = stackFacts('  api:\n    stack: laravel\n    path: apps/api\n    targets: [web]\n');
  assert.equal(f.config, null);
});

const TS = '  backend:\n    stack: supabase\n    path: supabase\n';

test('Scenario: Supabase platform - tools supabase and docker are probed and pass when present and engine running', () => {
  const f = stackFacts(TS);
  assert.equal(f.platformFacts[0].profile !== null, true);
  assert.deepEqual(f.platformFacts[0].tools.map((t) => t.tool), ['supabase', 'docker']);
  const results = stackChecks(f);
  assert.equal(byId(results, 'tools.supabase').status, 'pass');
  assert.equal(byId(results, 'tools.docker').status, 'pass');
});

test('Supabase CLI missing fails naming the platform and the install hint', () => {
  const results = stackChecks(stackFacts(TS, ['supabase']));
  const sb = byId(results, 'tools.supabase');
  assert.equal(sb.status, 'fail');
  assert.match(sb.message, /supabase is not installed \(platform backend, stack supabase\)/);
  assert.match(sb.fix, /brew install supabase/);
});

test('Docker CLI missing fails naming the platform and the install hint', () => {
  const results = stackChecks(stackFacts(TS, ['docker']));
  const dk = byId(results, 'tools.docker');
  assert.equal(dk.status, 'fail');
  assert.match(dk.message, /docker is not installed \(platform backend, stack supabase\)/);
  assert.match(dk.fix, /install Docker/);
});

test('Docker CLI present but engine stopped warns and instructs to start Docker Desktop or OrbStack', () => {
  const text = `limits:\n  run_max_cost: 5\nplatforms:\n${TS}`;
  const f = gatherFacts({
    tool: (name, args) => {
      if (name === 'docker' && args && args[0] === 'info') throw new Error('Cannot connect to daemon');
      return 'ok';
    },
    gh: () => { throw new Error('no network'); },
    exists: (p) => p === 'relevo.yml', read: () => text, listDir: () => [], skillDirs: [], repo: null,
  });
  const results = stackChecks(f);
  const dk = byId(results, 'tools.docker');
  assert.equal(dk.status, 'warn');
  assert.match(dk.message, /docker is installed but the engine is stopped/);
  assert.match(dk.fix, /start Docker Desktop or OrbStack/);
});

test('Supabase required skills are reported by doctor when missing or present', () => {
  const text = `limits:\n  run_max_cost: 5\nplatforms:\n${TS}`;
  const fMissing = gatherFacts({
    tool: () => 'ok',
    gh: () => { throw new Error('no network'); },
    exists: (p) => p === 'relevo.yml', read: () => text, listDir: () => [], skillDirs: ['.agents/skills'], repo: null,
  });
  const resMissing = stackChecks(fMissing);
  const skillWarn = byId(resMissing, 'skills.supabase');
  assert.equal(skillWarn.status, 'warn');
  assert.match(skillWarn.message, /platform backend requires the skill supabase/);
  assert.match(skillWarn.fix, /npx skills add supabase\/agent-skills/);

  const fPresent = gatherFacts({
    tool: () => 'ok',
    gh: () => { throw new Error('no network'); },
    exists: (p) => p === 'relevo.yml' || p === '.agents/skills/supabase' || p === '.agents/skills/supabase-postgres-best-practices',
    read: () => text, listDir: () => [], skillDirs: ['.agents/skills'], repo: null,
  });
  const resPresent = stackChecks(fPresent);
  assert.equal(byId(resPresent, 'skills.supabase').status, 'pass');
  assert.equal(byId(resPresent, 'skills.supabase-postgres-best-practices').status, 'pass');
});

test('the version a workflow pins is read from RELEVO_VERSION, and null when there is none', () => {
  const f = gatherFacts(probes({ localFiles: {}, remote: { 'relevo-queue.yml': "env:\n  RELEVO_VERSION: '0.2.0'\n", 'relevo-sla.yml': 'name: sla\n' } }));
  assert.equal(f.pluginPins['relevo-queue.yml'], '0.2.0');
  assert.equal(f.pluginPins['relevo-sla.yml'], null);
});

const GO_TEMPLATE = readFileSync(new URL('../templates/workflows/relevo-go.yml', import.meta.url), 'utf8');
const withGo = (text, platformFacts = [flutterPlatform()]) => healthy({ platformFacts, workflows: { ...healthy().workflows, 'relevo-go.yml': { present: true, enabled: true, text } } });
const toolchain = (over, name = 'app') => byId(runChecks(over), `automation.toolchain.${name}`);

test('Scenario: A Flutter project whose workflow installs nothing - a failure that names the platform and the step', () => {
  const commented = GO_TEMPLATE.replace(/^( {6})- if: needs\.decide\.outputs\.stack == 'flutter'\n {8}uses: subosito\/flutter-action@v2\n {8}with:\n {10}channel: stable\n {10}cache: true\n/m, (m) => m.split('\n').map((l) => (l ? `${l.slice(0, 6)}# ${l.slice(6)}` : l)).join('\n'));
  assert.notEqual(commented, GO_TEMPLATE, 'the fixture comments the Flutter step out');
  const bad = toolchain(withGo(commented));
  assert.equal(bad.status, 'fail');
  assert.match(bad.message, /platform app \(flutter\).*every cloud build would fail QA/);
  assert.match(bad.fix, /enable the Flutter step of the build job in relevo-go\.yml/);
});

test('Scenario: A toolchain that is only a comment - it counts as missing; the current template passes', () => {
  assert.equal(toolchain(withGo('jobs:\n  build:\n    steps:\n      # - uses: subosito/flutter-action@v2\n')).status, 'fail');
  assert.equal(toolchain(withGo(GO_TEMPLATE)).status, 'pass');
  assert.equal(toolchain(withGo('steps:\n  - uses: subosito/flutter-action@v2\n')).status, 'pass', 'a project that installs it its own way, unguarded, passes');
});

test('Scenario: A project that builds on machines only - nothing is said about the toolchain', () => {
  const none = healthy({ workflows: { ...healthy().workflows, 'relevo-go.yml': { present: false, enabled: null } } });
  assert.deepEqual(runChecks(none).filter((r) => r.id.startsWith('automation.toolchain')), []);
  assert.deepEqual(runChecks(healthy()).filter((r) => r.id.startsWith('automation.toolchain')), [], 'no text, no judgement');
});

test('the Laravel step is judged, Vue and unknown stacks are not', () => {
  const laravel = { name: 'api', stack: 'laravel', path: 'api', targets: [], profile: null, errors: [], tools: [], targetTools: [] };
  const vue = { ...laravel, name: 'web', stack: 'vue', path: 'web' };
  const custom = { ...laravel, name: 'x', stack: 'cobol' };
  const facts = [laravel, vue, custom];
  assert.equal(toolchain(withGo(GO_TEMPLATE, facts), 'api').status, 'pass');
  assert.equal(toolchain(withGo('name: go\n', facts), 'api').status, 'fail');
  assert.equal(toolchain(withGo('name: go\n', facts), 'web'), undefined);
  assert.equal(toolchain(withGo('name: go\n', facts), 'x'), undefined);
});

const declared = (settings) => ({ exists: (p) => p === '.claude/settings.json' && settings !== undefined, read: () => settings });

test('Scenario: Installed for the machine only - the fact says whether the committed settings declare the plugin', () => {
  const ok = JSON.stringify({ extraKnownMarketplaces: { relevo: { source: { source: 'github', repo: 'elalfner/relevo' } } }, enabledPlugins: { 'relevo@relevo': true } });
  assert.deepEqual(pluginDeclaration(declared(ok)), { declared: true });
  assert.deepEqual(pluginDeclaration(declared(undefined)), { declared: false }, 'no file');
  assert.deepEqual(pluginDeclaration(declared('{}')), { declared: false }, 'no plugin');
  assert.deepEqual(pluginDeclaration(declared(JSON.stringify({ extraKnownMarketplaces: { relevo: {} }, enabledPlugins: { 'relevo@relevo': false } }))), { declared: false }, 'disabled');
  assert.deepEqual(pluginDeclaration(declared(JSON.stringify({ enabledPlugins: { 'relevo@relevo': true } }))), { declared: false }, 'no marketplace');
  assert.deepEqual(pluginDeclaration(declared('{ not json')), { unreadable: true });
});

test('Scenario: Declared - doctor passes; not declared - it warns with the fix and does not fail; unreadable - it warns; no fact - it says nothing', () => {
  const pass = byId(runChecks(healthy({ pluginDeclared: { declared: true } })), 'plugin.declared');
  assert.equal(pass.status, 'pass');
  const warn = byId(runChecks(healthy({ pluginDeclared: { declared: false } })), 'plugin.declared');
  assert.equal(warn.status, 'warn');
  assert.match(warn.message, /a teammate who clones it is not offered the plugin/);
  assert.match(warn.fix, /\/relevo:init.*--scope project.*commit \.claude\/settings\.json/);
  assert.ok(!failing(runChecks(healthy({ pluginDeclared: { declared: false } }))).includes('plugin.declared'));
  assert.equal(byId(runChecks(healthy({ pluginDeclared: { unreadable: true } })), 'plugin.declared').status, 'warn');
  assert.equal(byId(runChecks(healthy()), 'plugin.declared'), undefined);
});

test('gatherFacts reads the settings file through the probes', () => {
  const settings = JSON.stringify({ extraKnownMarketplaces: { relevo: {} }, enabledPlugins: { 'relevo@relevo': true } });
  const f = gatherFacts({ ...probes({ localFiles: {}, remote: {} }), exists: (p) => p === '.claude/settings.json', read: () => settings });
  assert.deepEqual(f.pluginDeclared, { declared: true });
});

test('the plugin declaration is judged without a GitHub sign-in, because the settings file is local', () => {
  const r = runChecks({ ...healthy({ pluginDeclared: { declared: false } }), repo: null, ghAuth: false });
  assert.equal(byId(r, 'plugin.declared').status, 'warn');
});

test('Scenario: Outdated plugin - a rendered Antigravity plugin is checked: complete, other version, edited by hand, missing file', () => {
  const adapter = (over) => ({ scope: 'project', dir: '/r/.agents/plugins/relevo', package: '0.4.0', edited: [], missing: [], ...over });
  const run = (adapters) => runChecks(healthy({ packageVersion: '0.4.0', adapters }));
  assert.equal(byId(run([adapter()]), 'adapters.antigravity.project').status, 'pass');
  assert.equal(run([]).filter((r) => r.id.startsWith('adapters.')).length, 0, 'nothing to say when no plugin was rendered');
  const old = byId(run([adapter({ package: '0.3.0' })]), 'adapters.antigravity.project.version');
  assert.equal(old.status, 'warn');
  assert.match(old.message, /rendered by Relevo 0\.3\.0, and this one is 0\.4\.0/);
  assert.match(old.fix, /relevo update/);
  const edited = byId(run([adapter({ edited: ['skills/go/SKILL.md'] })]), 'adapters.antigravity.project.edited');
  assert.equal(edited.status, 'warn');
  assert.match(edited.fix, /--force/);
  const gone = byId(run([adapter({ scope: 'machine', dir: '/h/.gemini/config/plugins/relevo', missing: ['plugin.json'] })]), 'adapters.antigravity.machine');
  assert.equal(gone.status, 'fail');
  assert.match(gone.message, /lacks plugin\.json/);
});

test('Scenario: Antigravity builds - the secret is GEMINI_API_KEY and there is no Anthropic credential to look for', () => {
  const antigravity = loadConfig('agent:\n  build: antigravity\nlimits:\n  run_max_tokens: 2000000\nplatform: flutter-android\n').config;
  const run = (secrets) => runChecks(healthy({ config: antigravity, secrets }));
  assert.equal(byId(run(['GEMINI_API_KEY']), 'automation.secret').status, 'pass');
  assert.match(byId(run(['GEMINI_API_KEY']), 'execution.credential').message, /no cost limit[\s\S]*limits\.run_max_tokens[\s\S]*quota of the Google Cloud project/);
  assert.equal(byId(run(['ANTHROPIC_API_KEY']), 'automation.secret').status, 'warn', 'an Anthropic key does not build with Antigravity');
  assert.match(byId(run([]), 'automation.secret').fix, /key made only for Relevo/);
  assert.equal(byId(run(['GEMINI_API_KEY']), 'execution.policy'), undefined, 'no subscription reminder');
});

test('Scenario: Profile file of the repository not tracked - doctor warns that the cloud and a clone use only the plugin profile', () => {
  const profile = { ...FLUTTER, layers: ['plugin', 'repository'] };
  const results = runChecks(healthy({ platformFacts: [{ ...flutterPlatform({ profile }), repositoryLayerTracked: false }] }));
  const w = byId(results, 'platform.app.profile.tracked');
  assert.equal(w.status, 'warn');
  assert.match(w.message, /\.relevo\/stacks\/flutter\.md is not tracked by git/);
  assert.match(w.message, /use only the plugin's profile/);
  assert.match(w.fix, /commit \.relevo\/stacks\/flutter\.md/);
});

test('Scenario: Stack defined only by an untracked file - doctor warns that the cloud and a clone have no profile', () => {
  const profile = { ...FLUTTER, stack: 'elixir', layers: ['repository'] };
  const platform = { ...flutterPlatform({ profile }), stack: 'elixir', repositoryLayerTracked: false };
  const w = byId(runChecks(healthy({ platformFacts: [platform] })), 'platform.app.profile.tracked');
  assert.equal(w.status, 'warn');
  assert.match(w.message, /have no profile for elixir/);
});

test('Scenario: Profile file of the repository tracked - no warning; nor when git cannot say', () => {
  const profile = { ...FLUTTER, layers: ['plugin', 'repository'] };
  [true, null, undefined].forEach((tracked) => {
    const results = runChecks(healthy({ platformFacts: [{ ...flutterPlatform({ profile }), repositoryLayerTracked: tracked }] }));
    assert.equal(byId(results, 'platform.app.profile.tracked'), undefined);
    assert.match(byId(results, 'platform.app.profile').message, /default of the plugin \+ \.relevo\/stacks\/flutter\.md/);
  });
});

test('gatherFacts asks git whether the repository layer is tracked', () => {
  const files = {
    'relevo.yml': 'limits:\n  run_max_cost: 5\nteam:\n  spec_writer: persona-a\n  members: [persona-a]\nplatforms:\n  app:\n    stack: flutter\n    path: .\n    targets: [android]\n',
    '.relevo/stacks/flutter.md': '---\nstack: flutter\n---\nOur rule.\n',
  };
  const gather = ({ git = true, tracked, repo = true }) => gatherFacts({
    tool: (name, args) => {
      if (name !== 'git') return 'ok';
      if (!git) throw new Error('not found');
      if (args[0] === 'ls-files' && args[1] === '--error-unmatch') { if (!tracked) throw new Error('did not match'); return `${args[2]}\n`; }
      if (args[0] === 'rev-parse') { if (!repo) throw new Error('not a git repository'); return 'true\n'; }
      return 'git version 2.50.0\n';
    },
    gh: () => { throw new Error('no network'); },
    exists: (p) => p in files, read: (p) => files[p], listDir: () => [], skillDirs: [], repo: 'o/r',
  }).platformFacts[0];
  assert.deepEqual(gather({ tracked: true }).profile.layers, ['plugin', 'repository']);
  assert.equal(gather({ tracked: true }).repositoryLayerTracked, true);
  assert.equal(gather({ tracked: false }).repositoryLayerTracked, false);
  assert.equal(gather({ tracked: false, repo: false }).repositoryLayerTracked, null);
  assert.equal(gather({ git: false }).repositoryLayerTracked, null);
});

test('Scenario: Approval of the last push required - doctor fails, naming the archive commit', () => {
  const r = byId(runChecks(healthy({ protection: { base: { ...PROTECTED, lastPushApproval: true }, release: PROTECTED } })), 'repo.last-push.base');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /archive commit pushed by `ship` would need a new approval/);
  assert.match(r.fix, /require approval of the most recent reviewable push/);
});

test('last-push approval and required checks are read from rulesets and from classic protection', () => {
  const ruleset = {
    target: 'branch', enforcement: 'active', conditions: { ref_name: { include: ['refs/heads/dev'], exclude: [] } },
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 1, require_last_push_approval: true } }, { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test' }] } }],
  };
  const a = summarizeProtection({ rulesets: [ruleset], branch: 'dev', defaultBranch: 'main' });
  assert.equal(a.lastPushApproval, true);
  assert.equal(a.requiredChecks, true);
  const classic = summarizeProtection({ classic: { required_pull_request_reviews: { require_last_push_approval: true }, required_status_checks: { contexts: ['test'] } }, branch: 'dev', defaultBranch: 'main' });
  assert.equal(classic.lastPushApproval, true);
  assert.equal(classic.requiredChecks, true);
});

test('Scenario: No required checks - the ship workflow needs no App and the checks carry over', () => {
  const r = byId(runChecks(healthy()), 'ship.app');
  assert.equal(r.status, 'pass');
  assert.match(r.message, /checks of the approved head carry over/);
});

test('Scenario: Required checks without the App - doctor fails and names the secrets', () => {
  const required = { ...PROTECTED, requiredChecks: true };
  const r = byId(runChecks(healthy({ protection: { base: required, release: PROTECTED } })), 'ship.app');
  assert.equal(r.status, 'fail');
  assert.match(r.message, /cannot ship here/);
  assert.match(r.fix, /RELEVO_SHIP_APP_ID and RELEVO_SHIP_APP_KEY/);
  const withApp = byId(runChecks(healthy({ protection: { base: required, release: PROTECTED }, secrets: ['ANTHROPIC_API_KEY', 'RELEVO_SHIP_APP_ID', 'RELEVO_SHIP_APP_KEY'] })), 'ship.app');
  assert.equal(withApp.status, 'pass');
});

test('Scenario: Ship paused - doctor warns that the label is paused', () => {
  const r = byId(runChecks(healthy({ shipVariable: 'off' })), 'ship.paused');
  assert.equal(r.status, 'warn');
  assert.match(r.message, /RELEVO_CLOUD_SHIP is off/);
});

test('the ship checks are skipped when the ship workflow is not installed', () => {
  const workflows = { ...healthy().workflows, 'relevo-ship.yml': { present: false, local: false, remote: false } };
  const results = runChecks(healthy({ workflows, shipVariable: 'off', protection: { base: { ...PROTECTED, requiredChecks: true }, release: PROTECTED } }));
  assert.equal(byId(results, 'ship.app'), undefined);
  assert.equal(byId(results, 'ship.paused'), undefined);
});

test('playwrightFacts resolves Playwright from the folder of the platform, not from where the command runs', () => {
  const tool = (name, args) => execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const repo = mkdtempSync(join(tmpdir(), 'relevo-pw-'));
  const pkg = join(repo, 'apps/site/node_modules/playwright');
  mkdirSync(pkg, { recursive: true });
  const browser = join(repo, 'chromium');
  writeFileSync(join(pkg, 'package.json'), '{"name":"playwright","main":"index.js"}');
  writeFileSync(join(pkg, 'index.js'), `module.exports = { chromium: { executablePath: () => ${JSON.stringify(browser)} } };`);
  const exists = (p) => p === browser;
  assert.deepEqual(playwrightFacts(join(repo, 'apps/site'), { tool, exists }), { playwright: true, chromium: true });
  assert.deepEqual(playwrightFacts(join(repo, 'apps/site'), { tool, exists: () => false }), { playwright: true, chromium: false });
  assert.deepEqual(playwrightFacts(repo, { tool, exists }), { playwright: false, chromium: false });
});

test('isVueWeb: a Vue platform with no targets or with web, and nothing else', () => {
  assert.equal(isVueWeb({ stack: 'vue' }), true);
  assert.equal(isVueWeb({ stack: 'vue', targets: ['web'] }), true);
  assert.equal(isVueWeb({ stack: 'vue', targets: ['desktop'] }), false);
  assert.equal(isVueWeb({ stack: 'flutter', targets: ['web'] }), false);
});

// ---- OpenSpec in web sessions

const hookSettings = (...commands) => JSON.stringify({ hooks: { SessionStart: commands.map((command) => ({ hooks: [{ type: 'command', command }] })) } });
const settingsProbe = (text) => ({ exists: (p) => p === '.claude/settings.json' && text !== null, read: () => text });

test('the fact web hook: present, missing file, other hooks only, written by hand, invalid JSON', () => {
  assert.deepEqual(webHookDeclaration(settingsProbe(hookSettings(WEB_HOOK_COMMAND))), { declared: true });
  assert.deepEqual(webHookDeclaration(settingsProbe(hookSettings('npm install --global @fission-ai/openspec'))), { declared: true }, 'a hook written by hand counts');
  assert.deepEqual(webHookDeclaration(settingsProbe(null)), { declared: false });
  assert.deepEqual(webHookDeclaration(settingsProbe(hookSettings('echo hi'))), { declared: false });
  assert.deepEqual(webHookDeclaration(settingsProbe('{}')), { declared: false });
  assert.deepEqual(webHookDeclaration(settingsProbe('{ not json')), { unreadable: true });
});

test('Scenario: A remote session without the hook - a warning that names the hook and says to run init; not a failure', () => {
  const r = runChecks(healthy({ remoteSession: true, webHook: { declared: false } }));
  const check = byId(r, 'web.openspec-hook');
  assert.equal(check.status, 'warn');
  assert.match(check.message, /no SessionStart hook that installs OpenSpec/);
  assert.match(check.fix, /\/relevo:init/);
  assert.ok(!failing(r).includes('web.openspec-hook'));
});

test('Scenario: A remote session with the hook - a passed check', () => {
  assert.equal(byId(runChecks(healthy({ remoteSession: true, webHook: { declared: true } })), 'web.openspec-hook').status, 'pass');
});

test('Scenario: A terminal - no check about the hook, with or without it', () => {
  assert.equal(byId(runChecks(healthy({ remoteSession: false, webHook: { declared: false } })), 'web.openspec-hook'), undefined);
  assert.equal(byId(runChecks(healthy({ remoteSession: false, webHook: { declared: true } })), 'web.openspec-hook'), undefined);
  assert.equal(byId(runChecks(healthy({ remoteSession: true })), 'web.openspec-hook'), undefined, 'no fact, no check');
});

test('a remote session with an unreadable settings file warns that it cannot be checked', () => {
  assert.equal(byId(runChecks(healthy({ remoteSession: true, webHook: { unreadable: true } })), 'web.openspec-hook').status, 'warn');
});

test('gatherFacts reads the hook and the remote session', () => {
  const f = gatherFacts({ ...probes({ localFiles: {}, remote: {} }), exists: (p) => p === '.claude/settings.json', read: () => hookSettings(WEB_HOOK_COMMAND) });
  assert.deepEqual(f.webHook, { declared: true });
  assert.equal(f.remoteSession, process.env.CLAUDE_CODE_REMOTE === 'true');
});

const HOSTED_GO = GO_TEMPLATE;
const FRONT_GO = GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Front]');
const FRONT_CONFIG = loadConfig(`${CONFIG_TEXT}runner:\n  labels: [self-hosted, Front]\n`).config;
const runner = (over) => runChecks(over).filter((r) => r.id.startsWith('automation.runner'));

test('Scenario: A workflow edited by hand - doctor fails, names the file and says to set runner.labels or restore ubuntu-latest', () => {
  const [r] = runner(withGo(FRONT_GO)).filter((x) => x.status === 'fail');
  assert.equal(r.id, 'automation.runner');
  assert.match(r.message, /relevo-go\.yml runs on \[self-hosted, Front\] and relevo\.yml says \[ubuntu-latest\]/);
  assert.match(r.fix, /set runner\.labels: \[self-hosted, Front\] in relevo\.yml .* restore runs-on: ubuntu-latest in relevo-go\.yml/);
});

test('Scenario: Workflows and setting agree - the runner check passes and one warning explains the persistence assumption', () => {
  const res = runner({ ...withGo(FRONT_GO), config: FRONT_CONFIG });
  assert.deepEqual(res.map((r) => [r.id, r.status]), [['automation.runner', 'pass'], ['automation.runner.persistence', 'warn']]);
  assert.match(res[1].message, /assumes it keeps its files between jobs/);
  assert.match(res[1].message, /permissions of the runner's user/);
  assert.doesNotMatch(res[1].message, /ephemeral/, 'doctor does not claim to know whether the runner is ephemeral');
  assert.match(res[1].fix, /ephemeral runner .* or a container is the real barrier/);
});

test('Scenario: Hosted runner - the runner check passes and no persistence warning appears', () => {
  const res = runner(withGo(HOSTED_GO));
  assert.deepEqual(res.map((r) => [r.id, r.status]), [['automation.runner', 'pass']]);
});

test('the setting says self-hosted and a workflow still runs on ubuntu-latest - the file is named', () => {
  const [r] = runner({ ...withGo(HOSTED_GO), config: FRONT_CONFIG }).filter((x) => x.status === 'fail');
  assert.match(r.message, /runs on \[ubuntu-latest\] and relevo\.yml says \[self-hosted, Front\]/);
  assert.match(r.fix, /change runs-on in relevo-go\.yml to \[self-hosted, Front\]/);
});

test('the order of the labels does not matter, and an expression in runs-on is not judged', () => {
  const swapped = FRONT_GO.replaceAll('[self-hosted, Front]', '[Front, self-hosted]');
  assert.deepEqual(runner({ ...withGo(swapped), config: FRONT_CONFIG }).filter((x) => x.status === 'fail'), []);
  const expr = GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: ${{ vars.RUNNER }}');
  assert.deepEqual(runner(withGo(expr)).filter((x) => x.status === 'fail'), []);
});

test('a repository with no workflow text read and the default runner gets no runner result at all', () => {
  assert.deepEqual(runner(healthy()), []);
});

// ---------- the note level

test('Scenario: Information with no action - a note is neither a failure nor a warning, and never changes the exit status', () => {
  const one = { ...config, limits: { ...config.limits, concurrent_agents: 1 } };
  const results = runChecks(healthy({ secrets: ['CLAUDE_CODE_OAUTH_TOKEN'], config: one }));
  const notes = results.filter((r) => r.status === 'note').map((r) => r.id);
  assert.ok(notes.includes('execution.policy'), 'the reminder about the terms of a subscription token');
  assert.ok(notes.includes('execution.credential'), 'the subscription token explanation');
  assert.deepEqual(failing(results), []);
  assert.deepEqual(results.filter((r) => r.status === 'warn'), []);
  assert.equal(exitCode(results), 0);
  assert.ok(results.filter((r) => r.status === 'note').every((r) => r.fix === undefined), 'a note has no fix: nothing is asked of the person');
});

test('the exit status is 1 only when a check failed, whatever else is in the report', () => {
  assert.equal(exitCode([{ id: 'a', status: 'pass' }, { id: 'b', status: 'warn' }, { id: 'c', status: 'note' }]), 0);
  assert.equal(exitCode([{ id: 'a', status: 'pass' }, { id: 'b', status: 'fail' }]), 1);
  assert.equal(exitCode([]), 0);
});

test('the script lists every check as JSON with one of the four levels, and exits 1 only if one failed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-doctor-'));
  const r = spawnSync(process.execPath, [new URL('../scripts/doctor.mjs', import.meta.url).pathname, '--json'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: '' } });
  const results = JSON.parse(r.stdout);
  assert.ok(results.length > 0);
  results.forEach((x) => assert.ok(['pass', 'warn', 'fail', 'note'].includes(x.status), `${x.id}: ${x.status}`));
  assert.equal(r.status, results.some((x) => x.status === 'fail') ? 1 : 0);
});

test('Scenario: Several workflows differ - one failed result names the five files, with one fix', () => {
  const on = (file) => ({ present: true, enabled: true, text: GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Front]'), file });
  const workflows = { ...healthy().workflows };
  ['relevo-go.yml', 'relevo-queue.yml', 'relevo-review.yml', 'relevo-sla.yml', 'relevo-digest.yml'].forEach((f) => { workflows[f] = on(f); });
  const bad = runner(healthy({ workflows })).filter((x) => x.status === 'fail');
  assert.equal(bad.length, 1, 'one result for one cause');
  assert.match(bad[0].message, /^relevo-go\.yml, relevo-queue\.yml, relevo-review\.yml, relevo-sla\.yml, relevo-digest\.yml run on \[self-hosted, Front\] and relevo\.yml says \[ubuntu-latest\]$/);
  assert.match(bad[0].fix, /restore runs-on: ubuntu-latest in relevo-go\.yml, relevo-queue\.yml/);
});

test('two different runners are two causes, one result each', () => {
  const workflows = { ...healthy().workflows };
  workflows['relevo-go.yml'] = { present: true, enabled: true, text: GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Front]') };
  workflows['relevo-sla.yml'] = { present: true, enabled: true, text: GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Back]') };
  assert.equal(runner(healthy({ workflows })).filter((x) => x.status === 'fail').length, 2);
});

// ---------- one result per cause

test('Scenario: Workflows that are not installed - two optional files are one warning that names both, with one fix', () => {
  const wf = { ...healthy().workflows, 'relevo-sla.yml': { present: false }, 'relevo-digest.yml': { present: false } };
  const res = runChecks(healthy({ workflows: wf })).filter((r) => r.id.startsWith('automation.workflow.'));
  const missing = res.filter((r) => r.status === 'warn');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].message, 'relevo-sla.yml, relevo-digest.yml are not installed');
  assert.equal(missing[0].fix, 'run /relevo:init to copy it into .github/workflows/');
});

test('a required file and an optional one that are both missing are two results, because their status differs', () => {
  const wf = { ...healthy().workflows, 'relevo-go.yml': { present: false }, 'relevo-queue.yml': { present: false }, 'relevo-sla.yml': { present: false }, 'relevo-digest.yml': { present: false } };
  const res = runChecks(healthy({ workflows: wf })).filter((r) => r.id.startsWith('automation.workflow.') && r.status !== 'pass');
  assert.deepEqual(res.map((r) => r.status).sort(), ['fail', 'warn']);
  assert.equal(new Set(res.map((r) => r.id)).size, 2, 'the two results have two ids');
});

test('workflows that are installed and enabled are one pass that names them, not one pass per file', () => {
  const res = runChecks(healthy()).filter((r) => r.id.startsWith('automation.workflow.'));
  assert.equal(res.length, 1);
  assert.equal(res[0].status, 'pass');
  assert.match(res[0].message, /^relevo-go\.yml, .* are installed and enabled$/);
  WORKFLOW_FILES.forEach((f) => assert.ok(res[0].message.includes(f), f));
});

test('Scenario: Two causes - five workflows on another runner and two missing labels are two failures', () => {
  const workflows = { ...healthy().workflows };
  ['relevo-go.yml', 'relevo-queue.yml', 'relevo-review.yml', 'relevo-sla.yml', 'relevo-digest.yml'].forEach((f) => { workflows[f] = { present: true, enabled: true, text: GO_TEMPLATE.replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Front]') }; });
  const results = runChecks(healthy({ workflows, labels: allLabels.slice(0, -2) }));
  assert.equal(failing(results).length, 2, 'the runner is one cause and the labels the other');
  assert.match(renderReport(results), /\n2 check\(s\) failed/);
});

// ---------- the text report

const SAMPLE = [
  ...Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, status: 'pass', message: `works ${i}` })),
  { id: 'f1', status: 'fail', message: 'broken one', fix: 'fix one' },
  { id: 'f2', status: 'fail', message: 'broken two', fix: 'fix two' },
  { id: 'f3', status: 'fail', message: 'broken three', fix: 'fix three' },
  { id: 'w1', status: 'warn', message: 'careful one', fix: 'look one' },
  { id: 'w2', status: 'warn', message: 'careful two', fix: 'look two' },
  { id: 'n1', status: 'note', message: 'good to know' },
];

test('Scenario: A report with problems - failures, then warnings, then notes, and the passes only as a count', () => {
  const text = renderReport(SAMPLE);
  const at = (s) => text.indexOf(s);
  assert.ok(at('FAILURES (3)') !== -1 && at('FAILURES (3)') < at('WARNINGS (2)') && at('WARNINGS (2)') < at('NOTES (1)'));
  assert.match(text, /\[FAIL\] broken one\n {7}fix: fix one/);
  assert.match(text, /\[warn\] careful two\n {7}fix: look two/);
  assert.match(text, /\[note\] good to know\n/);
  assert.doesNotMatch(text, /\[pass\]/, 'a check that passed is not listed');
  assert.match(text, /30 check\(s\) passed; run with --all to list them\./);
  assert.match(text, /3 check\(s\) failed, 2 warning\(s\)\.$/);
});

test('a section with nothing in it is left out', () => {
  const text = renderReport([{ id: 'a', status: 'pass', message: 'ok' }, { id: 'w', status: 'warn', message: 'hm', fix: 'f' }]);
  assert.doesNotMatch(text, /FAILURES|NOTES/);
  assert.match(text, /WARNINGS \(1\)/);
});

test('Scenario: The full list - --all lists every check in the order it was evaluated', () => {
  const text = renderReport(SAMPLE, { all: true });
  assert.doesNotMatch(text, /FAILURES|WARNINGS|NOTES|run with --all/);
  const tags = text.split('\n').filter((l) => l.startsWith('[')).map((l) => l.match(/^\[(\w+)\]/)[1]);
  assert.equal(tags.length, SAMPLE.length);
  assert.deepEqual(tags, SAMPLE.map((x) => ({ pass: 'pass', fail: 'FAIL', warn: 'warn', note: 'note' }[x.status])));
});

test('Scenario: All green - it says so, counts the passes and lists any note', () => {
  const text = renderReport([{ id: 'a', status: 'pass', message: 'ok' }, { id: 'b', status: 'pass', message: 'ok too' }, { id: 'n', status: 'note', message: 'remember' }]);
  assert.match(text, /NOTES \(1\)\n\[note\] remember/);
  assert.match(text, /2 check\(s\) passed/);
  assert.match(text, /All green\.$/);
  assert.match(renderReport([{ id: 'a', status: 'pass', message: 'ok' }]), /All green\./);
});

test('Scenario: Workflows read from the default branch - the header names the repository and the branch', () => {
  const text = renderReport(SAMPLE, { header: reportHeader({ repo: 'owner/repo', ghAuth: true, workflowSource: 'default branch (main)' }) });
  assert.equal(text.split('\n')[0], 'Relevo doctor: owner/repo, workflows read from the default branch (main)');
  assert.equal(text.split('\n')[1], '');
});

test('Scenario: The branch cannot be read - the header says the working copy was read', () => {
  assert.equal(reportHeader({ repo: 'owner/repo', ghAuth: true, workflowSource: 'working copy' }), 'Relevo doctor: owner/repo, workflows read from the working copy');
});

test('without a repository or a GitHub sign-in the header says that only the local checks ran', () => {
  assert.match(reportHeader({ repo: null, ghAuth: false }), /only the local checks ran/);
  assert.match(reportHeader({ repo: 'o/r', ghAuth: false }), /only the local checks ran/);
});

test('Scenario: The machine-readable output - --json lists every check with its level whatever --all says', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-doctor-all-'));
  const run = (args) => spawnSync(process.execPath, [new URL('../scripts/doctor.mjs', import.meta.url).pathname, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: '' } });
  const plain = JSON.parse(run(['--json']).stdout);
  const withAll = JSON.parse(run(['--json', '--all']).stdout);
  assert.deepEqual(withAll.map((x) => x.id), plain.map((x) => x.id));
  assert.ok(plain.some((x) => x.status === 'pass'), 'passes are in the JSON');
  const text = run(['--all']);
  assert.match(text.stdout, /^Relevo doctor: /);
  assert.match(text.stdout, /\[pass\]/);
  assert.doesNotMatch(run([]).stdout, /\[pass\]/);
});

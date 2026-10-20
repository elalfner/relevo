import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SKILLS, WORKFLOW_FILES, gatherFacts, readOnlyGh, refMatches, renderReport, runChecks, summarizeProtection, versionAtLeast } from '../scripts/lib/doctor.mjs';
import { labelDefinitions } from '../scripts/lib/labels.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { readFileSync } from 'node:fs';
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
  assert.equal(ios(false, {}).status, 'pass');
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

test('Scenario: Private plugin repository - workflows that check it out without a token fail the check', () => {
  const bad = byId(runChecks(healthy({ pluginRepoPrivate: true, pluginCheckouts: [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: false }, { file: 'relevo-sla.yml', repo: 'o/relevo', hasToken: true }] })), 'automation.plugin-checkout');
  assert.equal(bad.status, 'fail');
  assert.match(bad.message, /relevo-queue\.yml/);
  assert.ok(!bad.message.includes('relevo-sla.yml'));
  assert.equal(byId(runChecks(healthy({ pluginRepoPrivate: true, pluginCheckouts: [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: true }] })), 'automation.plugin-checkout'), undefined);
  assert.equal(byId(runChecks(healthy({ pluginRepoPrivate: false, pluginCheckouts: [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: false }] })), 'automation.plugin-checkout'), undefined);
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

test('Scenario: Workflow fixed only in the working copy - doctor judges what is on the default branch, not the local file', () => {
  const f = gatherFacts(probes({ localFiles: { 'relevo-queue.yml': CHECKOUT(true) }, remote: { 'relevo-queue.yml': CHECKOUT(false) } }));
  assert.equal(f.workflowSource, 'default branch (main)');
  assert.deepEqual(f.pluginCheckouts, [{ file: 'relevo-queue.yml', repo: 'o/relevo', hasToken: false }]);
  const bad = byId(runChecks({ ...healthy(), ...f, config }), 'automation.plugin-checkout');
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
  assert.equal(r.status, 'pass');
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
  assert.equal(byId(results, 'skills.grill-with-docs').status, 'pass');
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

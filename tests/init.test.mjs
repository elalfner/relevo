import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { REQUIRED_SKILLS, WEB_HOOK_COMMAND, WORKFLOW_FILES } from '../scripts/lib/doctor.mjs';
import { mergeWebHook, applyPlan, manualChecklist, planInit, pushScopeBody, renderConfig, renderPlan, rulesetBody, skipItems } from '../scripts/lib/init.mjs';
import { labelDefinitions } from '../scripts/lib/labels.mjs';

const root = new URL('../', import.meta.url).pathname;
const template = readFileSync(`${root}templates/relevo.yml`, 'utf8');
const workflows = Object.fromEntries(WORKFLOW_FILES.map((f) => [f, readFileSync(`${root}templates/workflows/${f}`, 'utf8')]));
const templates = { config: template, workflows };
const ANSWERS = { members: ['persona-a', 'persona-b'], specWriter: 'persona-a', reviewMode: 'peer', language: 'es', platform: 'flutter-android' };

const PROTECTED = { protected: true, pullRequestRequired: true, approvals: 1, dismissStale: false };
const allLabels = labelDefinitions({}).map((l) => l.name);
const bare = (over = {}) => ({
  repo: 'o/r', openspec: '1.14.1', skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])),
  configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true },
  protection: { base: { pullRequestRequired: false }, release: { pullRequestRequired: false } }, protectionUnavailable: null, canApprove: true, ...over,
});
const empty = () => ({ workflows: Object.fromEntries(WORKFLOW_FILES.map((f) => [f, null])), gitignore: null, keepFiles: { 'openspec/specs/.gitkeep': true, 'openspec/changes/archive/.gitkeep': true } });
const plan = (facts, current = empty(), admin = true) => planInit({ facts, answers: ANSWERS, templates, current, admin });
const get = (items, id) => items.find((i) => i.id === id);

test('renderConfig fills the template from the answers and the result validates', () => {
  const text = renderConfig(template, ANSWERS);
  const { ok, config } = loadConfig(text);
  assert.ok(ok);
  assert.deepEqual(config.team.members, ['persona-a', 'persona-b']);
  assert.equal(config.team.spec_writer, 'persona-a');
  assert.equal(config.language, 'es');
  assert.equal(config.limits.run_max_cost, 5);
  assert.match(text, /# integration branch/, 'the template comments are kept');
  assert.ok(!/ANTHROPIC|sk-ant/.test(text), 'no credential in the configuration');
});

test('renderConfig rejects answers that do not validate', () => {
  assert.throws(() => renderConfig(template, { ...ANSWERS, reviewMode: 'chaos' }), /invalid relevo\.yml/);
});

test('Scenario: Plan before changes - it lists files, labels, branches, rulesets and workflows and changes nothing', () => {
  const items = plan(bare());
  const text = renderPlan(items);
  ['relevo.yml', 'label(s)', 'branch dev', 'ruleset', 'relevo-go.yml', '.gitignore'].forEach((w) => assert.ok(text.includes(w), w));
  assert.match(text, /\d+ change\(s\) to make\./);
});

test('Scenario: Fresh repository - everything is planned and the API key is a manual step', () => {
  const items = plan(bare());
  assert.equal(get(items, 'config').status, 'todo');
  assert.equal(get(items, 'labels').labels.length, 13);
  assert.ok(get(items, 'labels').labels.some((l) => l.name === 'relevo:ship'), 'the ship label is created');
  assert.ok(get(items, 'labels').labels.some((l) => l.name === 'relevo:urgent'), 'the urgent label is created');
  assert.equal(get(items, 'branch.base').status, 'todo');
  assert.equal(get(items, 'protection').status, 'todo');
  WORKFLOW_FILES.forEach((f) => assert.equal(get(items, `workflow.${f}`).status, 'todo'));
  assert.equal(get(items, 'gitignore').status, 'todo');
  assert.equal(get(items, 'manual.api-key').status, 'manual');
  assert.match(get(items, 'manual.api-key').description, /never reads or writes it/);
});

test('Scenario: Never touches the API key - no item writes or reads a secret', () => {
  const items = plan(bare());
  assert.ok(!items.some((i) => /secrets/.test(JSON.stringify(i.ruleset ?? '')) || /actions\/secrets/.test(i.path ?? '')));
  const calls = [];
  applyPlan(items, { repo: 'o/r', io: { gh: (a, input) => { calls.push([a, input]); return JSON.stringify({ commit: { sha: 'abc' } }); }, write() {}, append() {} } });
  assert.ok(calls.every(([a]) => !a.join(' ').includes('secrets')));
});

test('Scenario: Repository set up earlier - init plans only the urgent label when every other label exists', () => {
  const facts = bare({ configText: renderConfig(template, ANSWERS), config: loadConfig(renderConfig(template, ANSWERS)).config, labels: allLabels.filter((n) => n !== 'relevo:urgent') });
  const item = get(plan(facts), 'labels');
  assert.equal(item.status, 'todo');
  assert.deepEqual(item.labels.map((l) => l.name), ['relevo:urgent']);
});

test('Scenario: Renamed label - init creates the name given in labels.urgent', () => {
  const text = `${renderConfig(template, ANSWERS)}\nlabels:\n  urgent: prio:now\n`;
  const loaded = loadConfig(text);
  assert.ok(loaded.ok, JSON.stringify(loaded.errors));
  const item = get(plan(bare({ configText: text, config: loaded.config, labels: allLabels })), 'labels');
  assert.deepEqual(item.labels.map((l) => l.name), ['prio:now']);
});

test('Scenario: Second run - nothing to do for what is already correct', () => {
  const facts = bare({
    configText: renderConfig(template, ANSWERS), config: loadConfig(renderConfig(template, ANSWERS)).config, labels: allLabels,
    branches: { base: true, release: true }, protection: { base: PROTECTED, release: PROTECTED }, canApprove: false, pushScope: true,
  });
  const current = { workflows, gitignore: 'evidence/\n', keepFiles: empty().keepFiles };
  const items = plan(facts, current);
  assert.deepEqual(items.filter((i) => i.status === 'todo' && i.id !== 'secret-scanning'), []);
  assert.match(renderPlan(items.filter((i) => i.id !== 'secret-scanning')), /Nothing to do\./);
});

test('an existing workflow that differs from the template is reported and never overwritten', () => {
  const current = { ...empty(), workflows: { ...empty().workflows, 'relevo-go.yml': 'name: custom\n' } };
  const it = get(plan(bare(), current), 'workflow.relevo-go.yml');
  assert.equal(it.status, 'differs');
  const written = [];
  applyPlan([it], { repo: 'o/r', io: { write: (p) => written.push(p) } });
  assert.deepEqual(written, []);
});

test('Scenario: An older go workflow - the item that says it is left alone also names the toolchain step; other workflows do not', () => {
  const current = { ...empty(), workflows: { ...empty().workflows, 'relevo-go.yml': 'name: custom\n', 'relevo-sla.yml': 'name: custom\n' } };
  const items = plan(bare(), current);
  assert.match(get(items, 'workflow.relevo-go.yml').message ?? get(items, 'workflow.relevo-go.yml').label ?? JSON.stringify(get(items, 'workflow.relevo-go.yml')), /build job installs the toolchain of your stacks, as the template does for Flutter and Laravel/);
  assert.doesNotMatch(JSON.stringify(get(items, 'workflow.relevo-sla.yml')), /toolchain/);
});

test('Scenario: Not an admin - the exact settings are listed for an administrator', () => {
  const items = plan(bare(), empty(), false);
  const p = get(items, 'protection');
  assert.equal(p.status, 'manual');
  assert.equal(p.checklist.length, 4);
  assert.match(p.checklist[0], /dev.*main|`dev`/);
  assert.equal(get(items, 'workflow-permissions').status, 'manual');
  assert.equal(get(items, 'secret-scanning').status, 'manual');
});

test('Scenario: A ruleset cannot be created - the refusal becomes a checklist, not a silent failure', () => {
  const items = plan(bare());
  const results = applyPlan(items.filter((i) => i.id === 'protection'), {
    repo: 'o/r', io: { gh: () => { const e = new Error('x'); e.stderr = 'gh: Upgrade to GitHub Pro (HTTP 403)\n'; throw e; } },
  });
  assert.equal(results[0].ok, false);
  assert.match(results[0].message, /Upgrade to GitHub Pro/);
  assert.equal(results[0].checklist.length, 4);
});

test('the ruleset blocks deletion and force pushes, requires a pull request and keeps approvals on push', () => {
  const body = rulesetBody({ base: 'dev', release: 'main', reviewMode: 'peer' });
  assert.deepEqual(body.conditions.ref_name.include, ['refs/heads/dev', 'refs/heads/main']);
  assert.deepEqual(body.bypass_actors, []);
  const pr = body.rules.find((r) => r.type === 'pull_request').parameters;
  assert.equal(pr.required_approving_review_count, 1);
  assert.equal(pr.dismiss_stale_reviews_on_push, false);
  assert.ok(body.rules.some((r) => r.type === 'deletion') && body.rules.some((r) => r.type === 'non_fast_forward'));
  assert.equal(rulesetBody({ base: 'dev', release: 'main', reviewMode: 'none' }).rules.find((r) => r.type === 'pull_request').parameters.required_approving_review_count, 0);
  assert.equal(manualChecklist({ base: 'dev', release: 'main', reviewMode: 'peer' }).length, 4);
});

test('applying carries out labels, branch, ruleset, workflow permissions, files and the ignore line', () => {
  const calls = []; const written = {}; const appended = [];
  const io = {
    gh: (args, input) => { calls.push({ args, input }); return args[1]?.includes('/branches/') ? JSON.stringify({ commit: { sha: 'abc123' } }) : '{}'; },
    write: (p, text) => { written[p] = text; }, append: (p, line) => appended.push([p, line]),
  };
  const results = applyPlan(plan(bare()), { repo: 'o/r', io });
  assert.ok(results.every((r) => r.ok), JSON.stringify(results.filter((r) => !r.ok)));
  assert.equal(calls.filter((c) => c.args[0] === 'label').length, 13);
  assert.ok(calls.some((c) => c.args.includes('-f') && c.args.includes('ref=refs/heads/dev') && c.args.includes('sha=abc123')));
  assert.ok(calls.some((c) => c.args.includes(`repos/o/r/rulesets`) && JSON.parse(c.input).name === 'relevo-protected-branches'));
  assert.ok(calls.some((c) => c.args.includes('repos/o/r/actions/permissions/workflow') && c.args.includes('can_approve_pull_request_reviews=false')));
  assert.ok(written['relevo.yml'].includes('persona-a'));
  WORKFLOW_FILES.forEach((f) => assert.equal(written[`.github/workflows/${f}`], workflows[f]));
  assert.deepEqual(appended, [['.gitignore', 'evidence/']]);
});

test('Scenario: Offer to install - a missing dependency is planned as an install and never applied by the script', () => {
  const items = plan(bare({ openspec: null, skills: { ...bare().skills, 'domain-modeling': false } }));
  const ids = items.filter((i) => i.install).map((i) => i.id);
  assert.deepEqual(ids, ['install.openspec', 'install.skill.domain-modeling']);
  assert.equal(get(items, 'install.openspec').command, 'npm install --global @fission-ai/openspec');
  const calls = [];
  applyPlan(items.filter((i) => i.install), { repo: 'o/r', io: { gh: (a) => calls.push(a), write: (p) => calls.push(p), append: (p) => calls.push(p) } });
  assert.deepEqual(calls, []);
});

test('without an OpenSpec root init asks for openspec init and creates no openspec files by hand', () => {
  const it = get(plan(bare({ openspecRoot: false })), 'openspec-root');
  assert.equal(it.status, 'manual');
  assert.match(it.description, /openspec init/);
});

test('missing .gitkeep files for the empty OpenSpec folders are planned (a clean checkout needs them)', () => {
  const current = { ...empty(), keepFiles: { 'openspec/specs/.gitkeep': false, 'openspec/changes/archive/.gitkeep': true } };
  const it = get(plan(bare(), current), 'openspec-root');
  assert.equal(it.status, 'todo');
  assert.deepEqual(it.paths, ['openspec/specs/.gitkeep']);
});

test('Scenario: Agent tries to push outside feature branches - a ruleset restricts branch creation, with maintainers and admins allowed', () => {
  const body = pushScopeBody({ base: 'dev', release: 'main' });
  assert.deepEqual(body.rules, [{ type: 'creation' }]);
  assert.deepEqual(body.conditions.ref_name.include, ['~ALL']);
  assert.deepEqual(body.conditions.ref_name.exclude, ['refs/heads/feature/*', 'refs/heads/dev', 'refs/heads/main']);
  assert.deepEqual(body.bypass_actors.map((a) => a.actor_id).sort(), [2, 5]);
  assert.ok(body.bypass_actors.every((a) => a.actor_type === 'RepositoryRole' && a.bypass_mode === 'always'));
  const items = plan(bare());
  assert.equal(get(items, 'push-scope').status, 'todo');
  assert.equal(get(plan(bare(), empty(), false), 'push-scope').status, 'manual');
  assert.equal(get(plan(bare({ pushScope: true })), 'push-scope').status, 'ok');
  assert.equal(get(plan(bare({ protectionUnavailable: 'Upgrade to GitHub Pro' })), 'push-scope').status, 'manual', 'rulesets that the plan does not offer are not attempted');
  const posted = [];
  applyPlan(items.filter((i) => i.id === 'push-scope'), { repo: 'o/r', io: { gh: (a, input) => posted.push(JSON.parse(input).name) } });
  assert.deepEqual(posted, ['relevo-push-scope']);
});

test('Scenario: Branch rules after the files - skipped items are left for a later run and the rest still apply', () => {
  const items = plan(bare());
  const skipped = skipItems(items, ['protection', 'push-scope']);
  assert.equal(get(skipped, 'protection').status, 'skipped');
  assert.equal(get(skipped, 'push-scope').status, 'skipped');
  assert.equal(get(skipped, 'labels').status, 'todo');
  const posted = [];
  const results = applyPlan(skipped, { repo: 'o/r', io: { gh: (a, input) => { posted.push(a.join(' ')); return JSON.stringify({ commit: { sha: 'abc' } }); }, write() {}, append() {} } });
  assert.ok(!results.some((r) => r.id === 'protection' || r.id === 'push-scope'));
  assert.ok(!posted.some((p) => p.includes('/rulesets')));
  assert.equal(get(skipItems(items, ['config']), 'labels').status, 'todo', 'only the named items are skipped');
});

test('Scenario: Second run - secret scanning and the model credential are recognised, not planned again', () => {
  const on = get(plan(bare({ secretScanning: { scanning: true, pushProtection: true }, secrets: ['CLAUDE_CODE_OAUTH_TOKEN'] })), 'secret-scanning');
  assert.equal(on.status, 'ok');
  assert.equal(get(plan(bare({ secretScanning: { scanning: true, pushProtection: true }, secrets: ['CLAUDE_CODE_OAUTH_TOKEN'] })), 'manual.api-key').status, 'ok');
  assert.equal(get(plan(bare({ secretScanning: { scanning: true, pushProtection: false } })), 'secret-scanning').status, 'todo');
  assert.equal(get(plan(bare({ secrets: [] })), 'manual.api-key').status, 'manual');
});

test('Scenario: Monorepo - two platforms with different stacks and paths are written to relevo.yml and validate', () => {
  const platforms = { web: { stack: 'vue', path: 'apps/web' }, api: { stack: 'laravel', path: 'apps/api' } };
  const text = renderConfig(template, { ...ANSWERS, platform: undefined, platforms });
  const { ok, config } = loadConfig(text);
  assert.equal(ok, true);
  assert.deepEqual(Object.keys(config.platforms), ['web', 'api']);
  assert.equal(config.platforms.web.path, 'apps/web');
  assert.ok(!/stack: flutter/.test(text), 'the template platform is replaced, not kept');
  assert.match(text, /^team:/m, 'the rest of the file is intact');
});

test('Scenario: Flutter with targets - the targets are written as a list', () => {
  const text = renderConfig(template, { ...ANSWERS, platform: undefined, platforms: { app: { stack: 'flutter', path: '.', targets: ['android', 'ios', 'web'] } } });
  assert.deepEqual(loadConfig(text).config.platforms.app.targets, ['android', 'ios', 'web']);
});

test('the legacy answer platform: flutter-android still gives one flutter platform', () => {
  const { config } = loadConfig(renderConfig(template, ANSWERS));
  assert.deepEqual(config.platforms.app, { stack: 'flutter', path: '.', targets: ['android'] });
});

test('Scenario: Existing legacy configuration - init keeps relevo.yml as it is', () => {
  const legacy = 'limits:\n  run_max_cost: 5\nplatform: flutter-android\n';
  const facts = { configText: legacy, config: loadConfig(legacy).config, configErrors: [], openspecRoot: true, labels: allLabels, branches: { base: true, release: true }, skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])), openspec: '1.14.1' };
  const items = planInit({ facts, answers: { ...ANSWERS, platforms: { app: { stack: 'vue', path: '.' } } }, templates, current: empty(), admin: true });
  assert.equal(items.find((i) => i.id === 'config').status, 'ok');
  assert.equal(items.find((i) => i.id === 'config').content, undefined);
});

test('Scenario: the optional profile of the repository is created only when asked for, is left for the person to commit, and parses', async () => {
  const { parseProfile } = await import('../scripts/lib/stack-profile.mjs');
  const facts = { configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true }, skills: {} };
  const without = planInit({ facts, answers: ANSWERS, templates, current: empty(), admin: true });
  assert.equal(without.some((i) => i.id.startsWith('stack-profile.')), false);
  const asked = planInit({ facts, answers: { ...ANSWERS, stackProfiles: ['flutter'] }, templates, current: empty(), admin: true }).find((i) => i.id === 'stack-profile.flutter');
  assert.equal(asked.status, 'todo');
  assert.equal(asked.path, '.relevo/stacks/flutter.md');
  assert.match(asked.description, /left for you to commit/);
  const parsed = parseProfile(asked.content);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.profile.stack, 'flutter');
  const written = {};
  applyPlan([asked], { repo: 'o/r', io: { write: (p, t) => { written[p] = t; }, gh: () => '' } });
  assert.equal(Object.keys(written)[0], '.relevo/stacks/flutter.md');
  const exists = planInit({ facts, answers: { ...ANSWERS, stackProfiles: ['flutter'] }, templates, current: { ...empty(), stackProfiles: { flutter: true } }, admin: true }).find((i) => i.id === 'stack-profile.flutter');
  assert.equal(exists.status, 'ok');
});

test('Scenario: Front and back - the linked repositories are written to links and validate', () => {
  const text = renderConfig(template, { ...ANSWERS, links: ['acme/api', 'acme/design'] });
  assert.deepEqual(loadConfig(text).config.links, ['acme/api', 'acme/design']);
  assert.deepEqual(loadConfig(renderConfig(template, ANSWERS)).config.links, [], 'no answer, no links');
  assert.throws(() => renderConfig(template, { ...ANSWERS, links: ['acme'] }), /invalid relevo\.yml.*owner\/repo/);
});

test('init reminds about the read-only secret by name only, and only when there are links', () => {
  const facts = { configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true }, skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])), openspec: '1.14.1', secrets: [] };
  const none = planInit({ facts, answers: ANSWERS, templates, current: empty(), admin: true });
  assert.equal(none.some((i) => i.id === 'manual.links-token'), false);
  const asked = planInit({ facts, answers: { ...ANSWERS, links: ['acme/api'] }, templates, current: empty(), admin: true }).find((i) => i.id === 'manual.links-token');
  assert.equal(asked.status, 'manual');
  assert.match(asked.description, /RELEVO_LINKS_TOKEN/);
  assert.match(asked.description, /init never reads or writes it/);
  assert.doesNotMatch(asked.description, /ghp_|github_pat_/);
  const done = planInit({ facts: { ...facts, secrets: ['RELEVO_LINKS_TOKEN'] }, answers: { ...ANSWERS, links: ['acme/api'] }, templates, current: empty(), admin: true }).find((i) => i.id === 'manual.links-token');
  assert.equal(done.status, 'ok');
});

// ---------- where go runs

import { CREDENTIALS, RUNS, credentialLine } from '../scripts/lib/init.mjs';

const goTemplate = workflows['relevo-go.yml'];
const wf = (items, file) => items.find((i) => i.id === `workflow.${file}`);
const factsFor = (over = {}) => ({ configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true }, skills: Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])), openspec: '1.14.1', secrets: [], ...over });
const planWith = (answers, facts = factsFor()) => planInit({ facts, answers: { ...ANSWERS, ...answers }, templates, current: empty(), admin: true });

test('the credential line is switched on the real template, and the API key is the default', () => {
  assert.match(goTemplate, /^ {10}anthropic_api_key: /m);
  assert.equal(credentialLine(goTemplate, 'api_key'), goTemplate);
  const sub = credentialLine(goTemplate, 'subscription');
  assert.match(sub, /^ {10}claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}/m);
  assert.match(sub, /^ {10}# anthropic_api_key: /m);
  assert.doesNotMatch(sub, /^ {10}anthropic_api_key: /m);
  assert.throws(() => credentialLine('nothing to switch', 'subscription'), /no credential lines to switch/);
  assert.deepEqual([RUNS, CREDENTIALS], [['cloud', 'local', 'both'], ['api_key', 'subscription']]);
});

test('Scenario: Subscription in the cloud - the workflow uses the token, concurrent_agents is 1, and the secret is only reminded by name', () => {
  const items = planWith({ runs: 'cloud', credential: 'subscription' });
  assert.match(wf(items, 'relevo-go.yml').content, /^ {10}claude_code_oauth_token:/m);
  const secret = items.find((i) => i.id === 'manual.api-key');
  assert.equal(secret.status, 'manual');
  assert.match(secret.description, /claude setup-token.*store it yourself as the secret CLAUDE_CODE_OAUTH_TOKEN; init never reads or writes it/);
  assert.match(secret.description, /Anthropic terms on automated use of a subscription/);
  assert.doesNotMatch(secret.description, /sk-ant|ghp_|github_pat_/);
  assert.equal(loadConfig(renderConfig(template, { ...ANSWERS, credential: 'subscription' })).config.limits.concurrent_agents, 1);
  assert.equal(loadConfig(renderConfig(template, { ...ANSWERS, credential: 'subscription', concurrentAgents: 2 })).config.limits.concurrent_agents, 2);
  assert.equal(loadConfig(renderConfig(template, ANSWERS)).config.limits.concurrent_agents, 3, 'an API key keeps the default');
});

test('Scenario: Local only - the go and queue workflows are not added and the plan says how to build', () => {
  const items = planWith({ runs: 'local' });
  assert.equal(wf(items, 'relevo-go.yml'), undefined);
  assert.equal(wf(items, 'relevo-queue.yml'), undefined);
  assert.equal(wf(items, 'relevo-review.yml').status, 'todo', 'the workflows that do not use the model are still added');
  assert.equal(wf(items, 'relevo-ship.yml').status, 'todo', 'Scenario: Local-only setup keeps the ship workflow');
  assert.match(items.find((i) => i.id === 'execution').description, /Run \/relevo:go <n>, or node scripts\/go-local\.mjs <n>/);
  assert.equal(items.find((i) => i.id === 'manual.api-key').status, 'ok');
});

test('Scenario: Default - both with an API key: every workflow, the API key line, and a reminder for ANTHROPIC_API_KEY', () => {
  const items = planWith({});
  assert.equal(wf(items, 'relevo-go.yml').content, goTemplate);
  assert.equal(wf(items, 'relevo-queue.yml').status, 'todo');
  assert.equal(items.some((i) => i.id === 'execution'), false);
  assert.match(items.find((i) => i.id === 'manual.api-key').description, /Anthropic Console.*secret ANTHROPIC_API_KEY/);
});

test('an installed workflow for the chosen credential is up to date, and an invalid answer is refused', () => {
  const current = { ...empty(), workflows: { ...empty().workflows, 'relevo-go.yml': credentialLine(goTemplate, 'subscription') } };
  const items = planInit({ facts: factsFor(), answers: { ...ANSWERS, credential: 'subscription' }, templates, current, admin: true });
  assert.equal(wf(items, 'relevo-go.yml').status, 'ok');
  assert.throws(() => planWith({ runs: 'moon' }), /runs must be one of cloud, local, both/);
  assert.throws(() => planWith({ credential: 'cash' }), /credential must be one of api_key, subscription/);
});

test('Scenario: A repository that does not declare the plugin - an install line with the exact command, never applied by the script', () => {
  const items = plan(bare({ pluginDeclared: { declared: false } }));
  const it = get(items, 'install.plugin-project');
  assert.equal(it.status, 'todo');
  assert.equal(it.install, true);
  assert.equal(it.command, 'claude plugin marketplace add elalfner/relevo --scope project --sparse .claude-plugin && claude plugin install relevo@relevo --scope project');
  assert.match(renderPlan([it]), /\[will do\] Declare the Relevo plugin in the project.*\(claude plugin marketplace add/);
  const calls = [];
  applyPlan([it], { repo: 'o/r', io: { gh: (a) => calls.push(a), write: (p) => calls.push(p), append: (p) => calls.push(p) } });
  assert.deepEqual(calls, []);
});

test('Scenario: A repository that already declares it - the line is reported as in place', () => {
  const it = get(plan(bare({ pluginDeclared: { declared: true } })), 'install.plugin-project');
  assert.equal(it.status, 'ok');
  assert.match(it.description, /declares the Relevo plugin/);
});

test('Scenario: A settings file that cannot be read - a manual step, and nothing is written', () => {
  const it = get(plan(bare({ pluginDeclared: { unreadable: true } })), 'install.plugin-project');
  assert.equal(it.status, 'manual');
  assert.match(it.description, /not valid JSON/);
});

test('without the fact there is no plugin line, so older callers keep their plan', () => {
  assert.equal(get(plan(bare()), 'install.plugin-project'), undefined);
});

// ---- OpenSpec in web sessions

test('Scenario: A repository without the hook - an install line that shows the hook, never applied by the script', () => {
  const it = get(plan(bare({ webHook: { declared: false } })), 'install.web-hook');
  assert.equal(it.status, 'todo');
  assert.equal(it.install, true);
  assert.equal(it.hook, WEB_HOOK_COMMAND);
  assert.match(renderPlan([it]), /\[will do\] Add a hook that installs OpenSpec at the start of a web session/);
  const calls = [];
  applyPlan([it], { repo: 'o/r', io: { gh: (a) => calls.push(a), write: (p) => calls.push(p), append: (p) => calls.push(p) } });
  assert.deepEqual(calls, []);
});

test('Scenario: A repository that already has the hook - the line is reported as in place', () => {
  assert.equal(get(plan(bare({ webHook: { declared: true } })), 'install.web-hook').status, 'ok');
});

test('Scenario: A settings file that cannot be read - a manual step', () => {
  const it = get(plan(bare({ webHook: { unreadable: true } })), 'install.web-hook');
  assert.equal(it.status, 'manual');
  assert.match(it.description, /not valid JSON/);
});

test('without the fact there is no hook line, so older callers keep their plan', () => {
  assert.equal(get(plan(bare()), 'install.web-hook'), undefined);
});

test('Scenario: A settings file with other settings - the hook is added next to them and none changes', () => {
  const before = JSON.stringify({ attribution: { commit: '' }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo bye' }] }], SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] } });
  const after = JSON.parse(mergeWebHook(before));
  assert.deepEqual(after.attribution, { commit: '' });
  assert.deepEqual(after.hooks.Stop, JSON.parse(before).hooks.Stop);
  assert.equal(after.hooks.SessionStart.length, 2);
  assert.deepEqual(after.hooks.SessionStart[0], JSON.parse(before).hooks.SessionStart[0]);
  assert.equal(after.hooks.SessionStart[1].hooks[0].command, WEB_HOOK_COMMAND);
});

test('a missing settings file is created with only the hook, and merging twice adds nothing twice', () => {
  const once = mergeWebHook(null);
  assert.equal(JSON.parse(once).hooks.SessionStart.length, 1);
  assert.equal(mergeWebHook(once), once);
});

test('a settings file that is not a JSON object is never rewritten', () => {
  assert.throws(() => mergeWebHook('{ not json'));
  assert.throws(() => mergeWebHook('[]'), /not a JSON object/);
  assert.throws(() => mergeWebHook('{"hooks":{"SessionStart":{}}}'), /not a list/);
});

// ---- the agent that builds in the cloud

const blocks = readFileSync(`${root}templates/agents/antigravity-step.yml`, 'utf8');
const withBlocks = (answers) => planInit({ facts: factsFor(), answers: { ...ANSWERS, ...answers }, templates: { ...templates, agentBlocks: blocks }, current: empty(), admin: true });

test('Scenario: Antigravity chosen - the go and queue workflows get the Antigravity blocks and the shared lines stay', () => {
  const items = withBlocks({ agentBuild: 'antigravity' });
  const go = wf(items, 'relevo-go.yml').content;
  const queue = wf(items, 'relevo-queue.yml').content;
  assert.ok(!go.includes('anthropics/claude-code-action'));
  assert.match(go, /agent-guard\.mjs" run/);
  assert.match(queue, /HAS_CREDENTIAL: \$\{\{ secrets\.GEMINI_API_KEY != '' \}\}/);
  assert.ok(go.includes('name: Check the toolchain') && go.includes('go-plan.mjs'), 'the rest of the workflow is the shared one');
  const claude = withBlocks({});
  assert.equal(wf(claude, 'relevo-go.yml').content, goTemplate, 'Claude is still the template as it is');
  assert.equal(wf(claude, 'relevo-queue.yml').content, workflows['relevo-queue.yml']);
});

test('an agent other than claude and antigravity is refused, and Antigravity without its blocks is an error', () => {
  assert.throws(() => withBlocks({ agentBuild: 'gemini' }), /agentBuild must be one of claude, antigravity/);
  assert.throws(() => planInit({ facts: factsFor(), answers: { ...ANSWERS, agentBuild: 'antigravity' }, templates, current: empty(), admin: true }), /no file of blocks/);
});

test('relevo.yml for Antigravity asks for a token limit instead of a cost limit, and validates', () => {
  const text = renderConfig(template, { ...ANSWERS, agentBuild: 'antigravity', runMaxTokens: 3000000 });
  assert.match(text, /run_max_tokens: 3000000/);
  assert.ok(!/^\s*run_max_cost:/m.test(text));
  assert.match(text, /\nagent:\n {2}build: antigravity\n$/);
  assert.equal(loadConfig(text).ok, true);
  assert.match(renderConfig(template, { ...ANSWERS, agentBuild: 'antigravity' }), /run_max_tokens: 2000000/);
});

test('Scenario: Supabase platform in init - offers skills install and MCP guidance', () => {
  const facts = {
    configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true },
    skills: { ...Object.fromEntries(REQUIRED_SKILLS.map((n) => [n, true])), supabase: false, 'supabase-postgres-best-practices': false },
    openspec: '1.14.1', secrets: [],
  };
  const answers = {
    ...ANSWERS,
    platforms: {
      backend: { stack: 'supabase', path: 'supabase' },
      app: { stack: 'flutter', path: 'app', targets: ['android'] },
    },
  };
  const items = planInit({ facts, answers, templates, current: empty(), admin: true });
  assert.equal(get(items, 'install.skill.supabase').status, 'todo');
  assert.match(get(items, 'install.skill.supabase').command, /npx skills add supabase\/agent-skills --skill supabase/);
  assert.equal(get(items, 'install.skill.supabase-postgres-best-practices').status, 'todo');
  assert.match(get(items, 'install.skill.supabase-postgres-best-practices').command, /supabase-postgres-best-practices/);
  assert.equal(get(items, 'manual.supabase-mcp').status, 'manual');
  assert.match(get(items, 'manual.supabase-mcp').description, /Supabase MCP/);
});

// ---------- what a browser review of Vue needs

const VUE = { site: { stack: 'vue', path: 'apps/site', targets: ['web'] } };
const vuePlan = (vueWeb, platforms = VUE, over = {}) => planInit({ facts: bare({ vueWeb, ...over }), answers: { ...ANSWERS, platform: undefined, platforms }, templates, current: empty(), admin: true });

test('Scenario: Vue platform without the browser library - init offers it as a dev dependency in the platform folder, then its Chromium', () => {
  const items = vuePlan({ site: { playwright: false, chromium: false } });
  const add = items.find((i) => i.id === 'install.playwright.site');
  assert.deepEqual([add.status, add.install, add.command], ['todo', true, 'cd apps/site && npm install -D playwright']);
  assert.match(add.description, /left for you to commit/);
  const browser = items.find((i) => i.id === 'install.chromium.site');
  assert.deepEqual([browser.status, browser.command], ['todo', 'cd apps/site && npx playwright install chromium']);
  assert.ok(items.indexOf(add) < items.indexOf(browser), 'Playwright is added before its browser');
  assert.match(renderPlan(items), /\(cd apps\/site && npm install -D playwright\)/);
});

test('Scenario: Browser not installed / Already set up - only what is missing is offered', () => {
  const chromiumOnly = vuePlan({ site: { playwright: true, chromium: false } });
  assert.equal(chromiumOnly.find((i) => i.id === 'install.playwright.site').status, 'ok');
  assert.equal(chromiumOnly.find((i) => i.id === 'install.chromium.site').status, 'todo');
  const ready = vuePlan({ site: { playwright: true, chromium: true } });
  assert.deepEqual(ready.filter((i) => /^install\.(playwright|chromium)\./.test(i.id)).map((i) => i.status), ['ok', 'ok']);
  const atRoot = vuePlan({ app: { playwright: false, chromium: false } }, { app: { stack: 'vue', path: '.' } });
  assert.equal(atRoot.find((i) => i.id === 'install.playwright.app').command, 'npm install -D playwright');
});

test('init offers no Playwright for a platform that is not Vue on the web', () => {
  const flutter = plan(bare({ vueWeb: {} }));
  assert.equal(flutter.some((i) => /^install\.(playwright|chromium)\./.test(i.id)), false);
  const desktop = vuePlan({}, { site: { stack: 'vue', path: 'apps/site', targets: ['desktop'] } });
  assert.equal(desktop.some((i) => /^install\.(playwright|chromium)\./.test(i.id)), false);
});

test('Scenario: New configuration with a Vue web platform - relevo.yml has review.autopilot precheck', () => {
  const config = loadConfig(vuePlan({ site: { playwright: true, chromium: true } }).find((i) => i.id === 'config').content).config;
  assert.equal(config.review.autopilot, 'precheck');
  const flutter = loadConfig(plan(bare()).find((i) => i.id === 'config').content).config;
  assert.equal(flutter.review.autopilot, 'off');
  assert.equal(loadConfig(renderConfig(template, { platforms: VUE, autopilot: 'verify' })).config.review.autopilot, 'verify');
});

test('Scenario: Existing configuration with the autopilot off - a manual step, and relevo.yml is not rewritten', () => {
  const text = 'limits:\n  run_max_cost: 5\nreview:\n  autopilot: off\nplatforms:\n  site:\n    stack: vue\n    path: apps/site\n    targets: [web]\n';
  const items = planInit({ facts: bare({ configText: text, config: loadConfig(text).config, vueWeb: { site: { playwright: true, chromium: true } } }), answers: ANSWERS, templates, current: empty(), admin: true });
  assert.equal(items.find((i) => i.id === 'config').status, 'ok');
  const manual = items.find((i) => i.id === 'review.autopilot');
  assert.equal(manual.status, 'manual');
  assert.match(manual.description, /set review\.autopilot to precheck \(or verify\)/);
  const on = text.replace('autopilot: off', 'autopilot: precheck');
  assert.equal(planInit({ facts: bare({ configText: on, config: loadConfig(on).config, vueWeb: {} }), answers: ANSWERS, templates, current: empty(), admin: true }).some((i) => i.id === 'review.autopilot'), false);
});

test('Scenario: Default - without a runner the workflows run on ubuntu-latest and relevo.yml has no runner key', () => {
  const items = plan(bare());
  WORKFLOW_FILES.forEach((f) => assert.equal(get(items, `workflow.${f}`).content, workflows[f]));
  assert.ok(!/^runner:/m.test(get(items, 'config').content));
  assert.ok(!/^\s*labels:/m.test(get(items, 'config').content), 'the example stays commented out');
});

test('Scenario: Self-hosted - the labels go into relevo.yml and into every runs-on of every generated workflow', () => {
  const items = planInit({ facts: bare(), answers: { ...ANSWERS, runnerLabels: ['self-hosted', 'Front'] }, templates, current: empty(), admin: true });
  const config = loadConfig(get(items, 'config').content);
  assert.ok(config.ok);
  assert.deepEqual(config.config.runner.labels, ['self-hosted', 'Front']);
  WORKFLOW_FILES.forEach((f) => {
    const text = get(items, `workflow.${f}`).content;
    assert.ok(/runs-on: \[self-hosted, Front\]/.test(text), f);
    assert.ok(!/runs-on: ubuntu-latest/.test(text), f);
    assert.equal((text.match(/runs-on:/g) ?? []).length, (workflows[f].match(/runs-on:/g) ?? []).length, `${f} keeps every job`);
  });
});

test('Scenario: Regenerating a workflow - a repository that sets runner.labels gets them in a workflow it adds', () => {
  const config = loadConfig(renderConfig(template, { ...ANSWERS, runnerLabels: ['self-hosted', 'Front'] })).config;
  const current = empty();
  current.workflows['relevo-ship.yml'] = null;
  const items = planInit({ facts: bare({ config }), answers: ANSWERS, templates, current, admin: true });
  assert.match(get(items, 'workflow.relevo-ship.yml').content, /runs-on: \[self-hosted, Front\]/);
});

test('a workflow already written for the runner of the repository is reported as up to date', () => {
  const config = loadConfig(renderConfig(template, { ...ANSWERS, runnerLabels: ['self-hosted', 'Front'] })).config;
  const current = empty();
  current.workflows['relevo-sla.yml'] = workflows['relevo-sla.yml'].replaceAll('runs-on: ubuntu-latest', 'runs-on: [self-hosted, Front]');
  const items = planInit({ facts: bare({ config }), answers: ANSWERS, templates, current, admin: true });
  assert.equal(get(items, 'workflow.relevo-sla.yml').status, 'ok');
});

test('a runner with one label is written as that label, and an invalid list is refused by renderConfig', () => {
  const items = planInit({ facts: bare(), answers: { ...ANSWERS, runnerLabels: ['my-runner'] }, templates, current: empty(), admin: true });
  assert.match(get(items, 'workflow.relevo-sla.yml').content, /runs-on: my-runner\n/);
  assert.throws(() => renderConfig(template, { ...ANSWERS, runnerLabels: [] }), /needs at least one label|runner example/);
});

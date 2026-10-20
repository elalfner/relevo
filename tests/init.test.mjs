import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { REQUIRED_SKILLS, WORKFLOW_FILES } from '../scripts/lib/doctor.mjs';
import { applyPlan, manualChecklist, planInit, pushScopeBody, renderConfig, renderPlan, rulesetBody, skipItems } from '../scripts/lib/init.mjs';
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
  assert.equal(get(items, 'labels').labels.length, 11);
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
  assert.equal(calls.filter((c) => c.args[0] === 'label').length, 11);
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

test('Scenario: the optional profile of the repository is created only when asked for, is not committed, and parses', async () => {
  const { parseProfile } = await import('../scripts/lib/stack-profile.mjs');
  const facts = { configText: null, config: null, configErrors: [], openspecRoot: true, labels: [], branches: { base: false, release: true }, skills: {} };
  const without = planInit({ facts, answers: ANSWERS, templates, current: empty(), admin: true });
  assert.equal(without.some((i) => i.id.startsWith('stack-profile.')), false);
  const asked = planInit({ facts, answers: { ...ANSWERS, stackProfiles: ['flutter'] }, templates, current: empty(), admin: true }).find((i) => i.id === 'stack-profile.flutter');
  assert.equal(asked.status, 'todo');
  assert.equal(asked.path, '.relevo/stacks/flutter.md');
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

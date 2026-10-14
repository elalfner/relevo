import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { REQUIRED_SKILLS, WORKFLOW_FILES } from '../scripts/lib/doctor.mjs';
import { applyPlan, manualChecklist, planInit, pushScopeBody, renderConfig, renderPlan, rulesetBody } from '../scripts/lib/init.mjs';
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
  const posted = [];
  applyPlan(items.filter((i) => i.id === 'push-scope'), { repo: 'o/r', io: { gh: (a, input) => posted.push(JSON.parse(input).name) } });
  assert.deepEqual(posted, ['relevo-push-scope']);
});

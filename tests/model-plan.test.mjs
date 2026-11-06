import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';
import { configPlan, escalateDev, isSensitive, planModels, sizeOf } from '../scripts/lib/model-plan.mjs';

const cfg = (yaml = '') => {
  const r = loadConfig(`limits:\n  run_max_cost: 5\n${yaml}`);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.config;
};
const ALL_AUTO = 'agents:\n  dev:\n    model: auto\n  qa:\n    spec:\n      model: auto\n    security:\n      model: auto\n    code:\n      model: auto\n    interface:\n      model: auto\n';
const scenarios = (n) => Array.from({ length: n }, (_, i) => `- **WHEN** case ${i}\n- **THEN** result ${i}\n`).join('\n');
const issue = (n, extra = '') => ({ title: 'A change', body: `## Scenarios\n${scenarios(n)}\n${extra}` });
const tasks = (n) => `## 1. Work\n\n${Array.from({ length: n }, (_, i) => `- [ ] 1.${i + 1} do thing ${i}`).join('\n')}\n`;

test('sizeOf: up to 6 is small, up to 14 medium, more is large, nothing is none', () => {
  assert.equal(sizeOf(0, 0), 'none');
  assert.equal(sizeOf(3, 3), 'small');
  assert.equal(sizeOf(3, 4), 'medium');
  assert.equal(sizeOf(7, 7), 'medium');
  assert.equal(sizeOf(8, 7), 'large');
});

test('isSensitive: security areas in English and Spanish, but not a design token', () => {
  assert.equal(isSensitive('Add a login with a password'), true);
  assert.equal(isSensitive('guardar la contraseña cifrada'), true);
  assert.equal(isSensitive('change the payment screen'), true);
  assert.equal(isSensitive('use the design tokens of the theme'), false, 'a design token is not a credential');
  assert.equal(isSensitive('The author of the list'), false, '"author" is not "authorization"');
  assert.equal(isSensitive('show a message when the counter reaches 50'), false);
});

test('Scenario: A small issue with the developer on auto - the plan gives it the floor and says the issue is small', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2), tasksText: tasks(2) });
  assert.equal(p.dev.model, 'haiku');
  assert.equal(p.dev.source, 'auto');
  assert.match(p.dev.why, /small change \(2 tasks, 2 scenarios\)/);
  assert.deepEqual([p.qa.spec.model, p.qa.security.model, p.qa.code.model, p.qa.interface.model], ['sonnet', 'sonnet', 'sonnet', 'sonnet'], 'no QA lens goes below sonnet by default');
});

test('Scenario: A medium issue takes the middle of the range and a large one the ceiling', () => {
  const config = cfg('agents:\n  dev:\n    model: auto\n    floor: haiku\n    ceiling: opus\n');
  assert.equal(planModels({ config, issue: issue(5), tasksText: tasks(4) }).dev.model, 'sonnet', 'medium: the middle, rounded up');
  assert.equal(planModels({ config, issue: issue(10), tasksText: tasks(10) }).dev.model, 'opus', 'large: the ceiling');
});

test('Scenario: A role that is not on auto keeps its model, whatever the issue says', () => {
  const config = cfg('agents:\n  qa:\n    code:\n      model: sonnet\n');
  const p = planModels({ config, issue: issue(2, 'QA-model: opus\n'), tasksText: tasks(2) });
  assert.deepEqual(p.qa.code, { model: 'sonnet', effort: 'high', source: 'config', why: 'set in relevo.yml' });
  assert.match(p.notes.join('|'), /QA-model: of the issue is ignored: no QA lens is auto/);
});

test('Scenario: The issue asks for a lower model - it is used, even below the floor', () => {
  const config = cfg('agents:\n  dev:\n    model: auto\n    floor: sonnet\n    ceiling: sonnet\n');
  const p = planModels({ config, issue: issue(10, 'Model: haiku\n'), tasksText: tasks(10) });
  assert.equal(p.dev.model, 'haiku');
  assert.equal(p.dev.source, 'issue');
});

test('Scenario: The issue asks for a model above the ceiling - it is clamped and the plan says so', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2, 'Model: opus\n'), tasksText: tasks(2) });
  assert.equal(p.dev.model, 'sonnet');
  assert.equal(p.dev.source, 'issue');
  assert.match(p.dev.why, /clamped to the ceiling sonnet/);
});

test('Scenario: QA-model reaches every lens on auto, each clamped to its own ceiling', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2, 'QA-model: opus\n'), tasksText: tasks(2) });
  assert.equal(p.qa.security.model, 'opus', 'its ceiling is opus');
  assert.equal(p.qa.spec.model, 'opus');
  assert.equal(p.qa.code.model, 'sonnet', 'its ceiling is sonnet');
  assert.equal(p.qa.interface.model, 'sonnet');
});

test('Scenario: Public trust - the lines of the issue are ignored and the plan says why', () => {
  const p = planModels({ config: cfg(`trust: public\n${ALL_AUTO}`), issue: issue(2, 'Model: haiku\n'), tasksText: tasks(2) });
  assert.equal(p.dev.model, 'haiku', 'the floor, by size, not by the issue');
  assert.equal(p.dev.source, 'auto');
  assert.match(p.notes.join('|'), /trust is public, so the Model: and QA-model: lines of the issue are ignored/);
});

test('Scenario: A name the ladder does not have - the line is ignored and the plan names the value and the ladder', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2, 'Model: gpt-5\n'), tasksText: tasks(2) });
  assert.equal(p.dev.source, 'auto');
  assert.match(p.notes.join('|'), /"gpt-5" for agents\.dev, which is not in agents\.ladder \(haiku, sonnet, opus\)/);
});

test('Scenario: A security-sensitive issue - the security lens runs on its ceiling and the others go one step up', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2, 'Users sign in with a password.\n'), tasksText: tasks(2) });
  assert.equal(p.qa.security.model, 'opus');
  assert.equal(p.dev.model, 'sonnet', 'small raised one step reaches the ceiling of a two-name range');
  assert.match(p.dev.why, /a security-sensitive area is named/);
});

test('Scenario: A dependency file in Allow-paths raises the pick', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2, 'Allow-paths: pubspec.yaml\n'), tasksText: tasks(2) });
  assert.equal(p.signals.dependency_files, true);
  assert.equal(p.qa.security.model, 'opus');
  assert.match(p.dev.why, /a dependency file is allowed/);
});

test('Scenario: Too few signals - every role on auto uses the default model of the role and the reason says so', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: { title: 'x', body: 'nothing to score' }, tasksText: null });
  assert.deepEqual([p.dev.model, p.qa.spec.model, p.qa.security.model, p.qa.code.model, p.qa.interface.model], ['sonnet', 'opus', 'opus', 'sonnet', 'sonnet']);
  assert.match(p.dev.why, /there was nothing to score/);
});

test('the same inputs give the same plan', () => {
  const a = planModels({ config: cfg(ALL_AUTO), issue: issue(5, 'Model: haiku\n'), tasksText: tasks(5) });
  const b = planModels({ config: cfg(ALL_AUTO), issue: issue(5, 'Model: haiku\n'), tasksText: tasks(5) });
  assert.deepEqual(a, b);
});

test('only the lenses that run get an entry', () => {
  const p = planModels({ config: cfg(ALL_AUTO), issue: issue(2), tasksText: tasks(2), lenses: ['spec', 'security', 'code'] });
  assert.deepEqual(Object.keys(p.qa), ['spec', 'security', 'code']);
});

test('Scenario: The plan never raises the cost limit - it carries no limit and the effort is the configured one', () => {
  const p = planModels({ config: cfg(`${ALL_AUTO.replace('model: auto\n  qa', 'model: auto\n    effort: low\n  qa')}`), issue: issue(10, 'Model: opus\n'), tasksText: tasks(10) });
  assert.equal(p.dev.effort, 'low');
  assert.equal(JSON.stringify(p).includes('run_max'), false);
});

test('configPlan: a role on auto gets the default model of the role, the others their own', () => {
  const p = configPlan(cfg('agents:\n  dev:\n    model: auto\n  qa:\n    code:\n      model: haiku\n'), 'the plan could not be made');
  assert.equal(p.dev.model, 'sonnet');
  assert.equal(p.qa.code.model, 'haiku');
  assert.equal(p.qa.spec.model, 'opus');
  assert.ok([p.dev, p.qa.spec].every((r) => r.source === 'config'));
});

// ---------- The command

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/model-plan.mjs', import.meta.url));
function folder(yaml = ALL_AUTO, { issueText = issue(2).body, tasksText = tasks(2) } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-model-plan-'));
  writeFileSync(join(dir, 'relevo.yml'), `limits:\n  run_max_cost: 5\n${yaml}`);
  writeFileSync(join(dir, 'issue.md'), issueText);
  writeFileSync(join(dir, 'tasks.md'), tasksText);
  return dir;
}
const run = (dir, args = [], env = {}) => spawnSync(process.execPath, [CLI, '--issue-file', 'issue.md', '--tasks', 'tasks.md', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: '', ...env } });

test('the command prints the plan of a role on auto, and exits 0', () => {
  const r = run(folder());
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.dev.model, 'haiku');
  assert.equal(plan.dev.source, 'auto');
  assert.deepEqual(Object.keys(plan.qa), ['spec', 'security', 'code', 'interface']);
});

test('the command with roles that are not on auto prints the configuration', () => {
  const plan = JSON.parse(run(folder('')).stdout);
  assert.deepEqual([plan.dev.model, plan.dev.source, plan.qa.spec.model], ['sonnet', 'config', 'opus']);
});

test('the command saves the plan in the progress folder when there is one', () => {
  const dir = folder();
  const progress = mkdtempSync(join(tmpdir(), 'relevo-model-progress-'));
  run(dir, [], { RELEVO_PROGRESS_DIR: progress });
  const saved = JSON.parse(readFileSync(join(progress, 'model-plan.json'), 'utf8'));
  assert.equal(saved.dev.model, 'haiku');
});

test('the command without a progress folder saves nothing and still prints', () => {
  const dir = folder();
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(existsSync(join(dir, 'model-plan.json')), false);
});

test('the command with a lens list prints only those lenses', () => {
  const plan = JSON.parse(run(folder(), ['--lenses', 'spec,code,nonsense']).stdout);
  assert.deepEqual(Object.keys(plan.qa), ['spec', 'code']);
});

test('the command with an invalid relevo.yml fails open: exit 0 and a reason', () => {
  const dir = folder('agents:\n  dev:\n    model: auto\n    floor: opus\n    ceiling: sonnet\n');
  const r = run(dir);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.failed, true);
  assert.match(out.reason, /relevo\.yml is not valid/);
});

test('the command without relevo.yml or without the files of the issue still exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-model-empty-'));
  const r = spawnSync(process.execPath, [CLI], { cwd: dir, encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: '' } });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).failed, true);
  const none = run(folder(), ['--issue-file', 'missing.md']);
  assert.equal(none.status, 0);
});

const DEV_AUTO = 'agents:\n  dev:\n    model: auto\n    ceiling: opus\n';

test('Scenario: QA rejected and the developer is on auto - the retry runs one name up the ladder', () => {
  const r = escalateDev({ config: cfg(DEV_AUTO), from: 'haiku', attempt: 2, reason: 'qa-rejected' });
  assert.deepEqual([r.model, r.escalated, r.from, r.to, r.attempt], ['sonnet', true, 'haiku', 'sonnet', 2]);
  assert.match(r.why, /raised from haiku to sonnet for attempt 2 \(qa-rejected\)/);
  assert.equal(escalateDev({ config: cfg(DEV_AUTO), from: 'sonnet', attempt: 3, reason: 'gate-red' }).model, 'opus', 'each retry goes one more name up');
});

test('Scenario: the developer is at its ceiling - the model stays and the reason says so', () => {
  const r = escalateDev({ config: cfg(DEV_AUTO), from: 'opus', attempt: 3, reason: 'qa-rejected' });
  assert.deepEqual([r.model, r.escalated], ['opus', false]);
  assert.match(r.why, /already the ceiling/);
  const low = escalateDev({ config: cfg('agents:\n  dev:\n    model: auto\n'), from: 'sonnet', attempt: 2, reason: 'qa-rejected' });
  assert.equal(low.escalated, false, 'the default ceiling is sonnet: a retry never costs more than the defaults');
});

test('Scenario: the developer is not on auto, or the reason is not one - nothing is raised', () => {
  assert.equal(escalateDev({ config: cfg('agents:\n  dev:\n    model: haiku\n'), from: 'haiku', attempt: 2, reason: 'qa-rejected' }).escalated, false);
  assert.equal(escalateDev({ config: cfg(DEV_AUTO), from: 'haiku', attempt: 2, reason: 'because' }).escalated, false);
  assert.equal(escalateDev({ config: cfg(DEV_AUTO), from: 'gpt', attempt: 2, reason: 'qa-rejected' }).escalated, false, 'a name outside the ladder');
});

test('the escalate command prints the model, records the step for the report and exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-escalate-'));
  const conf = join(dir, 'relevo.yml');
  writeFileSync(conf, `limits:\n  run_max_cost: 5\n${DEV_AUTO}`);
  writeFileSync(join(dir, 'model-plan.json'), JSON.stringify({ dev: { model: 'haiku', source: 'auto' } }));
  const env = { ...process.env, RELEVO_PROGRESS_DIR: dir };
  const run = (...args) => spawnSync(process.execPath, [CLI, 'escalate', '--config', conf, ...args], { encoding: 'utf8', env });
  const first = run('--from', 'haiku', '--attempt', '2', '--reason', 'qa-rejected');
  assert.equal(first.status, 0);
  assert.deepEqual(JSON.parse(first.stdout).model, 'sonnet');
  run('--from', 'sonnet', '--attempt', '3', '--reason', 'gate-red');
  const saved = JSON.parse(readFileSync(join(dir, 'model-plan.json'), 'utf8'));
  assert.deepEqual(saved.escalations.map((e) => [e.attempt, e.from, e.to, e.reason]), [[2, 'haiku', 'sonnet', 'qa-rejected'], [3, 'sonnet', 'opus', 'gate-red']]);
  assert.equal(saved.dev.model, 'haiku', 'the plan itself is not rewritten');
  const none = run('--from', 'opus', '--attempt', '4', '--reason', 'qa-rejected');
  assert.equal(JSON.parse(none.stdout).escalated, false);
  assert.equal(JSON.parse(readFileSync(join(dir, 'model-plan.json'), 'utf8')).escalations.length, 2, 'a step that did not happen is not recorded');
  const broken = spawnSync(process.execPath, [CLI, 'escalate', '--config', join(dir, 'missing.yml')], { encoding: 'utf8', env });
  assert.equal(broken.status, 0);
  assert.equal(JSON.parse(broken.stdout).failed, true);
});

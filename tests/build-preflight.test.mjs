import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedPaths, checkIssueStage, checkSpecStage, missingText } from '../scripts/lib/build-preflight.mjs';

const CLI = new URL('../scripts/build-preflight.mjs', import.meta.url).pathname;
const COMMIT = new URL('../scripts/commit-change.mjs', import.meta.url).pathname;

const GOOD = `## Scenarios
- **WHEN** a person opens the screen
- **THEN** the total is shown

## Edge cases
- no data: an empty state
`;
const withInputs = (bullets) => `${GOOD}\n## External inputs\n\n${bullets}\n`;
const issueStage = (bullets, extra = {}) => checkIssueStage({ body: withInputs(bullets), ...extra });

// ---------------------------------------------------------------- stage issue

test('Scenario: A declared file does not exist - the decision is needs-spec with the reason inputs and the file is named', () => {
  const r = issueStage('- file: `design/logo.svg`: the logo', { exists: () => false });
  assert.equal(r.decision, 'needs-spec');
  assert.equal(r.reason, 'inputs');
  assert.deepEqual(r.findings.map((f) => [f.kind, f.input_kind, f.name]), [['input', 'file', 'design/logo.svg']]);
  assert.match(missingText(r), /External input file `design\/logo\.svg`: the file does not exist on the base branch/);
});

test('a declared file that exists passes', () => {
  assert.equal(issueStage('- file: `design/logo.svg`: the logo', { exists: (p) => p === 'design/logo.svg' }).decision, 'ok');
});

test('Scenario: An issue without the section - the check passes', () => {
  const r = checkIssueStage({ body: GOOD });
  assert.deepEqual([r.decision, r.reason, r.findings, r.unverified], ['ok', null, [], []]);
});

test('Scenario: An input that a person confirms - a manual input never blocks and is listed', () => {
  const r = issueStage('- manual: the terms of use: the client sends them');
  assert.equal(r.decision, 'ok');
  assert.deepEqual(r.unverified.map((u) => [u.kind, u.name]), [['manual', 'the terms of use']]);
});

test('Scenario: A secret is never shown - only whether the workflow exposed it is learned, and the value is nowhere', () => {
  const bullets = '- secret: `SITE_KEY`: the key';
  const exposed = issueStage(bullets, { env: { SITE_KEY: 'TOP-SECRET-VALUE-12345' } });
  assert.equal(exposed.decision, 'ok');
  assert.deepEqual(exposed.unverified, []);
  assert.doesNotMatch(JSON.stringify(exposed), /TOP-SECRET-VALUE/);
  const hidden = issueStage(bullets, { env: {} });
  assert.equal(hidden.decision, 'ok', 'a secret the job cannot see never blocks');
  assert.deepEqual(hidden.unverified.map((u) => u.kind), ['secret']);
});

test('a variable must be set when the names of the variables are known, and is unverified when they are not', () => {
  const bullets = '- variable: `API_URL`: the address';
  assert.equal(issueStage(bullets, { variables: ['API_URL', 'OTHER'] }).decision, 'ok');
  const missing = issueStage(bullets, { variables: ['OTHER'] });
  assert.deepEqual([missing.decision, missing.reason, missing.findings[0].detail], ['needs-spec', 'inputs', 'the variable is not set in the repository']);
  const unknown = issueStage(bullets, { variables: null });
  assert.deepEqual([unknown.decision, unknown.unverified.map((u) => u.kind)], ['ok', ['variable']]);
});

test('a link input must have been fetched: a refusal blocks with the reason inputs, a missing manifest is unverified', () => {
  const bullets = '- link: `acme/api:schema.graphqls`: the schema';
  const fetched = issueStage(bullets, { manifest: { files: [{ reference: 'acme/api:schema.graphqls' }], refused: [] } });
  assert.deepEqual([fetched.decision, fetched.unverified], ['ok', []]);
  const refused = issueStage(bullets, { manifest: { files: [], refused: [{ reference: 'acme/api:schema.graphqls', reason: 'not found (HTTP 404): the repository is private' }] } });
  assert.deepEqual([refused.decision, refused.reason], ['needs-spec', 'inputs']);
  assert.match(missingText(refused), /External input link `acme\/api:schema\.graphqls`: not found \(HTTP 404\)/);
  assert.deepEqual(issueStage(bullets, { manifest: null }).unverified.map((u) => u.kind), ['link']);
});

test('Scenario: A reference cannot be read - a refused design reference keeps the reason missing and its text', () => {
  const r = checkIssueStage({ body: GOOD, manifest: { files: [], refused: [{ reference: 'acme/design:wallpaper.webp', reason: 'the repository could not be read (HTTP 404)' }] } });
  assert.deepEqual([r.decision, r.reason], ['needs-spec', 'missing']);
  assert.equal(missingText(r), 'acme/design:wallpaper.webp: the repository could not be read (HTTP 404)');
});

test('a refused reference together with a missing input reports both, with the reason missing', () => {
  const r = issueStage('- file: `a.txt`: x', { exists: () => false, manifest: { files: [], refused: [{ reference: 'r', reason: 'nope' }] } });
  assert.equal(r.reason, 'missing');
  assert.equal(r.findings.length, 2);
});

// ---------------------------------------------------------------- stage spec

const tasks = (...lines) => `# Tasks\n\n## 1. Work\n\n${lines.map((l) => `- [ ] ${l}`).join('\n')}\n`;
const specStage = (taskLines, extra = {}) => checkSpecStage({ tasksText: tasks(...[].concat(taskLines)), ...extra });

test('Scenario: A task edits a protected file - the decision is needs-spec with the reason policy, the task and the path', () => {
  const r = specStage('1.1 Update the Storybook rule in CLAUDE.md', { rulesFile: 'CLAUDE.md' });
  assert.deepEqual([r.decision, r.reason], ['needs-spec', 'policy']);
  assert.deepEqual(r.findings.map((f) => [f.kind, f.path, f.tier]), [['path', 'CLAUDE.md', 'hard']]);
  assert.match(missingText(r), /task "1\.1 Update the Storybook rule in CLAUDE\.md" changes CLAUDE\.md, a protected path/);
});

test('a workflow, the configuration and a skills folder are protected whatever the issue says', () => {
  ['Edit `.github/workflows/ci.yml` to add a job', 'Change relevo.yml so the limit is higher', 'Add a skill under .claude/skills/x/SKILL.md'].forEach((task) => {
    const r = specStage(task, { allow: ['.github/workflows/ci.yml', 'relevo.yml'] });
    assert.equal(r.decision, 'needs-spec', task);
    assert.equal(r.findings[0].tier, 'hard', task);
  });
});

test('Scenario: A dependency the issue allowed - a manifest in Allow-paths passes, and without it the task is refused', () => {
  const line = 'Add the chart library to package.json';
  assert.equal(specStage(line, { allow: ['package.json', 'package-lock.json'] }).decision, 'ok');
  const refused = specStage(line);
  assert.deepEqual(refused.findings.map((f) => [f.path, f.tier]), [['package.json', 'soft']]);
  assert.match(missingText(refused), /a dependency file that the issue does not allow in Allow-paths:/);
});

test('a task that adds a dependency without naming its file is refused unless the issue allows a manifest', () => {
  const line = 'Install the chart package and use it in the report';
  assert.equal(specStage(line).findings[0].kind, 'dependency');
  assert.equal(specStage(line, { allow: ['package.json'] }).decision, 'ok');
  assert.equal(specStage('Run `npm install` and add the date library').findings[0].kind, 'dependency');
  assert.equal(specStage('Añadir la dependencia de gráficos').findings[0].kind, 'dependency');
});

test('Scenario: A path only mentioned - a task that reads the file, or a file in prose or in the design, does not block', () => {
  const r = checkSpecStage({ tasksText: `# Tasks\n\nThe design says CLAUDE.md must not change; see .github/workflows/ci.yml.\n\n- [ ] 1.1 Read CLAUDE.md and follow its rules\n- [ ] 1.2 Add the total to the screen, as the rules in CLAUDE.md say\n`, rulesFile: 'CLAUDE.md' });
  assert.deepEqual([r.decision, r.findings], ['ok', []]);
});

test('the verbs of the repository language count: Spanish verbs are read too', () => {
  assert.equal(specStage('Actualizar CLAUDE.md con la regla nueva', { rulesFile: 'CLAUDE.md' }).decision, 'needs-spec');
  assert.equal(specStage('Leer CLAUDE.md antes de empezar', { rulesFile: 'CLAUDE.md' }).decision, 'ok');
});

test('a restricted file in a task is refused', () => {
  const r = specStage('Write the key to .env.production');
  assert.deepEqual(r.findings.map((f) => [f.path, f.tier]), [['.env.production', 'restricted']]);
});

test('a normal task in the platform passes', () => {
  assert.equal(specStage(['1.1 Add the total to src/views/Home.vue', '1.2 Write tests/home.test.ts for the empty state']).decision, 'ok');
});

test('changedPaths takes only what follows the verb, and trims punctuation', () => {
  assert.deepEqual(changedPaths('Update `src/a.ts` and src/b.ts, then CLAUDE.md.'), ['src/a.ts', 'src/b.ts', 'CLAUDE.md']);
  assert.deepEqual(changedPaths('CLAUDE.md says to update src/a.ts'), ['src/a.ts']);
  assert.deepEqual(changedPaths('Look at src/a.ts'), []);
});

// ---------------------------------------------------------------- the checks are never a control

function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-bp-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  Object.entries(files).forEach(([path, content]) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  });
  return { dir, git };
}

test('Scenario: The check misses nothing the guards would not also refuse - the commit script refuses every path the preflight flags', () => {
  const { dir } = repoWith({ 'CLAUDE.md': 'rules', '.github/workflows/ci.yml': 'on: push', 'package.json': '{}', '.env.production': 'KEY=1', 'relevo.yml': 'limits:\n  run_max_cost: 5\nqa:\n  rules_from: CLAUDE.md\n' });
  const flagged = specStage(['Update CLAUDE.md', 'Edit .github/workflows/ci.yml', 'Add a dependency to package.json', 'Write .env.production'], { rulesFile: 'CLAUDE.md' });
  assert.equal(flagged.findings.length, 4);
  flagged.findings.forEach((f) => {
    const r = spawnSync('node', [COMMIT, '--message', 'x', '--', f.path], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1, `the commit script must also refuse ${f.path}: ${r.stdout}${r.stderr}`);
  });
});

test('Scenario: The checks are absent - the guards behave the same without the preflight', () => {
  const { dir } = repoWith({ 'package.json': '{}' });
  const r = spawnSync('node', [COMMIT, '--message', 'x', '--', 'package.json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1, 'a manifest is refused without an Allow-paths: line, with or without the preflight');
});

// ---------------------------------------------------------------- the command

function run(args, { cwd, env = {} } = {}) {
  const r = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch { /* not JSON */ }
  return { ...r, json };
}

test('the command: stage issue prints the decision and exits 1 for needs-spec', () => {
  const { dir } = repoWith({ 'issue.md': withInputs('- file: `design/logo.svg`: the logo\n- manual: the terms: the client sends them'), 'relevo.yml': 'limits:\n  run_max_cost: 5\n' });
  const r = run(['--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', join(dir, 'relevo.yml')], { cwd: dir });
  assert.equal(r.status, 1);
  assert.deepEqual([r.json.stage, r.json.decision, r.json.reason], ['issue', 'needs-spec', 'inputs']);
  assert.match(r.json.missing, /design\/logo\.svg/);
  assert.match(r.json.note, /an optimisation and not a security control/);
  assert.deepEqual(r.json.unverified.map((u) => u.kind), ['manual']);
  mkdirSync(join(dir, 'design'));
  writeFileSync(join(dir, 'design', 'logo.svg'), '<svg/>');
  assert.equal(run(['--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', join(dir, 'relevo.yml')], { cwd: dir }).status, 0);
});

test('the command: the file is looked up on the base branch when --base is given', () => {
  const { dir, git } = repoWith({ 'design/logo.svg': '<svg/>', 'issue.md': withInputs('- file: `design/logo.svg`: the logo') });
  git('add', 'design'); git('commit', '-q', '-m', 'logo');
  git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  const args = ['--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', join(dir, 'none.yml')];
  assert.equal(run([...args, '--base', 'dev'], { cwd: dir }).status, 0);
  assert.equal(run([...args, '--base', 'other'], { cwd: dir }).status, 1);
});

test('the command: only the names of the variables are read, never their values', () => {
  const { dir } = repoWith({ 'issue.md': withInputs('- variable: `API_URL`: the address'), 'vars.json': JSON.stringify({ API_URL: 'https://secret.example/value' }) });
  const r = run(['--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--variables', join(dir, 'vars.json'), '--config', join(dir, 'none.yml')], { cwd: dir });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /secret\.example/);
});

test('the command: stage spec reads tasks.md and the Allow-paths line of the issue, and the rules file of relevo.yml', () => {
  const change = 'openspec/changes/x';
  const { dir } = repoWith({
    [`${change}/tasks.md`]: tasks('1.1 Update CLAUDE.md', '1.2 Add the library to package.json'),
    'issue.md': `${GOOD}\nAllow-paths: package.json\n`,
    'relevo.yml': 'limits:\n  run_max_cost: 5\nqa:\n  rules_from: CLAUDE.md\n',
  });
  const r = run(['--stage', 'spec', '--issue-file', join(dir, 'issue.md'), '--change-dir', join(dir, change), '--config', join(dir, 'relevo.yml')], { cwd: dir });
  assert.equal(r.status, 1);
  assert.deepEqual(r.json.findings.map((f) => f.path), ['CLAUDE.md'], 'package.json is allowed by the issue');
  assert.equal(r.json.reason, 'policy');
});

test('the command: bad arguments exit 2 and an unreadable file is reported', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(['--stage', 'spec', '--issue-file', 'x']).status, 2);
  assert.equal(run(['--stage', 'issue', '--issue-file', '/nonexistent/issue.md']).status, 2);
});

// ---------------------------------------------------------------- a contradiction is found before any agent turn (#121)
import { parseRules } from '../scripts/lib/rules-file.mjs';

const RULES121 = parseRules('CLAUDE.md', '- Every list must offer export and the enable/disable actions.\n');
const OUT121 = `${GOOD}\n## Out of scope\n- export and the enable/disable actions\n`;

test('Scenario: Conflict found at the preflight - needs-spec with the reason conflict, both lines quoted', () => {
  const r = checkIssueStage({ body: OUT121, rules: RULES121 });
  assert.equal(r.decision, 'needs-spec');
  assert.equal(r.reason, 'conflict');
  assert.deepEqual(r.findings.map((f) => f.kind), ['conflict']);
  assert.match(missingText(r), /"export and the enable\/disable actions".*CLAUDE\.md:1/);
});

test('Scenario: Override recorded - the preflight does not report it', () => {
  const body = `${OUT121}\n## Decisions\n\n### D1. Export waits\nDecided: later\nOverrides: CLAUDE.md:1\n`;
  assert.equal(checkIssueStage({ body, rules: RULES121 }).decision, 'ok');
});

test('a missing input keeps its reason when there is also a conflict', () => {
  const r = checkIssueStage({ body: `${OUT121}\n## External inputs\n\n- file: \`a.svg\`: the logo\n`, rules: RULES121, exists: () => false });
  assert.equal(r.reason, 'inputs');
});

test('CLI: the rules files of relevo.yml are read, exit 1 with the reason conflict, and no relevo.yml still runs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-pre-'));
  writeFileSync(join(dir, 'CLAUDE.md'), '- Every list must offer export and the enable/disable actions.\n');
  writeFileSync(join(dir, 'issue.md'), OUT121);
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nqa:\n  rules_from: CLAUDE.md\n');
  const run = (config) => spawnSync('node', [CLI, '--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', config], { encoding: 'utf8' });
  const withConfig = run(join(dir, 'relevo.yml'));
  assert.equal(withConfig.status, 1, withConfig.stderr + withConfig.stdout);
  assert.equal(JSON.parse(withConfig.stdout).reason, 'conflict');
  assert.equal(run(join(dir, 'none.yml')).status, 0);
});

test('a scenario that needs an excluded line is a note and never stops the build', () => {
  const body = `${GOOD}\n## Out of scope\n- the total shown on the screen\n`;
  const r = checkIssueStage({ body });
  assert.equal(r.decision, 'ok');
  assert.match(r.notes.join('\n'), /scenario 1/);
});

test('CLI: a rules file that cannot be read is a note, and the decision is not affected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-pre2-'));
  writeFileSync(join(dir, 'issue.md'), GOOD);
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\nqa:\n  rules_from: missing-rules.md\n');
  const r = spawnSync('node', [CLI, '--stage', 'issue', '--issue-file', join(dir, 'issue.md'), '--repo-root', dir, '--config', join(dir, 'relevo.yml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).notes.join(' '), /missing-rules\.md could not be read/);
});

// ---------------------------------------------------------------- assumptions about names outside the repository (#122)
const DESIGN122 = '# Design\n\n## Assumptions\n\n- the permission `orders.export` exists in the backend, not confirmed against the dev environment\n- the field `total` is a number\n- the list sorts by date\n';

test('Scenario: A permission name is not in the repository - listed, in the line for the hand-off, and the decision is still ok', () => {
  const r = checkSpecStage({ tasksText: tasks('1.1 Add the list'), designText: DESIGN122, search: (n) => (n === 'total' ? 'src/types.ts' : null) });
  assert.equal(r.decision, 'ok');
  assert.deepEqual(r.assumptions.map((a) => a.missing), [['orders.export']]);
  assert.match(r.assumed, /^"the permission `orders.export` exists in the backend[^"]*" \(not in the repository: `orders.export`\)$/);
});

test('Scenario: The repository settles it, and no assumptions - nothing is listed', () => {
  assert.deepEqual(checkSpecStage({ tasksText: tasks('1.1 x'), designText: DESIGN122, search: () => 'src/p.ts' }).assumptions, []);
  const none = checkSpecStage({ tasksText: tasks('1.1 x'), designText: '# Design\n', search: () => null });
  assert.deepEqual([none.assumptions, none.assumed], [[], '']);
  assert.deepEqual(checkSpecStage({ tasksText: tasks('1.1 x'), designText: DESIGN122 }).assumptions, [], 'no search, nothing read');
});

test('the assumptions copied from the issue are read too, and a refused task still wins over them', () => {
  const r = checkSpecStage({ tasksText: tasks('1.1 Update CLAUDE.md'), rulesFile: 'CLAUDE.md', designText: '## From the issue: Assumptions\n\n- the claim `role` is set by the server\n', search: () => null });
  assert.equal(r.decision, 'needs-spec');
  assert.equal(r.assumptions.length, 1);
});

test('the command: stage spec prints the assumptions of design.md and exits 0', () => {
  const change = 'openspec/changes/x';
  const { dir, git } = repoWith({ [`${change}/tasks.md`]: tasks('1.1 Add the list'), [`${change}/design.md`]: DESIGN122, 'src/types.ts': 'export type T = { total: number };\n', 'issue.md': GOOD });
  git('add', '-A');
  const r = run(['--stage', 'spec', '--issue-file', join(dir, 'issue.md'), '--change-dir', join(dir, change), '--config', join(dir, 'none.yml'), '--repo-root', dir], { cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.assumptions.map((a) => a.missing), [['orders.export']], '`total` is in src/types.ts; openspec/ is not searched');
  assert.match(r.json.assumed, /orders\.export/);
});

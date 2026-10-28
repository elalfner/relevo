import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentWorkflow } from '../scripts/lib/agent-workflow.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const workflow = read('templates/workflows/relevo-go.yml');
const antigravity = read('templates/agents/antigravity-step.yml');
const build = workflow.slice(workflow.indexOf('\n  build:'));
const active = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const at = (name) => build.indexOf(`- name: ${name}`);
const stepText = (name) => {
  const from = at(name);
  assert.ok(from > -1, `step "${name}" exists`);
  const rest = build.slice(from + 1);
  const end = rest.search(/\n\n {6}(- |#)/);
  return build.slice(from, end === -1 ? undefined : from + 1 + end);
};

test('Scenario: First report - the report starts after the toolchain check and before the agent, and never fails the job', () => {
  const start = at('Start the progress report');
  assert.ok(start > at('Check the toolchain'), 'the package it runs is unpacked by the toolchain check');
  assert.ok(start < build.indexOf('# relevo:agent-step begin'), 'it starts before the agent');
  const step = stepText('Start the progress report');
  assert.match(step, /continue-on-error: true/);
  assert.match(step, /\[ -f "\$script" \] \|\| exit 0/, 'a package without the script shows no progress and builds as before');
  assert.match(step, /watch --issue "\$ISSUE" --decision "\$DECISION" --max-minutes 65/);
  assert.match(step, /> "\$dir\/watch\.log" 2>&1 &\n\s+exit 0$/, 'the check runs in the background, with its output in a file, and the step ends');
  assert.match(step, /DECISION: \$\{\{ needs\.decide\.outputs\.decision_b64 \}\}/, 'the decision travels through the environment, never inside the shell text');
  assert.doesNotMatch(active(step), /\$\{\{[^}]*\}\}[^\n]*(?:node|nohup)/, 'no expression is written in the line that runs the script');
});

test('the check lives at least as long as the build job and ends with it', () => {
  const timeout = Number(/timeout-minutes: (\d+)/.exec(build)[1]);
  const limit = Number(/--max-minutes (\d+)/.exec(stepText('Start the progress report'))[1]);
  assert.ok(limit > timeout, `the check outlives the job by a margin: ${limit} > ${timeout}`);
  assert.ok(limit <= timeout + 15, 'and by no more than a margin');
});

test('Scenario: Run ends with a result / without an outcome - the progress report stops, then closes, after every other report', () => {
  const noOutcome = at('Report a run that ended without an outcome');
  const stop = at('Stop the progress report');
  const close = at('Close the progress comment');
  assert.ok(noOutcome > -1 && noOutcome < stop && stop < close, 'report of no outcome, then stop, then close');
  assert.ok(close < at('Remove what this job added'));
  assert.ok(at('Report what the run used') < stop);
  for (const name of ['Stop the progress report', 'Close the progress comment']) {
    const step = stepText(name);
    assert.match(step, /if: always\(\)/, name);
    assert.match(step, /continue-on-error: true/, name);
    assert.match(step, /\[ -n "\$RELEVO_PROGRESS_DIR" \] \|\| exit 0|-n "\$RELEVO_PROGRESS_DIR" \] \|\| exit 0/, `${name} does nothing when the report never started`);
  }
  assert.match(stepText('Stop the progress report'), /node "\$script" stop --wait 20/);
  const closing = stepText('Close the progress comment');
  assert.match(closing, /NO_OUTCOME: \$\{\{ steps\.no_outcome\.outputs\.reported \}\}/);
  assert.match(closing, /\[ "\$NO_OUTCOME" = "true" \] && outcome=none/);
  assert.match(closing, /node "\$script" close --issue "\$ISSUE" --outcome "\$outcome" --run-url "\$RUN_URL"/);
});

test('the report of a run without an outcome says that it reported, so that the closing line can say so', () => {
  const step = stepText('Report a run that ended without an outcome');
  assert.match(step, /id: no_outcome/);
  assert.match(step, /echo "reported=true" >> "\$GITHUB_OUTPUT"/);
  assert.ok(step.indexOf('gh issue comment') < step.indexOf('reported=true'), 'only after it commented');
});

test('Scenario: The announcement stays out of the diff - the steps write only under the temporary folder of the runner', () => {
  const start = active(stepText('Start the progress report'));
  assert.match(start, /dir="\$RUNNER_TEMP\/relevo-progress"/);
  assert.match(start, /echo "RELEVO_PROGRESS_DIR=\$dir" >> "\$GITHUB_ENV"/);
  assert.doesNotMatch(start, /\.relevo-plugin|GITHUB_WORKSPACE|> [^"\s$]/, 'nothing relative is written');
  for (const name of ['Stop the progress report', 'Close the progress comment']) {
    assert.doesNotMatch(active(stepText(name)), /\.relevo-plugin|> [^"\s$>]/, name);
    assert.match(stepText(name), /script="\$RUNNER_TEMP\/relevo\/scripts\/progress\.mjs"/, `${name} runs the package that the toolchain check unpacked`);
  }
});

test('the working tree is as clean after the announcement and the check as before them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'progress-clean-'));
  const repo = join(dir, 'repo');
  mkdirSync(join(repo, 'openspec', 'changes', 'add-x'), { recursive: true });
  writeFileSync(join(repo, 'openspec', 'changes', 'add-x', 'tasks.md'), '- [ ] 1.1 a\n');
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.email=a@b.c', '-c', 'user.name=n', 'commit', '-q', '-m', 'x');
  const env = { ...process.env, PATH: '/nonexistent', RELEVO_PROGRESS_DIR: join(dir, 'progress'), GITHUB_REPOSITORY: 'o/r' };
  const script = join(root, 'scripts', 'progress.mjs');
  const run = (...a) => spawnSync(process.execPath, [script, ...a], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(run('phase', 'qa', '--attempt', '1', '--of', '2').status, 0);
  assert.equal(run('watch', '--issue', '7', '--max-minutes', '0.01', '--interval', '0.1').status, 0);
  assert.equal(run('close', '--issue', '7').status, 0);
  assert.equal(git('status', '--porcelain').stdout, '', 'the preflight of the agent needs a clean tree');
});

test('the Antigravity workflow keeps the progress report, because it lives outside the agent block', () => {
  const out = agentWorkflow(workflow, 'antigravity', antigravity);
  for (const name of ['Start the progress report', 'Stop the progress report', 'Close the progress comment']) {
    assert.ok(out.includes(`- name: ${name}`), name);
  }
  assert.ok(out.indexOf('- name: Start the progress report') < out.indexOf('Install the Antigravity CLI'));
});

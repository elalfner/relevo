import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const USAGE = join(root, 'scripts/run-usage.mjs');
const PROGRESS = join(root, 'scripts/progress.mjs');
const temp = () => mkdtempSync(join(tmpdir(), 'relevo-report-'));
const RUN = 'https://example.test/o/r/actions/runs/1';

const usage = (args) => spawnSync(process.execPath, [USAGE, ...args], { cwd: temp(), encoding: 'utf8' });
const log = (events) => {
  const file = join(temp(), 'log.json');
  writeFileSync(file, JSON.stringify(events));
  return file;
};

test('Scenario: Log without usage - the comment says unknown and why, with the run and no marker', () => {
  const none = usage(['--file', '', '--unknown-run', RUN]).stdout;
  assert.match(none, /usage of this run is unknown: the agent left no execution log/);
  assert.ok(none.includes(RUN));
  const empty = usage(['--file', log([{ type: 'assistant' }]), '--unknown-run', RUN]).stdout;
  assert.match(empty, /its execution log has no usage figures/);
  assert.ok(!`${none}${empty}`.includes('relevo:usage'));
  assert.match(usage(['--file', '', '--unknown-run', RUN, '--language', 'es']).stdout, /El uso de esta ejecución se desconoce/);
});

test('a log with usage gives the usual sentence, and without the option nothing is said', () => {
  const full = usage(['--file', log([{ type: 'result', num_turns: 3, total_cost_usd: 0.5 }]), '--unknown-run', RUN]).stdout;
  assert.match(full, /relevo:usage/);
  assert.ok(!full.includes('unknown'));
  assert.equal(usage(['--file', '']).stdout, '');
});

const workflow = read('templates/workflows/relevo-go.yml');
const step = (name) => {
  const start = workflow.indexOf(`- name: ${name}\n`);
  assert.notEqual(start, -1, name);
  const end = workflow.indexOf('\n      - name: ', start + 1);
  return workflow.slice(start, end);
};

// Runs the script of the usage step with a `gh` and a `node` that only record what they were asked.
function usageStep(env) {
  const dir = temp();
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'node'), '#!/bin/sh\necho "node $*" >> "$CALLS"\necho a line\n');
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "gh $*" >> "$CALLS"\nexit ${GH_EXIT:-0}\n');
  chmodSync(join(bin, 'node'), 0o755);
  chmodSync(join(bin, 'gh'), 0o755);
  const script = step('Report what the run used').split('        run: |\n')[1].split('\n').map((l) => l.slice(10)).join('\n').split('\n#')[0];
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const r = spawnSync('bash', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, CALLS: calls, ISSUE: '7', RUN_URL: RUN, EXECUTION_FILE: '', ONLY_SUBSCRIPTION: 'false', ...env } });
  return { r, calls: readFileSync(calls, 'utf8') };
}

test('Scenario: The agent never started - no usage comment is posted', () => {
  assert.equal(usageStep({ AGENT_OUTCOME: 'skipped' }).calls, '');
  assert.equal(usageStep({ AGENT_OUTCOME: '' }).calls, '');
});

test('an agent that ran is reported even with no log, and a comment that cannot be posted is a warning', () => {
  const ran = usageStep({ AGENT_OUTCOME: 'failure' });
  assert.match(ran.calls, new RegExp(`--unknown-run ${RUN}`));
  assert.match(ran.calls, /gh issue comment 7/);
  const refused = usageStep({ AGENT_OUTCOME: 'success', GH_EXIT: '1' });
  assert.equal(refused.r.status, 0);
  assert.match(refused.r.stdout, /::warning::The usage of the run could not be posted on issue 7/);
});

test('the workflow records when the job started and gives it to the progress check', () => {
  assert.match(step('Mark the build as started'), /date \+%s > "\$RUNNER_TEMP\/relevo-job-start"/);
  assert.match(step('Start the progress report'), /--job-start "\$\(cat "\$RUNNER_TEMP\/relevo-job-start" 2>\/dev\/null\)"/);
});

// `watch` writes the limits before it talks to GitHub: with a `gh` that fails it ends, and the file is there.
function watched({ timeout, jobStart }) {
  const cwd = temp();
  const dir = temp();
  const bin = temp();
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(bin, 'gh'), 0o755);
  mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github/workflows/relevo-go.yml'), `jobs:\n  build:\n    runs-on: x\n${timeout ? `    timeout-minutes: ${timeout}\n` : ''}`);
  const decision = Buffer.from(JSON.stringify({ run_max_minutes: 50 })).toString('base64');
  spawnSync(process.execPath, [PROGRESS, 'watch', '--issue', '7', '--repo', 'o/r', '--decision', decision, '--max-minutes', '0.001', '--interval', '0.05', '--job-start', jobStart], { cwd, encoding: 'utf8', timeout: 20000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RELEVO_PROGRESS_DIR: dir } });
  return JSON.parse(readFileSync(join(dir, 'limits.json'), 'utf8'));
}

test('Scenario: Default values - the job deadline is the start of the job plus its timeout less 5 minutes', () => {
  assert.deepEqual(watched({ timeout: 60, jobStart: '1000' }), { run_max_minutes: 50, job_deadline: 1000_000 + 55 * 60000 });
});

test('Scenario: The job timeout cannot be read - only the limit of the run is kept', () => {
  assert.deepEqual(watched({ timeout: null, jobStart: '1000' }), { run_max_minutes: 50 });
  assert.deepEqual(watched({ timeout: 60, jobStart: '' }), { run_max_minutes: 50 });
});

test('the skill, the gate steps and the developer treat a cut as the limit', () => {
  const skill = read('skills/go/SKILL.md');
  assert.match(skill, /\*\*The hard stop\.\*\*/);
  assert.match(skill, /do not treat the open questions of that agent as a spec defect/);
  assert.match(skill, /two parts, and both are required[^.]*what was cut, and everything that did not run/);
  assert.match(read('skills/go/references/qa-run.md'), /`cut` is different.*Never start it again.*`run limit reached`/);
  assert.match(read('agents/dev.md'), /## The time limit of the run[\s\S]*make no more tool calls/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKFLOW_FILES } from '../scripts/lib/doctor.mjs';
import { runnerLine } from '../scripts/lib/init.mjs';

// Implements "A build leaves nothing behind on the runner" and "The workflows name the tools they assume" of
// openspec/specs/go/spec.md, for every workflow template.
const root = new URL('../', import.meta.url).pathname;
const templates = Object.fromEntries(WORKFLOW_FILES.map((f) => [f, readFileSync(`${root}templates/workflows/${f}`, 'utf8')]));

/** [{ name, text }] for the jobs of a workflow. */
const jobsOf = (text) => {
  const body = text.slice(text.indexOf('\njobs:\n') + 6);
  return `\n${body}`.split(/\n(?=  [A-Za-z0-9_-]+:\n)/).filter((chunk) => chunk.trim() !== '').map((chunk) => ({ name: chunk.trim().split('\n')[0].replace(':', ''), text: chunk }));
};
const stepsOf = (job) => job.text.split(/\n(?=      - )/).slice(1);
const code = (s) => s.replace(/^\s*#.*$/gm, '');

test('every template runs on ubuntu-latest, so that init can write the runner of the repository into it', () => {
  WORKFLOW_FILES.forEach((f) => {
    jobsOf(templates[f]).forEach((job) => assert.match(job.text, /^    runs-on: ubuntu-latest$/m, `${f} ${job.name}`));
  });
});

test('Scenario: A runner without jq - every template says which tools it assumes on the runner', () => {
  WORKFLOW_FILES.forEach((f) => assert.match(templates[f], /^# Runner: .*runner\.labels[\s\S]*?needs git, gh and jq/m, f));
});

test('Scenario: A failed job still cleans up - a job that unpacks the plugin ends with a step that always removes it', () => {
  WORKFLOW_FILES.forEach((f) => {
    jobsOf(templates[f]).filter((job) => /-C \.relevo-plugin/.test(job.text)).forEach((job) => {
      const last = stepsOf(job).at(-1);
      assert.match(last, /- name: Remove what this job added/, `${f} ${job.name}`);
      assert.match(last, /if: always\(\)/, `${f} ${job.name}`);
      assert.match(code(last), /run: rm -rf \.relevo-plugin\s*$/, `${f} ${job.name}`);
      assert.doesNotMatch(code(last), /git clean/, 'the project may rely on files of the workspace that Relevo did not add');
    });
  });
});

test('no template installs anything outside the job: nothing global and nothing in the home folder', () => {
  WORKFLOW_FILES.forEach((f) => {
    const active = code(templates[f]);
    assert.doesNotMatch(active, /npm (install|i) (--global|-g)\b/, f);
    assert.doesNotMatch(active, /\$HOME|~\//, f);
  });
});

test('runnerLine writes the labels of the repository into every runs-on and leaves the default alone', () => {
  const go = templates['relevo-go.yml'];
  assert.equal(runnerLine(go, undefined), go);
  assert.equal(runnerLine(go, ['ubuntu-latest']), go);
  const hosted = runnerLine(go, ['self-hosted', 'linux-build']);
  assert.equal((hosted.match(/runs-on: \[self-hosted, linux-build\]/g) ?? []).length, 2, 'decide and build');
  assert.doesNotMatch(hosted, /ubuntu-latest/);
  assert.match(runnerLine(go, ['my-runner']), /runs-on: my-runner\n/);
  assert.throws(() => runnerLine('jobs: {}', ['self-hosted']), /no runs-on line/);
});

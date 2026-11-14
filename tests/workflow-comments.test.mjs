// Implements "Every comment of the bot follows the language" (issue #127) for the two steps of relevo-go.yml that used to carry
// their text inline: the shell of each step is run against a stub of `gh`, with the real render-message.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const workflow = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
const NAME = '- name: Report a run that ended without an outcome';

// The `run:` script of a step, dedented. `which` 0 is the one of the decide job, 1 the one of the build job.
function scriptOf(which) {
  const starts = [];
  for (let i = workflow.indexOf(NAME); i !== -1; i = workflow.indexOf(NAME, i + 1)) starts.push(i);
  assert.equal(starts.length, 2, 'the decide job and the build job each have the step');
  const step = workflow.slice(starts[which]);
  const lines = step.slice(step.indexOf('        run: |\n') + '        run: |\n'.length).split('\n');
  const out = [];
  for (const line of lines) {
    if (line.trim() !== '' && !line.startsWith('          ')) break;
    out.push(line.slice(10));
  }
  return out.join('\n');
}

const GH = `#!/usr/bin/env bash
case "$1 $2" in
  "issue view")
    case "$*" in
      *"--json labels"*) echo "\${STUB_LABELS:-relevo:building}" ;;
      *"--json assignees"*) echo "\${STUB_ASSIGNEE-ana}" ;;
    esac ;;
  "issue edit") echo "$*" >> "$STUB_LOG" ;;
  "issue comment")
    while [ $# -gt 0 ]; do
      if [ "$1" = "--body" ]; then printf '%s' "$2" > "$STUB_BODY"; fi
      shift
    done ;;
esac
`;

function run(which, { language = 'en', env = {}, renderAt = which === 0 ? '.relevo-plugin' : 'runner', usageLimit = false, cut = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-comment-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), GH);
  chmodSync(join(bin, 'gh'), 0o755);
  const config = readFileSync(`${root}templates/relevo.yml`, 'utf8');
  assert.match(config, /^language: en\b/m);
  writeFileSync(join(dir, 'relevo.yml'), config.replace(/^language: en\b/m, `language: ${language}`));
  const temp = join(dir, 'rt');
  mkdirSync(temp);
  // The scripts the step may use. render-message.mjs is the real one; the two readers of the log are stubs.
  mkdirSync(join(dir, '.relevo-plugin/scripts'), { recursive: true });
  writeFileSync(join(dir, '.relevo-plugin/scripts/usage-limit.mjs'), `process.exit(${usageLimit ? 0 : 1});\n`);
  writeFileSync(join(dir, '.relevo-plugin/scripts/run-cut.mjs'), `process.stdout.write(${JSON.stringify(cut)});\n`);
  if (renderAt === '.relevo-plugin') symlinkSync(`${root}scripts/render-message.mjs`, join(dir, '.relevo-plugin/scripts/render-message.mjs'));
  if (renderAt === 'runner') {
    mkdirSync(join(temp, 'relevo/scripts'), { recursive: true });
    symlinkSync(`${root}scripts/render-message.mjs`, join(temp, 'relevo/scripts/render-message.mjs'));
    symlinkSync(`${root}scripts/lib`, join(temp, 'relevo/scripts/lib'));
  }
  if (renderAt === '.relevo-plugin') symlinkSync(`${root}scripts/lib`, join(dir, '.relevo-plugin/scripts/lib'));
  const body = join(dir, 'body.txt');
  const log = join(dir, 'edits.log');
  const result = spawnSync('bash', ['-ec', scriptOf(which)], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`, HOME: dir, RUNNER_TEMP: temp, GITHUB_OUTPUT: join(dir, 'out.txt'),
      ISSUE: '12', JOB_STATUS: 'failure', RUN_URL: 'https://example.test/run/9', STUB_LOG: log, STUB_BODY: body,
      ...(usageLimit || cut ? { EXECUTION_FILE: join(dir, 'log.json') } : {}),
      ...env,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return { body: existsSync(body) ? readFileSync(body, 'utf8') : null, edits: existsSync(log) ? readFileSync(log, 'utf8') : '', out: existsSync(join(dir, 'out.txt')) ? readFileSync(join(dir, 'out.txt'), 'utf8') : '' };
}

// ---------- the decide job: the run failed before it decided

test('Scenario: A run ends without a result, in Spanish - the comment of the decide job is in Spanish, with the same commands and labels', () => {
  const es = run(0, { language: 'es' });
  assert.match(es.body, /^@ana La ejecución falló antes de poder decidir qué hacer \(estado del job: failure\)/);
  assert.match(es.body, /quita `relevo:qa-failed` y pon `relevo:ready`/);
  assert.match(es.edits, /--add-label relevo:qa-failed/);
  const en = run(0, { language: 'en' });
  assert.match(en.body, /^@ana The run failed before it could decide what to do \(job status: failure\), so nothing was built\./);
});

test('Scenario: The scripts cannot be run - the decide job posts the English sentence it carries and still tells the issue', () => {
  const none = run(0, { language: 'es', renderAt: 'none' });
  assert.match(none.body, /^@ana The run failed before it could decide what to do \(job status: failure\)/);
  assert.match(none.body, /remove `relevo:qa-failed` and apply `relevo:ready` again\.$/);
  assert.doesNotMatch(run(0, { renderAt: 'none', env: { STUB_ASSIGNEE: '' } }).body, /^@/, 'nobody is mentioned without an assignee');
});

// ---------- the build job: no outcome, a usage limit, kept work

test('Scenario: A run ends without a result, in both languages - the build job renders run_no_outcome from the catalog', () => {
  const es = run(1, { language: 'es', env: { JOB_STATUS: 'cancelled' } });
  assert.match(es.body, /^@ana La ejecución terminó sin resultado \(estado del job: cancelled\), así que no se construyó ni se informó nada\./);
  assert.match(es.body, /Lee el log para ver por qué: https:\/\/example\.test\/run\/9\./);
  assert.match(es.edits, /--remove-label relevo:ready --remove-label relevo:queued --remove-label relevo:building --add-label relevo:qa-failed/);
  assert.match(es.out, /reported=true/);
  const en = run(1, { language: 'en', env: { JOB_STATUS: 'cancelled' } });
  assert.match(en.body, /^@ana The run ended without a result \(job status: cancelled\), so nothing was built or reported\./);
});

test('Scenario: A limit of the runner - the comment names the limit in the language of the repository', () => {
  assert.match(run(1, { language: 'es', cut: 'turns' }).body, /límite de turnos \(--max-turns\)/);
  assert.match(run(1, { language: 'en', cut: 'cost' }).body, /cost limit \(--max-budget-usd\)/);
});

test('Scenario: A usage limit - says that nothing is wrong with the code, in the language of the repository', () => {
  const es = run(1, { language: 'es', usageLimit: true });
  assert.match(es.body, /límite de uso \(o el crédito\) de la cuenta del modelo.*El código no tiene ningún problema\./);
  assert.match(run(1, { language: 'en', usageLimit: true }).body, /Nothing is wrong with the code\./);
});

test('Scenario: The work was kept - the comment names the branch and the next step, in both languages, and a rescue branch is not the one fix reads', () => {
  const kept = { RESCUE_STATE: 'kept', RESCUE_BRANCH: 'feature/12-x' };
  assert.match(run(1, { language: 'es', env: kept }).body, /guardó en la rama `feature\/12-x`.*Ejecuta `\/relevo:fix 12`/);
  assert.match(run(1, { language: 'en', env: kept }).body, /kept on the branch `feature\/12-x`.*Run `\/relevo:fix 12`/);
  const own = run(1, { language: 'es', env: { RESCUE_STATE: 'kept', RESCUE_BRANCH: 'rescue/feature/12-x' } });
  assert.match(own.body, /una rama aparte/);
  assert.doesNotMatch(own.body, /relevo:fix/);
});

test('what the rescue did with work that was not kept is added after the sentence, in the language of the repository', () => {
  const es = run(1, { language: 'es', env: { RESCUE_STATE: 'unsafe', RESCUE_DETAIL: 'a protected path' } });
  assert.match(es.body, /El trabajo hecho antes de detenerse no se guardó: a protected path$/);
});

test('Scenario: The scripts cannot be run - the build job posts one English sentence, and names the branch when the work was kept', () => {
  const none = run(1, { language: 'es', renderAt: 'none', env: { RESCUE_STATE: 'kept', RESCUE_BRANCH: 'feature/12-x' } });
  assert.match(none.body, /^@ana The run ended without an outcome \(job status: failure\), so nothing was built or reported\. The work done before the stop was kept on the branch `feature\/12-x`\./);
  assert.match(run(1, { renderAt: 'none' }).body, /so nothing was built or reported\. Read the log/);
  assert.match(run(1, { renderAt: 'none' }).out, /reported=true/);
});

test('the build job uses the copy of the plugin installed for the reports when the toolchain check did not unpack one', () => {
  assert.match(run(1, { language: 'es', renderAt: '.relevo-plugin' }).body, /^@ana La ejecución terminó sin resultado/);
});

test('Scenario: The number of checkpoints is known - the report step passes the count of the rescue to the comment, and an empty count stays unknown', () => {
  const kept = { RESCUE_STATE: 'kept', RESCUE_BRANCH: 'feature/12-x' };
  assert.match(run(1, { language: 'en', env: { ...kept, RESCUE_CHECKPOINTS: '2' } }).body, /resume from the last checkpoint \(2 saved\) and build only the pending tasks/);
  assert.match(run(1, { language: 'es', env: { ...kept, RESCUE_CHECKPOINTS: '2' } }).body, /reanudar desde el último checkpoint \(2 guardados\)/);
  assert.match(run(1, { language: 'en', env: { ...kept, RESCUE_CHECKPOINTS: '0' } }).body, /resume from the work kept on the branch \(no checkpoint was saved yet\)/);
  // A count the rescue could not make is an empty output: it is not 0, so the comment must not say that none exists.
  ['', undefined].forEach((value) => {
    const env = value === undefined ? kept : { ...kept, RESCUE_CHECKPOINTS: value };
    const body = run(1, { language: 'en', env }).body;
    assert.match(body, /resume from the last point saved on the branch/);
    assert.doesNotMatch(body, /no checkpoint was saved yet/);
  });
  // Anything that is not a whole number is ignored.
  assert.match(run(1, { language: 'en', env: { ...kept, RESCUE_CHECKPOINTS: 'many' } }).body, /resume from the last point saved on the branch/);
});

test('the report step reads the count from the output of the rescue step', () => {
  assert.match(workflow, /RESCUE_CHECKPOINTS: \$\{\{ steps\.rescue\.outputs\.checkpoints \}\}/);
});

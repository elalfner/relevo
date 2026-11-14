import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';
import { NEXT_STEP_REASONS, NEXT_STEP_STATES, nextStep } from '../scripts/lib/next-step.mjs';

const CLI = new URL('../scripts/next-step.mjs', import.meta.url).pathname;
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });

test('Scenario: Every state has an entry - a lifecycle label without one fails this test', () => {
  const missing = LABEL_KEYS.filter((key) => !NEXT_STEP_STATES.includes(key));
  assert.deepEqual(missing, [], `these lifecycle states have no next step: ${missing.join(', ')}`);
  assert.deepEqual(NEXT_STEP_STATES.filter((key) => !LABEL_KEYS.includes(key)), [], 'an entry for a state that does not exist');
});

test('every state and every reason gives a line in both languages', () => {
  NEXT_STEP_STATES.forEach((state) => {
    (NEXT_STEP_REASONS[state] ?? [null]).forEach((reason) => {
      ['en', 'es'].forEach((language) => {
        const step = nextStep({ state, reason, issue: 42, language });
        assert.ok(step.line.length > 10, `${state}/${reason}/${language}`);
        assert.doesNotMatch(step.line, /\{n\}|undefined|null/, `${state}/${reason}/${language}`);
      });
    });
  });
});

test('Scenario: Successful build - built goes to review, run by the assignee', () => {
  const step = nextStep({ state: 'built', issue: 42 });
  assert.deepEqual([step.command, step.who], ['/relevo:review 42', 'assignee']);
  assert.match(step.line, /^Your next step: \/relevo:review 42 \(the assignee\): review it on a device\.$/);
});

test('Scenario: Missing information - needs-spec with the reason missing is /relevo:issue, run by the spec writer', () => {
  const step = nextStep({ state: 'needs-spec', reason: 'missing', issue: 7 });
  assert.deepEqual([step.command, step.who, step.reason], ['/relevo:issue 7', 'spec_writer', 'missing']);
  assert.equal(nextStep({ state: 'needs-spec', issue: 7 }).reason, 'missing', 'missing is the default');
});

test('Scenario: Ambiguity - the spec writer decides the open question and /relevo:think can explore it first', () => {
  const step = nextStep({ state: 'needs-spec', reason: 'ambiguous', issue: 7 });
  assert.equal(step.command, '/relevo:issue 7');
  assert.match(step.hint, /decide the open question/);
  assert.match(step.hint, /\/relevo:think #7/);
});

test('qa-failed goes to fix, or says to delete the branch when it holds only the specification', () => {
  assert.equal(nextStep({ state: 'qa-failed', issue: 9 }).command, '/relevo:fix 9');
  const spec = nextStep({ state: 'qa-failed', reason: 'delete-branch', issue: 9 });
  assert.equal(spec.command, null);
  assert.match(spec.line, /delete the remote branch/);
  assert.match(spec.line, /ready again/);
});

test('Scenario: Rebuild variant - qa-failed with nothing pushed has no command and says to relabel ready', () => {
  const step = nextStep({ state: 'qa-failed', reason: 'rebuild', issue: 37 });
  assert.equal(step.command, null);
  assert.equal(step.who, 'assignee');
  assert.match(step.hint, /nothing was pushed/);
  assert.match(step.hint, /remove relevo:qa-failed and label the issue relevo:ready again/);
  assert.match(step.hint, /\/relevo:go 37 --local --retry \(the cloud does not start\)/);
  assert.doesNotMatch(step.line, /\/relevo:fix/);
  const es = nextStep({ state: 'qa-failed', reason: 'rebuild', issue: 37, language: 'es' });
  assert.match(es.hint, /no se subió nada/);
  assert.match(es.hint, /quita relevo:qa-failed y vuelve a poner relevo:ready/);
  assert.match(es.hint, /\/relevo:go 37 --local --retry \(la nube no arranca\)/);
});

test('pr-open waits for an approval and then goes to ship; changes-requested goes to fix', () => {
  assert.equal(nextStep({ state: 'pr-open', issue: 3 }).command, '/relevo:ship 3');
  assert.match(nextStep({ state: 'pr-open', issue: 3 }).line, /someone other than the author approves/);
  assert.equal(nextStep({ state: 'changes-requested', issue: 3 }).command, '/relevo:fix 3');
});

test('the states in which nobody acts yet say to wait and name no command', () => {
  ['ready', 'queued', 'building', 'blocked'].forEach((state) => {
    const step = nextStep({ state });
    assert.equal(step.command, null, state);
    assert.match(step.line, /^Nothing to do now: /, state);
  });
});

test('Scenario: Spanish repository - the line is in Spanish and the command is unchanged', () => {
  const step = nextStep({ state: 'built', issue: 42, language: 'es' });
  assert.equal(step.command, '/relevo:review 42');
  assert.match(step.line, /^Tu siguiente paso: \/relevo:review 42 \(la persona asignada\): revísala en un dispositivo\.$/);
  assert.equal(nextStep({ state: 'built', issue: 1, language: 'fr' }).line.startsWith('Your next step'), true, 'unknown languages use English');
  assert.equal(nextStep({ state: 'built', issue: 1, language: 'es-MX' }).line.startsWith('Tu siguiente paso'), true);
});

test('errors name what is wrong: unknown state, unknown reason, missing issue number', () => {
  assert.throws(() => nextStep({ state: 'done', issue: 1 }), /unknown state "done"/);
  assert.throws(() => nextStep({ state: 'needs-spec', reason: 'lost', issue: 1 }), /unknown reason "lost"/);
  assert.throws(() => nextStep({ state: 'built' }), /needs the issue number/);
  assert.throws(() => nextStep(), /unknown state/);
});

test('the command prints the line, the JSON on request, and exits 2 on bad input', () => {
  const ok = run('--state', 'built', '--issue', '42');
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /Your next step: \/relevo:review 42/);
  assert.equal(JSON.parse(run('--state', 'needs-spec', '--reason', 'ambiguous', '--issue', '5', '--json').stdout).who, 'spec_writer');
  assert.match(run('--state', 'built', '--issue', '42', '--language', 'es').stdout, /Tu siguiente paso/);
  assert.equal(run('--state', 'nope', '--issue', '1').status, 2);
  assert.equal(run().status, 2);
  assert.match(run().stderr, /usage: next-step\.mjs/);
});

test('a restricted file versioned on the base branch has no command: it says to remove the file and label ready again', () => {
  const step = nextStep({ state: 'qa-failed', reason: 'restricted', issue: 9 });
  assert.equal(step.command, null);
  assert.match(step.line, /git rm --cached/);
  assert.match(step.line, /ready again/);
  assert.doesNotMatch(step.line, /relevo:fix/);
});

test('Scenario: The next step for `inputs` - the writer completes the issue', () => {
  const step = nextStep({ state: 'needs-spec', reason: 'inputs', issue: 48 });
  assert.deepEqual([step.command, step.who], ['/relevo:issue 48', 'spec_writer']);
  assert.match(step.hint, /an input of the issue is not available/);
  assert.match(step.hint, /External inputs/);
  assert.match(nextStep({ state: 'needs-spec', reason: 'inputs', issue: 48, language: 'es' }).hint, /un insumo del issue no está disponible/);
});

test('Scenario: The next step for `policy` - the writer rewrites the issue', () => {
  const step = nextStep({ state: 'needs-spec', reason: 'policy', issue: 47 });
  assert.deepEqual([step.command, step.who], ['/relevo:issue 47', 'spec_writer']);
  assert.match(step.hint, /Allow-paths:/);
  assert.match(nextStep({ state: 'needs-spec', reason: 'policy', issue: 47, language: 'es' }).hint, /Allow-paths:/);
});

test('missing installed dependencies have a next step in the workflow, not a command', () => {
  const step = nextStep({ state: 'qa-failed', reason: 'installed', issue: 9 });
  assert.equal(step.command, null);
  assert.match(step.hint, /installs the dependencies/);
  assert.match(nextStep({ state: 'qa-failed', reason: 'installed', issue: 9, language: 'es' }).hint, /instala las dependencias/);
});

test('the classes of a QA finding that the developer agent cannot fix each have a next step for the kept work', () => {
  assert.equal(nextStep({ state: 'qa-failed', reason: 'input', issue: 9 }).command, '/relevo:fix 9');
  assert.equal(nextStep({ state: 'qa-failed', reason: 'spec', issue: 9 }).command, '/relevo:issue 9');
  assert.equal(nextStep({ state: 'qa-failed', reason: 'policy', issue: 9 }).command, '/relevo:issue 9');
});

test('Scenario: A queued issue can wait for a shared file - the single hint says so, in both languages', () => {
  assert.match(nextStep({ state: 'queued', issue: 4 }).hint, /issue that shares a file with it is merged/);
  assert.match(nextStep({ state: 'queued', issue: 4, language: 'es' }).hint, /se fusione el issue que comparte un archivo con él/);
});

test('Scenario: Next step for the reason conflict - the writer settles which one wins', () => {
  const step = nextStep({ state: 'needs-spec', reason: 'conflict', issue: 121 });
  assert.equal(step.command, '/relevo:issue 121');
  assert.equal(step.who, 'spec_writer');
  assert.match(nextStep({ state: 'needs-spec', reason: 'conflict', issue: 121 }).hint, /Overrides: <file>:<line>/);
  assert.match(nextStep({ state: 'needs-spec', reason: 'conflict', issue: 121, language: 'es' }).hint, /Overrides:/);
});

test('Scenario: The next step for a protected path refused by the commit guard - the writer changes the issue, in both languages', () => {
  const step = nextStep({ state: 'qa-failed', reason: 'protected', issue: 12 });
  assert.deepEqual([step.command, step.who], ['/relevo:issue 12', 'spec_writer']);
  assert.match(step.hint, /a person makes the edit, or the issue changes/);
  assert.match(nextStep({ state: 'qa-failed', reason: 'protected', issue: 12, language: 'es' }).hint, /una persona hace la edición/);
});

test('the policy hint does not offer Allow-paths for a protected path that is not a manifest', () => {
  assert.match(nextStep({ state: 'needs-spec', reason: 'policy', issue: 47 }).hint, /only a dependency manifest can be allowed/);
});

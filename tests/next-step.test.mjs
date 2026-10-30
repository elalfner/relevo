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

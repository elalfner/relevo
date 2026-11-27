import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';
import { NEXT_STEP_REASONS, NEXT_STEP_STATES, nextStep } from '../scripts/lib/next-step.mjs';

const CLI = new URL('../scripts/next-step.mjs', import.meta.url).pathname;
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });

test('Scenario: Every state has an entry - a lifecycle label without one fails this test', () => {
  const missing = LABEL_KEYS.filter((key) => !NEXT_STEP_STATES.includes(key));
  assert.deepEqual(missing, [], `these lifecycle states have no next step: ${missing.join(', ')}`);
  // `draft` and `closed` are states of an issue with no label.
  assert.deepEqual([...NEXT_STEP_STATES].sort(), [...LABEL_KEYS, 'draft', 'closed'].sort(), 'an entry for a state that does not exist, or a missing one');
});

test('Scenario: A hand-off has someone who acts and a wait has nobody - every entry and variant has a hint, in both languages', () => {
  NEXT_STEP_STATES.forEach((state) => {
    (NEXT_STEP_REASONS[state] ?? [null]).forEach((reason) => {
      ['en', 'es'].forEach((language) => {
        const step = nextStep({ state, reason, issue: 42, language });
        assert.ok(step.hint.length > 5, `${state}/${reason}/${language}`);
        assert.ok(['nobody', 'assignee', 'spec_writer', 'author', 'approver', 'person'].includes(step.who), `${state}/${reason}: ${step.who}`);
        if (step.who === 'nobody') assert.equal(step.command, null, `${state}/${reason}: a wait has no command`);
        assert.doesNotMatch(step.line, /\(undefined\)|\(\)/, `${state}/${reason}/${language}`);
      });
    });
  });
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

test('build-failed goes to fix, or says to delete the branch when it holds only the specification', () => {
  assert.equal(nextStep({ state: 'build-failed', issue: 9 }).command, '/relevo:fix 9');
  const spec = nextStep({ state: 'build-failed', reason: 'delete-branch', issue: 9 });
  assert.equal(spec.command, null);
  assert.match(spec.line, /delete the remote branch/);
  assert.match(spec.line, /apply relevo:go so that the cloud builds it again, or run \/relevo:go 9 --retry on your machine/);
});

test('Scenario: delete-branch names the command that deletes the branch when the branch is known, in both languages', () => {
  const en = nextStep({ state: 'build-failed', reason: 'delete-branch', issue: 9, branch: 'feature/9-summary' });
  assert.match(en.hint, /delete the remote branch \(`git push origin --delete feature\/9-summary`\), then apply relevo:go/);
  const es = nextStep({ state: 'build-failed', reason: 'delete-branch', issue: 9, branch: 'feature/9-summary', language: 'es' });
  assert.match(es.hint, /borra la rama remota \(`git push origin --delete feature\/9-summary`\), luego ponle relevo:go/);
  const bare = nextStep({ state: 'build-failed', reason: 'delete-branch', issue: 9 });
  assert.match(bare.hint, /delete the remote branch, then apply relevo:go/);
  assert.doesNotMatch(bare.hint, /\{delete\}|git push/);
});

test('Scenario: Rebuild variant - build-failed with nothing pushed has no command and names the go label and --retry', () => {
  const step = nextStep({ state: 'build-failed', reason: 'rebuild', issue: 37 });
  assert.equal(step.command, null);
  assert.equal(step.who, 'assignee');
  assert.match(step.hint, /nothing was pushed/);
  assert.match(step.hint, /apply relevo:go so that the cloud builds it again/);
  assert.match(step.hint, /\/relevo:go 37 --retry/);
  assert.doesNotMatch(step.hint, /relevo:ready/);
  assert.doesNotMatch(step.line, /\/relevo:fix/);
  const es = nextStep({ state: 'build-failed', reason: 'rebuild', issue: 37, language: 'es' });
  assert.match(es.hint, /no se subió nada/);
  assert.match(es.hint, /ponle relevo:go para que la nube lo construya de nuevo/);
  assert.match(es.hint, /\/relevo:go 37 --retry/);
});

test('pr-open waits for an approval and then goes to ship; changes-requested goes to fix', () => {
  assert.equal(nextStep({ state: 'pr-open', issue: 3 }).command, '/relevo:ship 3');
  assert.match(nextStep({ state: 'pr-open', issue: 3 }).line, /someone other than the author approves/);
  assert.equal(nextStep({ state: 'changes-requested', issue: 3 }).command, '/relevo:fix 3');
});

test('the states in which nobody acts yet say to wait and name no command', () => {
  ['queued', 'building', 'blocked'].forEach((state) => {
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

test('a restricted file versioned on the base branch has no command: it says to remove the file and build again with go', () => {
  const step = nextStep({ state: 'build-failed', reason: 'restricted', issue: 9 });
  assert.equal(step.command, null);
  assert.match(step.line, /git rm --cached/);
  assert.match(step.line, /relevo:go/);
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
  const step = nextStep({ state: 'build-failed', reason: 'installed', issue: 9 });
  assert.equal(step.command, null);
  assert.match(step.hint, /installs the dependencies/);
  assert.match(nextStep({ state: 'build-failed', reason: 'installed', issue: 9, language: 'es' }).hint, /instala las dependencias/);
});

test('the classes of a QA finding that the developer agent cannot fix each have a next step for the kept work', () => {
  assert.equal(nextStep({ state: 'build-failed', reason: 'input', issue: 9 }).command, '/relevo:fix 9');
  assert.equal(nextStep({ state: 'build-failed', reason: 'spec', issue: 9 }).command, '/relevo:issue 9');
  assert.equal(nextStep({ state: 'build-failed', reason: 'policy', issue: 9 }).command, '/relevo:issue 9');
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
  const step = nextStep({ state: 'build-failed', reason: 'protected', issue: 12 });
  assert.deepEqual([step.command, step.who], ['/relevo:issue 12', 'spec_writer']);
  assert.match(step.hint, /a person makes the edit, or the issue changes/);
  assert.match(nextStep({ state: 'build-failed', reason: 'protected', issue: 12, language: 'es' }).hint, /una persona hace la edición/);
});

test('the policy hint does not offer Allow-paths for a protected path that is not a manifest', () => {
  assert.match(nextStep({ state: 'needs-spec', reason: 'policy', issue: 47 }).hint, /only a dependency manifest can be allowed/);
});

// --- split-ready-and-go: no next step says that ready alone builds an issue

test('Scenario: Approved and waiting for a decision - ready names /relevo:go and the go label, and says nothing starts by itself', () => {
  const step = nextStep({ state: 'ready', issue: 42 });
  assert.equal(step.command, '/relevo:go 42');
  assert.match(step.hint, /nothing starts by itself/);
  assert.match(step.hint, /relevo:go/);
  assert.match(nextStep({ state: 'ready', issue: 42, language: 'es' }).hint, /nada empieza sola/);
});

test('every text that used to say "apply ready again" names the go label or --retry', () => {
  NEXT_STEP_STATES.forEach((state) => {
    (NEXT_STEP_REASONS[state] ?? [null]).forEach((reason) => {
      ['en', 'es'].forEach((language) => {
        const { line } = nextStep({ state, reason, issue: 7, language });
        if (/ready/.test(line)) assert.match(line, /relevo:go|\/relevo:go 7/, `${state}/${reason}/${language}`);
        // The restart of a lost runner puts `ready` back and says that it starts nothing, in the words of `status`.
        if (!/starts nothing|no inicia nada/.test(line)) assert.doesNotMatch(line, /(label it|label the issue relevo:)ready again|ponerle ready|poner relevo:ready/, `${state}/${reason}/${language}`);
      });
    });
  });
});

test('Scenario: Partial variant - a refused checkpoint after pushed ones goes to fix and never to --retry', () => {
  assert.ok(NEXT_STEP_REASONS['build-failed'].includes('partial'));
  const step = nextStep({ state: 'build-failed', reason: 'partial', issue: 20 });
  assert.equal(step.command, '/relevo:fix 20');
  assert.equal(step.who, 'assignee');
  assert.doesNotMatch(step.line, /--retry/);
  const es = nextStep({ state: 'build-failed', reason: 'partial', issue: 20, language: 'es' });
  assert.equal(es.command, '/relevo:fix 20');
  assert.doesNotMatch(es.line, /--retry/);
});

test('Scenario: A build that stopped before it finished - build-failed has a variant that continues it, and fix stays for rejected work (resume-a-cut-build)', () => {
  assert.ok(NEXT_STEP_REASONS['build-failed'].includes('resume'));
  assert.ok(NEXT_STEP_REASONS['build-failed'].includes('stalled'));
  const step = nextStep({ state: 'build-failed', reason: 'resume', issue: 42 });
  assert.deepEqual([step.command, step.who, step.reason], ['/relevo:go 42 --resume', 'assignee', 'resume']);
  assert.match(step.hint, /continues the build from where it stopped/);
  assert.match(step.hint, /apply relevo:go/);
  assert.match(step.hint, /\/relevo:fix 42 is for work that QA rejected/);
  const es = nextStep({ state: 'build-failed', reason: 'resume', issue: 42, language: 'es' });
  assert.equal(es.command, '/relevo:go 42 --resume');
  assert.match(es.hint, /continúa el build desde donde se detuvo/);
  assert.match(es.hint, /relevo:go/);
  // The variant for work that QA rejected keeps fix.
  assert.equal(nextStep({ state: 'build-failed', reason: 'kept', issue: 42 }).command, '/relevo:fix 42');
  assert.equal(nextStep({ state: 'build-failed', reason: 'partial', issue: 42 }).command, '/relevo:fix 42');
});

test('the stalled variant has no command: resuming again would not help, and the hint says what to change', () => {
  const step = nextStep({ state: 'build-failed', reason: 'stalled', issue: 42 });
  assert.equal(step.command, null);
  assert.match(step.hint, /resuming again will not help/);
  assert.match(step.hint, /limits\.run_max_turns/);
  assert.match(step.hint, /split the issue/);
  assert.doesNotMatch(step.line, /--resume/);
  const es = nextStep({ state: 'build-failed', reason: 'stalled', issue: 42, language: 'es' });
  assert.match(es.hint, /reanudar de nuevo no ayudará/);
  assert.match(es.hint, /parte el issue/);
});

test('Scenario: A draft - the spec writer runs /relevo:issue, after /relevo:think if the idea needs exploring', () => {
  const r = run('--state', 'draft', '--issue', '7');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Your next step: \/relevo:issue 7 \(the spec writer\): .*\/relevo:think #7/);
  assert.match(run('--state', 'draft', '--issue', '7', '--language', 'es').stdout, /^Tu siguiente paso: \/relevo:issue 7 /);
});

test('Scenario: A closed issue - nobody acts, it was delivered, and the promotion is a separate pull request', () => {
  const r = run('--state', 'closed', '--issue', '7');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Nothing to do now: it was delivered; promoting the base branch to the release branch is a separate pull request\./);
  assert.match(run('--state', 'closed', '--issue', '7', '--language', 'es').stdout, /^Nada que hacer ahora: se entregó/);
});

test('Scenario: Review passed in a files project - in-review has a local variant that is ship, with no pull request or approval', () => {
  const step = nextStep({ state: 'in-review', reason: 'local', issue: 7 });
  assert.deepEqual([step.command, step.who], ['/relevo:ship 7', 'person']);
  assert.doesNotMatch(step.line, /pull request|GitHub|approv/);
  assert.equal(nextStep({ state: 'in-review', issue: 7 }).command, '/relevo:review 7', 'continue is the default');
});

test('Scenario: The runner is lost - building has a variant with no command that gives the restart to the assignee', () => {
  const step = nextStep({ state: 'building', reason: 'lost-runner', issue: 7 });
  assert.deepEqual([step.command, step.who], [null, 'assignee']);
  assert.match(step.line, /^Your next step: read the run, then remove relevo:building and apply relevo:ready again \(it starts nothing\), then apply relevo:go or run \/relevo:go 7 \(the assignee\)\.$/);
  assert.match(nextStep({ state: 'building', reason: 'lost-runner', issue: 7, language: 'es' }).line, /^Tu siguiente paso: lee la ejecución/);
  assert.equal(nextStep({ state: 'building' }).who, 'nobody', 'the agent is the default');
});

test('Scenario: The state read from the labels - the lifecycle label, else draft, and needs-reviewer adds its line', () => {
  const lines = (...args) => run(...args).stdout.trim().split('\n');
  assert.deepEqual(lines('--labels', 'relevo:built,relevo:urgent,bug', '--issue', '7'), ['State: built', nextStep({ state: 'built', issue: 7 }).line]);
  assert.deepEqual(lines('--labels', '', '--issue', '7'), ['State: draft', nextStep({ state: 'draft', issue: 7 }).line]);
  assert.deepEqual(lines('--labels', 'relevo:pr-open,relevo:needs-reviewer', '--issue', '7'), ['State: pr-open', nextStep({ state: 'pr-open', issue: 7 }).line, nextStep({ state: 'needs-reviewer' }).line]);
  assert.deepEqual(lines('--labels', 'relevo:in-review', '--reason', 'local', '--issue', '7', '--language', 'es'), ['Estado: in-review', nextStep({ state: 'in-review', reason: 'local', issue: 7, language: 'es' }).line]);
});

test('the labels are read under their configured names', () => {
  const config = join(mkdtempSync(join(tmpdir(), 'next-step-')), 'relevo.yml');
  const template = readFileSync(new URL('../templates/relevo.yml', import.meta.url), 'utf8').replace('[]          # GitHub', '[ana]       # GitHub');
  assert.doesNotMatch(template, /^labels:/m);
  writeFileSync(config, `${template}\nlabels:\n  built: listo\n`);
  assert.match(run('--labels', 'listo', '--issue', '7', '--config', config).stdout, /^State: built\n/);
});

test('needs-spec and build-failed with no reason point to the last comment, and with a reason give its step', () => {
  ['needs-spec', 'build-failed'].forEach((state) => {
    const out = run('--labels', `relevo:${state}`, '--issue', '7').stdout;
    assert.match(out, /read the last comment of the issue/);
    assert.doesNotMatch(out, /\/relevo:/);
    assert.match(run('--labels', `relevo:${state}`, '--issue', '7', '--language', 'es').stdout, /lee el último comentario del issue/);
  });
  assert.match(run('--labels', 'relevo:build-failed', '--reason', 'resume', '--issue', '7').stdout, /\/relevo:go 7 --resume/);
  assert.equal(run('--labels', 'relevo:built', '--state', 'built', '--issue', '7').status, 2);
});

test('--after init names think and then issue, in both languages', () => {
  const r = run('--after', 'init');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Your next step: after the steps above, run \/relevo:think .* then \/relevo:issue /);
  assert.match(run('--after', 'init', '--language', 'es').stdout, /^Tu siguiente paso: después de los pasos anteriores, ejecuta \/relevo:think .* \/relevo:issue /);
});


// Every message says the next step or why nobody acts. Implements "Every message says the next step or why nobody acts" of
// openspec/specs/issue-lifecycle/spec.md.
//
// A kind is a `handoff` (someone acts), a `wait` (nobody has to, and it says why) or `info`. By default a hand-off carries the
// words that open a next step in the table and a wait the words that open a wait. A kind that already guides in other words
// declares its own pattern for each language. A new kind has no class, so the first test fails and names it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_KINDS, renderMessage, SUPPORTED_LANGUAGES } from '../scripts/lib/messages.mjs';
import { nextStep, nextStepPrefix, waitPrefix } from '../scripts/lib/next-step.mjs';

const handoff = (data, says = null) => ({ type: 'handoff', data, says });
const wait = (data, says = null) => ({ type: 'wait', data, says });
const info = () => ({ type: 'info', data: [], says: null });
const own = (en, es) => ({ en, es });

const issue = { issue: 1 };
const label = { issue: 1, actor: 'a' };
const failed = { assignee: 'a', issue: 1, title: 't', finding: 'f', branch: 'b' };
const fixed = { issue: 1, title: 't', summary: 's', qa: 'ok', commit: 'c', iteration: 1 };
const ship = { actor: 'a', issue: 1, reasons: 'r' };
const run = { issue: 1, run: 'http://r', assignee: 'a' };
const STARTS = own(/It starts automatically/, /Empieza solo/);

const KINDS = {
  built: handoff([{ assignee: 'a', issue: 1, title: 't', tasks_done: 1, tasks_total: 1, branch: 'b', scenarios: 1, checklist: '- [ ] x' }]),
  build_failed: handoff([
    failed,
    { ...failed, branch_state: 'unsafe' },
    { ...failed, branch_state: 'not_pushed' },
    { ...failed, branch_state: 'kept' },
    { ...failed, branch_state: 'kept', reason: 'run limit reached' },
    { ...failed, branch_state: 'kept', reason: 'run limit reached', stalled: true, limit_turns: 1, limit_minutes: 1, limit_cost: 1 },
    { ...failed, branch_state: 'existing', recovery: 'delete-branch' },
  ]),
  toolchain_missing: handoff([{ assignee: 'a', issue: 1, title: 't', tools: 'php', platform: 'back' }]),
  installed_missing: handoff([{ assignee: 'a', issue: 1, title: 't', paths: 'vendor', platform: 'back' }]),
  needs_spec: handoff([{ spec_writer: 'a', issue: 1, title: 't', missing: 'm' }]),
  changes_requested: handoff([{ author: 'a', issue: 1, reviewer: 'r', summary: 's' }]),
  approved: handoff([{ recipient: 'a', issue: 1, reviewer: 'r', ship_label: 'relevo:ship' }]),
  needs_reviewer: handoff([{ spec_writer: 'a', issue: 1, title: 't', pr: '#2' }]),
  review_reminder: handoff([{ reviewer: 'r', issue: 1, pr: '#2', hours: 8 }]),
  review_escalation: handoff([{ spec_writer: 'a', issue: 1, pr: '#2', reviewer: 'r', hours: 8 }]),
  cloud_not_configured: handoff([label]),
  no_assignee: handoff([label]),
  ready_denied: handoff([label]),
  ready_denied_maintainer: handoff([label]),
  urgent_denied: wait([label]),
  urgent_denied_maintainer: wait([label]),
  go_denied: handoff([label]),
  go_denied_maintainer: handoff([label]),
  go_needs_ready: handoff([label]),
  go_building: wait([label]),
  go_already_built: handoff(['built', 'in-review', 'pr-open', 'changes-requested'].map((state) => ({ ...label, state }))),
  go_use_fix: handoff([label]),
  go_resume_stalled: handoff([label]),
  approval_withdrawn: handoff([{ issue: 1, edited: 'body', approver: 'a' }]),
  blocked_notice: wait([{ issue: 1, title: 't', blockers: '#2' }], STARTS),
  queued_capacity: wait([{ issue: 1, title: 't', assignee: 'a', built: 2, limit: 2, built_issues: '#3' }], STARTS),
  queued_agents: wait([{ issue: 1, title: 't' }], STARTS),
  queued_shared_files: wait([{ issue: 1, title: 't', file: 'f', other: 2, hours: 24 }], STARTS),
  fix_done: handoff([
    { ...fixed, state: 'built' },
    { ...fixed, state: 'in-review' },
    { ...fixed, state: 'pr-open' },
    { ...fixed, state: 'built', recipient: 'a' },
    { ...fixed, state: 'pr-open', recipient: 'a', ask: 'please re-review' },
    { ...fixed, state: 'in-review', local: true },
  ]),
  ship_stopped: handoff([ship], own(/Apply it again once this is solved/, /Vuelve a ponerla cuando esté resuelto/)),
  ship_retry: handoff([ship], own(/apply the label again to retry/, /vuelve a poner la etiqueta para reintentar/)),
  ship_not_approver: handoff([{ ...ship, approvers: 'b' }], own(/Run `\/relevo:ship 1`/, /Ejecuta `\/relevo:ship 1`/)),
  ship_no_ci: handoff([ship], own(/Run `\/relevo:ship 1`/, /Ejecuta `\/relevo:ship 1`/)),
  ship_needs_app: handoff([{ ...ship, base: 'dev' }], own(/Create a GitHub App/, /Crea una GitHub App/)),
  ship_done: wait([{ issue: 1, pr: '#2', base: 'dev', commit: 'c', actor: 'a' }]),
  ship_failed: handoff([{ issue: 1, run: 'http://r', actor: 'a' }], own(/apply relevo:ship again/, /vuelve a poner relevo:ship/)),
  run_progress: wait([{ phase: 'qa', minutes: 3 }]),
  run_progress_closed: info(),
  run_waiting: wait([{}], own(/starts as soon as a runner/, /empieza en cuanto un runner/)),
  run_failed_early: handoff([{ ...run, job_status: 'failure' }], own(/apply `relevo:go`/, /pon `relevo:go`/)),
  run_no_outcome: handoff(
    [
      { ...run, situation: 'kept', rescue_branch: 'feature/1-x' },
      { ...run, situation: 'kept', rescue_branch: 'rescue/feature/1-x' },
      { ...run, situation: 'usage_limit' },
      { ...run, situation: 'usage_limit_stopped' },
      { ...run, situation: 'no_result', job_status: 'cancelled' },
    ],
    own(/`\/relevo:go 1 (--resume|--retry)`/, /`\/relevo:go 1 (--resume|--retry)`/),
  ),
  usage_limit_retry: wait([{ ...run, attempt: 1, max: 3, at: '2026-11-12T13:01:00.000Z', reason: 'reset' }], own(/retries by itself/, /se reintenta solo/)),
  local_progress: info(),
  local_status: info(),
  local_no_build: info(),
  local_progress_off: info(),
};

// The closed list of the kinds that need no next step: what the terminal prints about a local build, and the closing of the
// progress comment, which only says where the result is.
const INFO = ['local_no_build', 'local_progress', 'local_progress_off', 'local_status', 'run_progress_closed'];

const unclassified = (kinds) => kinds.filter((kind) => !KINDS[kind]);

const guides = (kind, language) => {
  const { type, says } = KINDS[kind];
  if (says) return says[language];
  const prefix = type === 'wait' ? waitPrefix(language) : nextStepPrefix(language);
  return new RegExp(`${prefix}:`, 'i');
};

test('Scenario: A message with no class - every kind is classified, and one that is not is named', () => {
  assert.deepEqual(unclassified(MESSAGE_KINDS), [], `these kinds of message have no class (hand-off, wait or info): ${unclassified(MESSAGE_KINDS).join(', ')}`);
  assert.deepEqual(unclassified([...MESSAGE_KINDS, 'new_kind']), ['new_kind']);
  assert.deepEqual(Object.keys(KINDS).filter((kind) => !MESSAGE_KINDS.includes(kind)), [], 'a class for a kind that does not exist');
});

test('info is a closed list', () => {
  assert.deepEqual(Object.keys(KINDS).filter((kind) => KINDS[kind].type === 'info').sort(), INFO);
});

Object.entries(KINDS).filter(([, c]) => c.type !== 'info').forEach(([kind, { type, data }]) => {
  test(`${kind} says ${type === 'wait' ? 'why nobody acts' : 'the next step'}, in every language`, () => {
    data.forEach((sample) => {
      SUPPORTED_LANGUAGES.forEach((language) => {
        const text = renderMessage(kind, sample, language);
        assert.match(text, guides(kind, language), `${kind}/${language}/${JSON.stringify(sample)}:\n${text}`);
        assert.doesNotMatch(text, /\{\{|undefined|relevolocalnobody/, `${kind}/${language}`);
      });
    });
  });
});

test('Scenario: Shipped - nothing is left to do and the promotion is a separate pull request', () => {
  const data = { issue: 1, pr: '#2', base: 'dev', commit: 'c', actor: 'a' };
  assert.match(renderMessage('ship_done', data, 'en'), /nothing is left to do for it.*Promoting dev to the release branch is a separate pull request/s);
  assert.match(renderMessage('ship_done', data, 'es'), /no queda nada por hacer.*Promover dev a la rama de release es un pull request aparte/s);
});

test('Scenario: Go on an issue already built - the line of the table for the state it is in', () => {
  ['built', 'in-review', 'pr-open', 'changes-requested'].forEach((state) => {
    SUPPORTED_LANGUAGES.forEach((language) => {
      const text = renderMessage('go_already_built', { ...label, state }, language);
      assert.ok(text.includes(nextStep({ state, issue: 1, language }).line), `${state}/${language}:\n${text}`);
    });
  });
  assert.throws(() => renderMessage('go_already_built', label, 'en'), /needs "state"/);
});

test('Scenario: A review reminder - approve the pull request or request changes', () => {
  const data = { reviewer: 'r', issue: 1, pr: '#2', hours: 8 };
  assert.match(renderMessage('review_reminder', data, 'en'), /approve it or request changes/);
  assert.match(renderMessage('review_reminder', data, 'es'), /apruébalo o pide cambios/);
});

test('Scenario: A refused label - who can do what was asked, or why there is nothing to do', () => {
  assert.match(renderMessage('ready_denied', label, 'en'), /someone with write access approves it with the ready label/);
  assert.match(renderMessage('ready_denied_maintainer', label, 'en'), /a maintainer approves it with the ready label/);
  assert.match(renderMessage('go_denied', label, 'en'), /someone with write access applies the go label, or runs `\/relevo:go 1`/);
  assert.match(renderMessage('go_denied_maintainer', label, 'es'), /quien mantiene el proyecto pone la etiqueta go, o ejecuta `\/relevo:go 1`/);
  assert.match(renderMessage('urgent_denied', label, 'en'), /only the early start was refused/);
});

test('Scenario: A fix that tells nobody - the step of the state and no mention', () => {
  ['built', 'in-review', 'pr-open'].forEach((state) => {
    const text = renderMessage('fix_done', { ...fixed, state }, 'en');
    assert.ok(text.endsWith(nextStep({ state, issue: 1 }).line), text);
    assert.doesNotMatch(text, /@/);
  });
});

test('a fix mentions the assignee in front of the step of the table, in the language of the repository', () => {
  const data = { ...fixed, state: 'built', recipient: 'ana' };
  assert.ok(renderMessage('fix_done', data, 'es').endsWith(`@ana ${nextStep({ state: 'built', issue: 1, language: 'es' }).line}`));
  const reviewer = renderMessage('fix_done', { ...fixed, state: 'pr-open', recipient: 'bo', ask: 'please re-review' }, 'en');
  assert.ok(reviewer.endsWith(`@bo please re-review\n${nextStep({ state: 'pr-open', issue: 1 }).line}`), reviewer);
  assert.doesNotMatch(renderMessage('fix_done', { ...fixed, state: 'built', local: true }, 'en'), /@/);
});

test('Scenario: A build in progress - nothing to do because the agent is building', () => {
  assert.match(renderMessage('run_progress', { phase: 'qa', minutes: 3 }, 'en'), /Nothing to do now: the agent is building it\./);
  assert.match(renderMessage('run_progress', { phase: 'qa', minutes: 3 }, 'es'), /Nada que hacer ahora: el agente la está construyendo\./);
});

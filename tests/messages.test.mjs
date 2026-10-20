import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLanguage, renderMessage } from '../scripts/lib/messages.mjs';

const BUILT = {
  assignee: 'persona-b',
  issue: 31,
  title: 'Summary screen',
  tasks_done: 4,
  tasks_total: 4,
  branch: 'feature/31-summary',
  scenarios: 7,
  risk: 'the payment flow',
  due: 'today 17:00',
  checklist: '- [ ] Shows the total',
};

test('Scenario: Successful build - mentions the assignee and states every required element', () => {
  const text = renderMessage('built', BUILT);
  assert.match(text, /^@persona-b #31 "Summary screen" is built/);
  assert.match(text, /4 of 4 tasks done, QA passed/);
  assert.match(text, /feature\/31-summary/);
  assert.match(text, /7 scenarios/);
  assert.match(text, /Riskiest area, check it first: the payment flow/);
  assert.match(text, /Your next step: \/relevo:review 31/);
  assert.match(text, /Expected by: today 17:00/);
  assert.match(text, /- \[ \] Shows the total/);
});

test('optional lines disappear when the data is unknown', () => {
  const { risk, due, checklist, ...rest } = BUILT;
  const text = renderMessage('built', rest);
  assert.doesNotMatch(text, /Riskiest/);
  assert.doesNotMatch(text, /Expected by/);
  assert.match(text, /Your next step: \/relevo:review 31/);
  assert.doesNotMatch(text, /\n\n\n/);
  assert.equal(text, text.trimEnd());
});

test('Scenario: Failed build - names the finding with file and line, says the branch is pushed, gives the fix command', () => {
  const text = renderMessage('qa_failed', {
    assignee: 'persona-b',
    issue: 31,
    title: 'Summary screen',
    finding: 'the empty state is not handled',
    file: 'lib/summary.dart',
    line: 88,
    branch: 'feature/31-summary',
    log_url: 'https://example.invalid/report',
  });
  assert.match(text, /failed QA/);
  assert.match(text, /the empty state is not handled \(lib\/summary\.dart:88\)/);
  assert.match(text, /branch feature\/31-summary is pushed/);
  assert.match(text, /no pull request was opened/);
  assert.match(text, /Your next step: \/relevo:fix 31/);
  assert.match(text, /Full QA report: https:\/\/example\.invalid\/report/);
});

test('when a credential stopped the push, the message says the branch was NOT pushed', () => {
  const base = { assignee: 'b', issue: 1, title: 't', finding: 'possible credential in lib/a.dart', branch: 'feature/1-t' };
  const text = renderMessage('qa_failed', { ...base, pushed: false });
  assert.match(text, /was NOT pushed/);
  assert.doesNotMatch(text, /is pushed/);
  assert.match(renderMessage('qa_failed', { ...base, pushed: false }, 'es'), /NO se subió/);
  assert.match(renderMessage('qa_failed', base), /is pushed/);
});

test('budget failures carry their reason', () => {
  const text = renderMessage('qa_failed', {
    assignee: 'b', issue: 1, title: 't', finding: 'stopped', branch: 'f', reason: 'budget exceeded',
  });
  assert.match(text, /after the retries \(budget exceeded\)\./);
});

test('a finding without a file is still reported', () => {
  const text = renderMessage('qa_failed', { assignee: 'b', issue: 1, title: 't', finding: 'stopped early', branch: 'f' });
  assert.match(text, /Finding: stopped early\n/);
  assert.doesNotMatch(text, /\(\)/);
});

test('long values are shortened: long logs are linked, never embedded', () => {
  const text = renderMessage('qa_failed', {
    assignee: 'b', issue: 1, title: 't', finding: 'x'.repeat(5000), branch: 'f', log_url: 'https://example.invalid/log',
  });
  assert.ok(text.length < 1200);
  assert.match(text, /truncated; see the full log/);
});

test('Scenario: Spanish messages - same content in Spanish', () => {
  const text = renderMessage('built', BUILT, 'es');
  assert.match(text, /está construida/);
  assert.match(text, /Tu siguiente paso: \/relevo:review 31/);
  assert.match(text, /7 escenarios/);
});

test('unsupported languages fall back to English; regional tags use their base language', () => {
  assert.equal(pickLanguage('fr'), 'en');
  assert.equal(pickLanguage('es-MX'), 'es');
  assert.match(renderMessage('built', BUILT, 'fr'), /is built/);
});

test('missing required data is an error, not a silent gap', () => {
  assert.throws(() => renderMessage('built', { issue: 1 }), /needs "assignee"/);
  assert.throws(() => renderMessage('nope', {}), /unknown message kind/);
});

test('escalation and reminder messages mention only the person who must act', () => {
  const reminder = renderMessage('review_reminder', { reviewer: 'persona-c', issue: 31, pr: '#40', hours: 8 });
  assert.match(reminder, /^@persona-c reminder/);
  assert.doesNotMatch(reminder, /@persona-a/);
  const escalation = renderMessage('review_escalation', { spec_writer: 'persona-a', issue: 31, pr: '#40', reviewer: 'persona-c', hours: 16 });
  assert.match(escalation, /^@persona-a #31 has waited 16 hours/);
});

test('Scenario: Queued states its reason - for capacity and for the agent limit, in both languages, without a mention', () => {
  const cap = { issue: 9, title: 'Summary', assignee: 'persona-b', built: 2, limit: 2 };
  const en = renderMessage('queued_capacity', cap, 'en');
  assert.match(en, /persona-b already has 2 built issues waiting for review \(the limit is 2\)/);
  assert.match(en, /starts automatically/);
  assert.ok(!en.includes('@'));
  assert.match(renderMessage('queued_capacity', cap, 'es'), /ya tiene 2 issues construidos/);
  assert.match(renderMessage('queued_agents', { issue: 9, title: 'Summary' }, 'en'), /limit of concurrent agents/);
  assert.match(renderMessage('queued_agents', { issue: 9, title: 'Summary' }, 'es'), /agentes simult/);
});

// ---------- Next step from one table, the recovery for an existing branch, the hash of the text it was built from

const FAILED = { assignee: 'persona-b', issue: 31, title: 'Summary', finding: 'branch already exists', branch: 'feature/31-summary' };
const BACK = { spec_writer: 'persona-a', issue: 31, title: 'Summary', missing: 'edge cases' };
const BUILT_DATA = { assignee: 'persona-b', issue: 31, title: 'Summary', tasks_done: 5, tasks_total: 5, branch: 'feature/31-summary', scenarios: 4 };

test('Scenario: Failed because the branch already exists with implementation commits - untouched, and /relevo:fix', () => {
  const text = renderMessage('qa_failed', { ...FAILED, branch_state: 'existing', recovery: 'fix' });
  assert.match(text, /already existed on the remote, so it was not touched/);
  assert.doesNotMatch(text, /is pushed|NOT pushed/);
  assert.match(text, /Your next step: \/relevo:fix 31/);
});

test('Scenario: Failed because the branch already exists with only the specification - delete it and apply ready again', () => {
  const text = renderMessage('qa_failed', { ...FAILED, branch_state: 'existing', recovery: 'delete-branch' });
  assert.match(text, /already existed on the remote/);
  assert.match(text, /Your next step: the branch holds only the specification: delete the remote branch and label the issue ready again\./);
  assert.doesNotMatch(text, /\/relevo:fix/);
});

test('the same recoveries in Spanish', () => {
  const fix = renderMessage('qa_failed', { ...FAILED, branch_state: 'existing', recovery: 'fix' }, 'es');
  assert.match(fix, /ya existía en el remoto, así que no se tocó/);
  assert.match(fix, /Tu siguiente paso: \/relevo:fix 31/);
  assert.match(renderMessage('qa_failed', { ...FAILED, branch_state: 'existing', recovery: 'delete-branch' }, 'es'), /borra la rama remota y vuelve a ponerle ready al issue/);
});

test('branch_state unsafe is the same as the older pushed: false, and now names a protected path too', () => {
  const unsafe = renderMessage('qa_failed', { ...FAILED, branch_state: 'unsafe' });
  assert.equal(unsafe, renderMessage('qa_failed', { ...FAILED, pushed: false }));
  assert.match(unsafe, /was NOT pushed \(a possible credential, a temporary marker or a protected path was found\)/);
  assert.match(renderMessage('qa_failed', { ...FAILED, branch_state: 'unsafe' }, 'es'), /NO se subió \(se encontró una posible credencial, un marcador temporal o una ruta protegida\)/);
});

test('a plain failed build is unchanged: pushed branch and the fix command', () => {
  const text = renderMessage('qa_failed', FAILED);
  assert.match(text, /is pushed/);
  assert.match(text, /Your next step: \/relevo:fix 31$/);
});

test('qa_failed rejects an unknown branch state and an existing branch without a recovery', () => {
  assert.throws(() => renderMessage('qa_failed', { ...FAILED, branch_state: 'gone' }), /unknown branch_state "gone"/);
  assert.throws(() => renderMessage('qa_failed', { ...FAILED, branch_state: 'existing' }), /needs "recovery"/);
  assert.throws(() => renderMessage('qa_failed', { ...FAILED, branch_state: 'existing', recovery: 'burn' }), /unknown reason "burn"/);
});

test('Scenario: Spec returned with a reason - missing gives /relevo:issue', () => {
  const text = renderMessage('needs_spec', BACK);
  assert.match(text, /What is missing: edge cases/);
  assert.match(text, /Your next step: \/relevo:issue 31: complete what is missing, then label it ready again\./);
  assert.equal(renderMessage('needs_spec', { ...BACK, reason: 'missing' }), text, 'missing is the default');
});

test('Scenario: Spec returned with a reason - ambiguous asks for a decision and mentions /relevo:think', () => {
  const text = renderMessage('needs_spec', { ...BACK, missing: 'what happens when the list is empty?', reason: 'ambiguous' });
  assert.match(text, /Your next step: \/relevo:issue 31: decide the open question \(run \/relevo:think first if you need to explore it\), then label it ready again\./);
  assert.match(renderMessage('needs_spec', { ...BACK, reason: 'ambiguous' }, 'es'), /Tu siguiente paso: \/relevo:issue 31: decide la pregunta abierta \(ejecuta antes \/relevo:think/);
  assert.throws(() => renderMessage('needs_spec', { ...BACK, reason: 'whim' }), /unknown reason "whim"/);
});

test('Scenario: Successful build - quotes the short hash of the issue text it was built from, and omits the line without one', () => {
  const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const text = renderMessage('built', { ...BUILT_DATA, issue_hash: hash });
  assert.match(text, /Built from the issue text: abcdef01\n/);
  assert.doesNotMatch(text, /abcdef012/);
  assert.match(renderMessage('built', { ...BUILT_DATA, issue_hash: hash }, 'es'), /Construida con el texto del issue: abcdef01\n/);
  assert.doesNotMatch(renderMessage('built', BUILT_DATA), /issue text/);
  assert.match(renderMessage('built', BUILT_DATA), /Your next step: \/relevo:review 31/);
});

test('approved and changes_requested take their command from the same table', () => {
  assert.match(renderMessage('approved', { recipient: 'persona-b', issue: 31, reviewer: 'persona-c' }), /Your next step: \/relevo:ship 31/);
  assert.match(renderMessage('changes_requested', { author: 'persona-b', issue: 31, reviewer: 'persona-c', summary: 'x' }), /Your next step: \/relevo:fix 31/);
});

test('Scenario: Issue changed after ready - the branch was not pushed, for a reason that is neither a credential nor a marker', () => {
  const text = renderMessage('qa_failed', { ...FAILED, finding: 'the issue was edited', reason: 'issue changed after ready', branch_state: 'not_pushed' });
  assert.match(text, /was not pushed; the state did not advance/);
  assert.match(text, /\(issue changed after ready\)/);
  assert.doesNotMatch(text, /credential|marker/);
  assert.match(renderMessage('qa_failed', { ...FAILED, branch_state: 'not_pushed' }, 'es'), /no se subió; el estado no avanzó/);
});

test('the platform message of the previous change no longer exists: a missing platform is a missing part of the spec', () => {
  assert.throws(() => renderMessage('platform', { issue: 1, actor: 'a', platforms: 'x' }), /unknown message kind "platform"/);
  const text = renderMessage('needs_spec', { spec_writer: 'a', issue: 3, title: 'T', missing: 'Platform: line naming one of the platforms of relevo.yml (web, api)', reason: 'missing' });
  assert.match(text, /What is missing: Platform: line naming one of the platforms of relevo\.yml \(web, api\)/);
});

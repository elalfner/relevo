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

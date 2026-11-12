// Implements "A missing language key fails the build of Relevo" of the configuration specification: every supported language
// has the same message kinds, the same usage phrases and the same placeholders as English, and a missing one renders in English.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, MESSAGE_KINDS, USAGE_TEXT, renderMessage, usagePhrase } from '../scripts/lib/messages.mjs';
import { SUPPORTED_LANGUAGES } from '../scripts/lib/language.mjs';

const placeholders = (lines) => [...new Set([].concat(lines).join('\n').match(/\{\{\w+\}\}/g) ?? [])].sort();

test('every supported language has every message kind of English and no other', () => {
  const english = Object.keys(CATALOG.en).sort();
  assert.deepEqual([...MESSAGE_KINDS].sort(), english, 'REQUIRED and the English catalog list the same kinds');
  SUPPORTED_LANGUAGES.forEach((language) => {
    const kinds = Object.keys(CATALOG[language] ?? {}).sort();
    assert.deepEqual(english.filter((k) => !kinds.includes(k)), [], `${language} lacks kinds of English`);
    assert.deepEqual(kinds.filter((k) => !english.includes(k)), [], `${language} has kinds that English does not`);
  });
});

test('every line of every language has the placeholders of the English line', () => {
  SUPPORTED_LANGUAGES.forEach((language) => {
    Object.keys(CATALOG.en).forEach((kind) => {
      assert.equal(CATALOG[language][kind].length, CATALOG.en[kind].length, `${language}/${kind} has another number of lines`);
      CATALOG.en[kind].forEach((line, i) => {
        assert.deepEqual(placeholders(CATALOG[language][kind][i]), placeholders(line), `${language}/${kind} line ${i + 1} uses other placeholders than English`);
      });
    });
  });
});

test('every language has every phrase of the usage comment with the placeholders of English', () => {
  const english = Object.keys(USAGE_TEXT.en).sort();
  SUPPORTED_LANGUAGES.forEach((language) => {
    assert.deepEqual(Object.keys(USAGE_TEXT[language] ?? {}).sort(), english, `${language} usage phrases differ from English`);
    english.forEach((key) => assert.deepEqual(placeholders(USAGE_TEXT[language][key]), placeholders(USAGE_TEXT.en[key]), `${language}/${key}`));
  });
});

test('a kind that a language lacks renders in English instead of failing', () => {
  const saved = CATALOG.es.ship_done;
  delete CATALOG.es.ship_done;
  try {
    const text = renderMessage('ship_done', { issue: 4, pr: '#9', base: 'dev', commit: 'abc', actor: 'ana' }, 'es');
    assert.match(text, /#4 shipped/);
  } finally {
    CATALOG.es.ship_done = saved;
  }
});

test('a usage phrase that a language lacks is English; an unknown phrase is an error', () => {
  const saved = USAGE_TEXT.es.by_agent;
  delete USAGE_TEXT.es.by_agent;
  try {
    assert.match(usagePhrase('es', 'by_agent', { list: 'x' }), /^ By agent: x\.$/);
  } finally {
    USAGE_TEXT.es.by_agent = saved;
  }
  assert.throws(() => usagePhrase('en', 'nonsense'), /unknown usage phrase/);
});

// Sample data for each kind, so that a kind added later without a sample fails here and is not left untested.
const SAMPLE = {
  built: { assignee: 'a', issue: 1, title: 't', tasks_done: 1, tasks_total: 1, branch: 'b', scenarios: 1, checklist: '- [ ] x' },
  qa_failed: { assignee: 'a', issue: 1, title: 't', finding: 'f', branch: 'b' },
  toolchain_missing: { assignee: 'a', issue: 1, title: 't', tools: 'php', platform: 'back' },
  installed_missing: { assignee: 'a', issue: 1, title: 't', paths: 'vendor', platform: 'back' },
  needs_spec: { spec_writer: 'a', issue: 1, title: 't', missing: 'm' },
  changes_requested: { author: 'a', issue: 1, reviewer: 'r', summary: 's' },
  needs_reviewer: { spec_writer: 'a', issue: 1, title: 't', pr: '#2' },
  approved: { recipient: 'a', issue: 1, reviewer: 'r', ship_label: 'relevo:ship' },
  review_reminder: { reviewer: 'r', issue: 1, pr: '#2', hours: 8 },
  review_escalation: { spec_writer: 'a', issue: 1, pr: '#2', reviewer: 'r', hours: 8 },
  no_milestone: { actor: 'a', issue: 1 },
  cloud_not_configured: { actor: 'a', issue: 1 },
  no_assignee: { actor: 'a', issue: 1 },
  ready_denied: { issue: 1, actor: 'a' },
  ready_denied_maintainer: { issue: 1, actor: 'a' },
  urgent_denied: { issue: 1, actor: 'a' },
  urgent_denied_maintainer: { issue: 1, actor: 'a' },
  blocked_notice: { issue: 1, title: 't', blockers: '#2' },
  queued_capacity: { issue: 1, title: 't', assignee: 'a', built: 2, limit: 2, built_issues: '#3, #4' },
  queued_agents: { issue: 1, title: 't', active: 2, active_issues: '#3, #4', ahead: 1, typical_minutes: 30, typical_samples: 5 },
  fix_done: { issue: 1, title: 't', summary: 's', qa: 'ok', commit: 'c', iteration: 1, recipient: 'a', ask: 'check' },
  ship_stopped: { actor: 'a', issue: 1, reasons: 'r' },
  ship_not_approver: { actor: 'a', issue: 1, approvers: 'b' },
  ship_no_ci: { actor: 'a', issue: 1 },
  ship_needs_app: { actor: 'a', issue: 1, base: 'dev' },
  ship_done: { issue: 1, pr: '#2', base: 'dev', commit: 'c', actor: 'a' },
  ship_failed: { issue: 1, run: 'http://r', actor: 'a' },
  run_progress: { phase: 'qa', minutes: 3, tasks_done: 1, tasks_total: 2 },
  run_progress_closed: { run_url: 'http://r', summary_line: 's' },
  run_failed_early: { issue: 1, job_status: 'failure', run: 'http://r', assignee: 'a' },
  run_no_outcome: { situation: 'no_result', issue: 1, job_status: 'cancelled', run: 'http://r', assignee: 'a' },
  usage_limit_retry: { issue: 1, assignee: 'a', run: 'http://r', attempt: 1, max: 3, at: '2026-11-12T13:01:00.000Z', reason: 'reset' },
};

test('every kind renders in every language with no placeholder left over', () => {
  MESSAGE_KINDS.forEach((kind) => {
    assert.ok(SAMPLE[kind], `no sample data for the kind "${kind}": add it to this test`);
    SUPPORTED_LANGUAGES.forEach((language) => {
      const text = renderMessage(kind, SAMPLE[kind], language);
      assert.ok(text.length > 0, `${kind}/${language} is empty`);
      assert.doesNotMatch(text, /\{\{/, `${kind}/${language} left a placeholder`);
    });
  });
});

test('the kept rescue comment renders in every language with no placeholder left, with and without the number of checkpoints', () => {
  const kept = { situation: 'kept', issue: 1, run: 'http://r', assignee: 'a', rescue_branch: 'feature/1-x' };
  [{}, { checkpoints: 0 }, { checkpoints: 3 }, { rescue_branch: 'rescue/feature/1-x' }].forEach((extra) => {
    SUPPORTED_LANGUAGES.forEach((language) => {
      const text = renderMessage('run_no_outcome', { ...kept, ...extra }, language);
      assert.doesNotMatch(text, /\{\{|undefined|NaN/, `kept/${language}/${JSON.stringify(extra)} left a placeholder`);
      if (!extra.rescue_branch) assert.doesNotMatch(text, /from the start|desde el principio/);
    });
  });
});

test('the phrase that gives the reason of a replica is in English and Spanish, and the reason is quoted as written', () => {
  assert.equal(usagePhrase('en', 'replica_why', { why: 'one name below sonnet' }), ', because one name below sonnet');
  assert.equal(usagePhrase('es', 'replica_why', { why: 'one name below sonnet' }), ', porque one name below sonnet');
  assert.ok(USAGE_TEXT.en.replica_why && USAGE_TEXT.es.replica_why);
});

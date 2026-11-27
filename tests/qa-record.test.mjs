import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TEXT_CAP, TEXTS_KEPT, appendAttempt, attemptOf, parseRecord, readLog, recordMarker, summarizeRecords } from '../scripts/lib/qa-record.mjs';

const log = () => join(mkdtempSync(join(tmpdir(), 'relevo-qa-')), 'qa.jsonl');
const finding = (text, lens = 'spec', cls = 'fixable') => ({ number: 1, lens, class: cls, text });
const rounds = (...texts) => [attemptOf({ findings: texts.map((t) => finding(t)) })];
const comment = (body, over = {}) => ({ user: { type: 'Bot' }, issue_url: 'https://api.github.com/repos/acme/app/issues/7', created_at: '2026-03-09T10:00:00Z', body, ...over });
const data = (marker) => JSON.parse(/\{.*\}/.exec(marker)[0]);

test('Scenario: A rejection then a pass - the log holds both attempts, the findings in the first', () => {
  const path = log();
  assert.equal(appendAttempt(path, attemptOf({ findings: [finding('a'), finding('b', 'code')], advisory: [{}] })), true);
  assert.equal(appendAttempt(path, attemptOf({ advisory: [] })), true);
  const read = readLog(path);
  assert.deepEqual(read.map((r) => [r.gate, r.blocking.length, r.advisory]), [['green', 2, 1], ['green', 0, 0]]);
});

test('a log that cannot be written or read, or has a broken line, gives no record', () => {
  assert.equal(appendAttempt('/nonexistent/dir/qa.jsonl', attemptOf()), false);
  assert.equal(readLog('/nonexistent/dir/qa.jsonl'), null);
  const path = log();
  writeFileSync(path, '');
  assert.equal(readLog(path), null);
  writeFileSync(path, `${JSON.stringify(attemptOf())}\n{"gate":"gre\n`);
  assert.equal(readLog(path), null);
  writeFileSync(path, '{"gate":"green"}\n');
  assert.equal(readLog(path), null);
});

test('Scenario: A finding that quotes a credential - the marker holds it with the key redacted', () => {
  const key = `sk-ant-${'a1B2'.repeat(8)}`;
  const marker = recordMarker({ command: 'go', passed: true, rounds: rounds(`The key ${key} is in config.js`, 'API_KEY = "hunter2hunter2" is committed'), withText: true });
  assert.doesNotMatch(marker, /a1B2a1B2|hunter2/);
  assert.match(marker, /The key \[redacted\] is in config\.js/);
});

test('a text is one line, bounded, and cannot close the comment; only the first texts are kept and the rest counted', () => {
  const many = Array.from({ length: TEXTS_KEPT + 3 }, (_, i) => (i === 0 ? `--> <b>\nsecond ${'x'.repeat(400)}` : `finding ${i}`));
  const marker = recordMarker({ command: 'go', passed: false, rounds: rounds(...many), withText: true });
  assert.equal(marker.indexOf('-->'), marker.length - 3);
  assert.doesNotMatch(marker, /\n/);
  const { rounds: [round], omitted } = data(marker);
  assert.equal(round.blocking.length, TEXTS_KEPT + 3);
  assert.equal(round.blocking.filter((f) => f.text).length, TEXTS_KEPT);
  assert.equal(round.blocking[0].text.length, TEXT_CAP);
  assert.equal(omitted, 3);
});

test('Scenario: A public repository - no finding text', () => {
  const marker = recordMarker({ command: 'go', passed: true, rounds: rounds('a very telling text') });
  assert.doesNotMatch(marker, /telling/);
  assert.deepEqual(data(marker).rounds[0].blocking, [{ lens: 'spec', class: 'fixable' }]);
  assert.equal(data(marker).omitted, 0);
});

test('Scenario: A stranger types a marker - only a bot or a person with a role counts, with exactly one valid marker', () => {
  const marker = recordMarker({ command: 'fix', passed: true, kind: 'defect', rounds: rounds('x'), withText: true });
  const body = `visible\r\n${marker}\r\n`;
  const read = parseRecord(comment(body));
  assert.deepEqual([read.issue, read.command, read.passed, read.kind], [7, 'fix', true, 'defect']);
  for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) assert.ok(parseRecord(comment(body, { user: { type: 'User' }, author_association: association })));
  for (const association of ['CONTRIBUTOR', 'NONE', undefined]) assert.equal(parseRecord(comment(body, { user: { type: 'User' }, author_association: association })), null);
  assert.equal(parseRecord(comment(`${marker}\n${marker}`)), null);
  assert.equal(parseRecord(comment(`Finding: ${marker}`)), null);
  assert.equal(parseRecord(comment('QA passed. 3 findings.')), null);
  assert.equal(parseRecord(comment('<!-- relevo:qa-record {"v":1} -->')), null);
  assert.equal(parseRecord(comment(marker.replace('"spec"', '"Spec <x>"'))), null);
});

test('the figures count the findings of the first attempt, and apart those of runs that ended passed', () => {
  const run = (over) => ({ command: 'go', passed: true, kind: null, rounds: [attemptOf()], ...over });
  const one = attemptOf({ findings: [finding('a')] });
  const summary = summarizeRecords([
    run({ rounds: [one, one] }),
    run({ passed: false, rounds: [one] }),
    run({ rounds: [attemptOf({ gate: 'red' }), attemptOf()] }),
    run({ command: 'fix', kind: 'defect' }),
    run({ command: 'fix' }),
  ]);
  assert.deepEqual([summary.runs, summary.builds, summary.fixes, summary.stopped], [5, 3, 2, 3]);
  assert.deepEqual(summary.findings, [{ lens: 'spec', class: 'fixable', count: 2, passed: 1 }]);
  assert.deepEqual([summary.total, summary.totalPassed, summary.defects], [2, 1, 1]);
  assert.deepEqual(summary.kinds, { defect: 1, 'not said': 1 });
});

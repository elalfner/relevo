// Implements the capability `usage-limit-retry`: the decision, the marker and the comment of an issue that stopped at a usage limit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKOFF_MINUTES, MAX_RETRIES, decideRetry, latestRetry, parseRetryMarker, priorRetries, retryMarker } from '../scripts/lib/limit-retry.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';

const NOW = Date.parse('2026-11-12T10:00:00Z');
const MIN = 60000;
const reset = Date.parse('2026-11-12T13:00:00Z');
const limitLog = (resetsAt) => JSON.stringify([{ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', ...(resetsAt === undefined ? {} : { resetsAt }) } }]);
const bot = (attempt, ageMinutes = 10, at = NOW, reason = 'backoff') => ({
  user: { type: 'Bot' }, created_at: new Date(NOW - ageMinutes * MIN).toISOString(), body: `text\n\n${retryMarker({ at, attempt, reason })}`,
});

test('Scenario: The log names the reset - the retry is one minute after it', () => {
  const d = decideRetry({ log: limitLog(reset / 1000), comments: [], rescueState: 'nothing', now: NOW });
  assert.deepEqual(d, { action: 'retry', at: reset + MIN, reason: 'reset', attempt: 1, max: 3 });
});

test('Scenario: The back-off grows - 30 minutes, 2 hours, 5 hours when the log has no reset', () => {
  assert.deepEqual(BACKOFF_MINUTES, [30, 120, 300]);
  [[[], 30], [[bot(1)], 120], [[bot(1), bot(2)], 300]].forEach(([comments, minutes], i) => {
    const d = decideRetry({ log: limitLog(), comments, rescueState: 'kept', now: NOW });
    assert.equal(d.action, 'retry');
    assert.equal(d.reason, 'backoff');
    assert.equal(d.attempt, i + 1);
    assert.equal(d.at, NOW + minutes * MIN);
  });
});

test('a reset time that is not credible is a back-off: in the past, far away, or a free-text log', () => {
  [limitLog(NOW / 1000 - 60), limitLog((NOW + 20 * 86400000) / 1000), 'Claude AI usage limit reached|1760000000'].forEach((log) => {
    assert.equal(decideRetry({ log, comments: [], rescueState: 'nothing', now: NOW }).reason, 'backoff');
  });
});

test('Scenario: The limit is hit again and again - after 3 retries the issue stops', () => {
  assert.equal(MAX_RETRIES, 3);
  const d = decideRetry({ log: limitLog(reset / 1000), comments: [bot(1), bot(2), bot(3)], rescueState: 'nothing', now: NOW });
  assert.deepEqual(d, { action: 'stop', reason: 'bound', attempt: 3, max: 3 });
});

test('Scenario: An old episode - a marker older than 24 hours counts as no retry', () => {
  assert.equal(priorRetries([bot(3, 25 * 60)], NOW), 0);
  assert.equal(priorRetries([bot(3, 23 * 60)], NOW), 3);
  assert.equal(decideRetry({ log: limitLog(), comments: [bot(3, 25 * 60)], rescueState: 'nothing', now: NOW }).attempt, 1);
});

test('a marker typed by a person, a malformed one or two in a comment is ignored', () => {
  const person = { user: { type: 'User' }, created_at: new Date(NOW).toISOString(), body: retryMarker({ at: NOW, attempt: 3, reason: 'reset' }) };
  assert.equal(latestRetry([person]), null);
  const base = { user: { type: 'Bot' }, created_at: new Date(NOW).toISOString() };
  ['<!-- relevo:retry {"at":"x","attempt":1,"reason":"reset"} -->', '<!-- relevo:retry {"at":"2026-11-12T10:00:00Z","attempt":9,"reason":"reset"} -->',
    '<!-- relevo:retry {"at":"2026-11-12T10:00:00Z","attempt":1,"reason":"other"} -->', '<!-- relevo:retry nope -->',
    `${retryMarker({ at: NOW, attempt: 1, reason: 'reset' })}${retryMarker({ at: NOW, attempt: 2, reason: 'reset' })}`].forEach((body) => {
    assert.equal(parseRetryMarker({ ...base, body }), null, body);
  });
  assert.equal(decideRetry({ log: limitLog(), comments: [person], rescueState: 'nothing', now: NOW }).attempt, 1);
});

test('Scenario: Work could not be kept - only kept or nothing may retry, and unreadable comments fail closed', () => {
  ['unsafe', 'not_pushed', 'existing', '', undefined].forEach((rescueState) => {
    assert.deepEqual(decideRetry({ log: limitLog(), comments: [], rescueState, now: NOW }), { action: 'stop', reason: 'work_not_kept' });
  });
  ['kept', 'nothing'].forEach((rescueState) => assert.equal(decideRetry({ log: limitLog(), comments: [], rescueState, now: NOW }).action, 'retry'));
  assert.deepEqual(decideRetry({ log: limitLog(), comments: null, rescueState: 'kept', now: NOW }), { action: 'stop', reason: 'unreadable' });
});

test('limit-retry.mjs prints one line of JSON with the marker, and stops when it cannot read the comments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'limit-retry-'));
  const log = join(dir, 'log.json');
  writeFileSync(log, limitLog(reset / 1000));
  const comments = join(dir, 'comments.json');
  writeFileSync(comments, JSON.stringify([bot(1, 30)]));
  const script = new URL('../scripts/limit-retry.mjs', import.meta.url).pathname;
  const run = (...args) => spawnSync('node', [script, '--file', log, '--now', '2026-11-12T10:00:00Z', ...args], { encoding: 'utf8' });
  const ok = run('--rescue-state', 'kept', '--comments', comments);
  assert.equal(ok.status, 0);
  const out = JSON.parse(ok.stdout);
  assert.deepEqual([out.action, out.at, out.reason, out.attempt], ['retry', '2026-11-12T13:01:00.000Z', 'reset', 2]);
  assert.deepEqual(parseRetryMarker({ user: { type: 'Bot' }, body: out.marker }).attempt, 2);
  assert.equal(JSON.parse(run('--rescue-state', 'unsafe', '--comments', comments).stdout).reason, 'work_not_kept');
  const bad = run('--rescue-state', 'kept');
  assert.equal(bad.status, 0);
  assert.equal(JSON.parse(bad.stdout).reason, 'unreadable');
});

const data = { issue: 7, assignee: 'ana', run: 'https://x/run/1', attempt: 1, max: 3, at: '2026-11-12T13:01:00.000Z', reason: 'reset' };

test('Scenario: The log names the reset - the comment says when, in UTC, and carries the marker', () => {
  const text = renderMessage('usage_limit_retry', data, 'en');
  assert.match(text, /^@ana The run stopped because the usage limit/);
  assert.match(text, /resets at 2026-11-12 13:01 UTC/);
  assert.match(text, /retry 1 of 3/);
  assert.doesNotMatch(text, /qa-failed/);
  const marker = text.match(/<!-- relevo:retry .* -->/)[0];
  assert.deepEqual(parseRetryMarker({ user: { type: 'Bot' }, body: marker }), { at: Date.parse(data.at), attempt: 1, reason: 'reset', created: null });
});

test('Scenario: The log does not name the reset - the comment says it is a back-off, not a prediction', () => {
  const en = renderMessage('usage_limit_retry', { ...data, reason: 'backoff' }, 'en');
  assert.match(en, /does not say when the quota resets/);
  assert.match(en, /not a prediction/);
  assert.match(renderMessage('usage_limit_retry', { ...data, reason: 'backoff' }, 'es'), /no dice cuándo se restablece la cuota.*no una predicción/);
});

test('Scenario: Work was kept - the comment names the branch', () => {
  const kept = { ...data, rescue_state: 'kept', rescue_branch: 'feature/7-x' };
  assert.match(renderMessage('usage_limit_retry', kept, 'en'), /on the branch `feature\/7-x` and the retry continues from it/);
  assert.match(renderMessage('usage_limit_retry', kept, 'es'), /rama `feature\/7-x` y el reintento continúa/);
  assert.doesNotMatch(renderMessage('usage_limit_retry', data, 'en'), /branch/);
});

test('Scenario: Spanish repository - the comment is in Spanish with the time in UTC and the labels unchanged', () => {
  const es = renderMessage('usage_limit_retry', data, 'es');
  assert.match(es, /^@ana La ejecución se detuvo porque se alcanzó el límite de uso/);
  assert.match(es, /2026-11-12 13:01 UTC/);
  assert.match(es, /reintento 1 de 3/);
});

test('a retry message with a bad time, attempt or reason is an error, and a marker in the data is never copied', () => {
  assert.throws(() => renderMessage('usage_limit_retry', { ...data, at: 'soon' }), /ISO time/);
  assert.throws(() => renderMessage('usage_limit_retry', { ...data, reason: 'x' }), /reason/);
  const text = renderMessage('usage_limit_retry', { ...data, marker: '<!-- relevo:retry {"at":"2030-01-01T00:00:00Z","attempt":1,"reason":"reset"} -->' }, 'en');
  assert.equal([...text.matchAll(/relevo:retry/g)].length, 1);
  assert.match(text, /2026-11-12T13:01:00\.000Z/);
});

test('Scenario: Retries used up - the stopped situation asks a person, in both languages', () => {
  const base = { situation: 'usage_limit_stopped', issue: 7, run: 'https://x/run/1', assignee: 'ana', max: 3 };
  const en = renderMessage('run_no_outcome', base, 'en');
  assert.match(en, /after 3 automatic retries/);
  assert.match(en, /remove `relevo:qa-failed` and apply `relevo:ready`/);
  assert.match(renderMessage('run_no_outcome', base, 'es'), /tras 3 reintentos automáticos/);
  assert.match(renderMessage('run_no_outcome', { ...base, rescue_state: 'kept', rescue_branch: 'feature/7-x' }, 'en'), /on the branch `feature\/7-x`/);
});

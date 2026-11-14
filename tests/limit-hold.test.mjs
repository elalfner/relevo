// Implements "A queued issue waits for its retry time" and "Only one issue retries after a limit at a time" of the capability
// `usage-limit-retry`: the planner and the reading of the marker.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';
import { gather } from '../scripts/lib/github.mjs';
import { retryMarker } from '../scripts/lib/limit-retry.mjs';
import { planGo } from '../scripts/lib/plan.mjs';
import { staggerSeconds } from '../scripts/lib/requeue.mjs';

const BODY = '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n';
const config = loadConfig('limits:\n  run_max_cost: 5\n  concurrent_agents: 3\n  built_unreviewed_per_person: 5\nteam:\n  spec_writer: persona-a\n').config;
const NOW = Date.parse('2026-11-12T10:00:00Z');
const HOUR = 3600000;
const issue = (n, labels, extra = {}) => ({
  number: n, title: `Task ${n}`, body: BODY, state: 'open', labels, assignees: ['persona-b'], milestone: { number: 1, due_on: null },
  ready_at: `2026-11-0${n}T00:00:00Z`, ready_by: 'persona-a', urgent_by: null, ...extra,
});
const waiting = (n, at, extra = {}) => issue(n, ['relevo:queued'], { limit_retry: { at, attempt: 1, reason: 'backoff' }, ...extra });
const plan = (issues, extra = {}) => planGo({ config, issues, permissions: { 'persona-a': 'admin' }, now: NOW, ...extra });
const actionOf = (result, n) => result.decisions.find((d) => d.issue === n);

test('Scenario: Before the time - the issue stays queued, takes no slot and posts no comment', () => {
  const r = plan([waiting(1, NOW + HOUR)]);
  const d = actionOf(r, 1);
  assert.equal(d.action, 'skip');
  assert.match(d.reason, /usage limit.*retries after 2026-11-12T11:00:00\.000Z/);
  assert.deepEqual([d.comment, d.labels.add, d.labels.remove], [null, [], []]);
  // A held issue does not use a slot: another issue starts although the limit is 3 and one is held.
  const other = plan([waiting(1, NOW + HOUR), issue(2, ['relevo:queued'])]);
  assert.equal(actionOf(other, 2).action, 'start');
});

test('after its time the issue starts as any other', () => {
  assert.equal(actionOf(plan([waiting(1, NOW - 1)]), 1).action, 'start');
  assert.equal(actionOf(plan([waiting(1, NOW)]), 1).action, 'start');
});

test('Scenario: A person applies ready - the hold applies to queued issues only', () => {
  const ready = issue(1, ['relevo:ready'], { limit_retry: { at: NOW + HOUR, attempt: 2, reason: 'reset' } });
  assert.equal(actionOf(plan([ready]), 1).action, 'start');
});

test('urgent does not skip the hold', () => {
  const urgent = waiting(1, NOW + HOUR, { labels: ['relevo:queued', 'relevo:urgent'], urgent_by: 'persona-a' });
  assert.equal(actionOf(plan([urgent]), 1).action, 'skip');
});

test('no marker changes nothing', () => {
  assert.equal(actionOf(plan([issue(1, ['relevo:queued'])]), 1).action, 'start');
  assert.equal(actionOf(plan([issue(1, ['relevo:queued'], { limit_retry: null })]), 1).action, 'start');
});

test('Scenario: The window resets with three issues waiting - one starts and the other two stay queued', () => {
  const r = plan([waiting(1, NOW - 1), waiting(2, NOW - 1), waiting(3, NOW - 1)]);
  assert.deepEqual(r.decisions.map((d) => [d.issue, d.action]), [[1, 'start'], [2, 'skip'], [3, 'skip']]);
  assert.match(actionOf(r, 2).reason, /another issue that retries after a usage limit/);
  assert.equal(actionOf(r, 2).comment, null);
});

test('a building retry blocks the others, but an old marker on a building issue does not', () => {
  const building = (at) => issue(9, ['relevo:building'], { limit_retry: { at, attempt: 1, reason: 'reset' } });
  assert.equal(actionOf(plan([building(NOW - HOUR), waiting(1, NOW - 1)]), 1).action, 'skip');
  assert.equal(actionOf(plan([building(NOW - 30 * HOUR), waiting(1, NOW - 1)]), 1).action, 'start');
});

test('an issue that is not retrying starts even while a retry runs', () => {
  const building = issue(9, ['relevo:building'], { limit_retry: { at: NOW - HOUR, attempt: 1, reason: 'reset' } });
  assert.equal(actionOf(plan([building, issue(2, ['relevo:queued'])]), 2).action, 'start');
});

// gather: the marker of a comment of a bot is read for queued and building issues only.
const raw = (n, label) => ({ number: n, title: `T${n}`, body: BODY, state: 'open', labels: [{ name: label }], assignees: [{ login: 'persona-b' }], milestone: { number: 1, due_on: null } });
function world(comments) {
  const calls = [];
  const gh = (args) => {
    calls.push(args[args.length - 1]);
    const path = args[args.length - 1];
    if (path.includes('/issues?')) {
      const label = decodeURIComponent(path.match(/labels=(.*)$/)[1]);
      return JSON.stringify([{ 'relevo:queued': [raw(1, label)], 'relevo:building': [raw(2, label)], 'relevo:ready': [raw(3, label)] }[label] ?? []]);
    }
    if (path.includes('/timeline')) return JSON.stringify([[]]);
    const m = path.match(/issues\/(\d+)\/comments/);
    if (m) {
      if (comments instanceof Error) throw comments;
      return JSON.stringify([comments[Number(m[1])] ?? []]);
    }
    if (path.includes('/permission')) return JSON.stringify({ permission: 'admin' });
    return '';
  };
  gh.calls = calls;
  return gh;
}
const botComment = (marker) => ({ user: { type: 'Bot' }, created_at: '2026-11-12T09:00:00Z', body: `x\n${marker}` });

test('gather reads the retry marker of queued and building issues, and not of ready ones', () => {
  const at = NOW + HOUR;
  const gh = world({ 1: [botComment(retryMarker({ at, attempt: 2, reason: 'reset' }))], 2: [botComment(retryMarker({ at, attempt: 1, reason: 'backoff' }))], 3: [botComment(retryMarker({ at, attempt: 1, reason: 'backoff' }))] });
  const { issues } = gather({ gh, repo: 'acme/app', config });
  const by = (n) => issues.find((i) => i.number === n);
  assert.deepEqual(by(1).limit_retry, { at, attempt: 2, reason: 'reset' });
  assert.deepEqual(by(2).limit_retry, { at, attempt: 1, reason: 'backoff' });
  assert.equal(by(3).limit_retry, undefined);
  assert.equal(gh.calls.filter((p) => p.includes('/comments')).length, 2);
});

test('gather leaves the marker out when the comments cannot be read, and for an issue without one', () => {
  const failing = gather({ gh: world(new Error('HTTP 502')), repo: 'acme/app', config });
  assert.equal(failing.issues.find((i) => i.number === 1).limit_retry, null);
  const none = gather({ gh: world({}), repo: 'acme/app', config });
  assert.equal(none.issues.find((i) => i.number === 1).limit_retry, null);
});

test('Scenario: A slot frees with several issues waiting - the dispatch is staggered', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 10, 50].map(staggerSeconds), [0, 0, 60, 60, 60, 60, 33, 6]);
  assert.equal(staggerSeconds(undefined), 0);
  [2, 3, 7, 12, 40].forEach((n) => assert.ok(staggerSeconds(n) * (n - 1) <= 300));
});

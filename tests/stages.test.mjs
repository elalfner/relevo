import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, formatDuration, stagesOfIssue, summarizeStages } from '../scripts/lib/stages.mjs';

// An event as issues/{n}/events gives it. `id` only has to grow.
let counter = 1000;
const ev = (iso, event, label, reason) => ({
  id: (counter += 1), created_at: iso, event, ...(label ? { label: { name: `relevo:${label}` } } : {}), ...(reason ? { state_reason: reason } : {}),
});
const run = (events) => stagesOfIssue(events).map(({ stage, ms }) => [stage, ms]);
const S = 1000;
const M = 60 * S;

test('Scenario: Digest with stage times - the gate and the build of a real run (sandbox #45)', () => {
  const events = [
    ev('2026-10-28T15:50:26Z', 'labeled', 'ready'),
    ev('2026-10-28T15:50:40Z', 'labeled', 'building'),
    ev('2026-10-28T15:50:40Z', 'unlabeled', 'ready'),
    ev('2026-10-28T15:56:27Z', 'unlabeled', 'building'),
    ev('2026-10-28T15:56:28Z', 'labeled', 'built'),
  ];
  assert.deepEqual(run(events), [['gate', 14 * S], ['build', 5 * M + 48 * S]]);
});

test('the unlabeled event may come before or after the labeled one: only the labeled events set the time (sandbox #34)', () => {
  const events = [
    ev('2026-10-20T16:45:38Z', 'labeled', 'ready'),
    ev('2026-10-20T16:45:51Z', 'labeled', 'building'), // before the unlabeled of ready, which is a second later
    ev('2026-10-20T16:45:52Z', 'unlabeled', 'ready'),
    ev('2026-10-20T16:48:54Z', 'unlabeled', 'building'), // before the labeled of built
    ev('2026-10-20T16:48:55Z', 'labeled', 'built'),
    ev('2026-10-20T21:54:05Z', 'closed', null, 'not_planned'),
  ];
  assert.deepEqual(run(events), [['gate', 13 * S], ['build', 3 * M + 4 * S]]);
});

test('events are put in order of their id, not of the order they arrive in', () => {
  const a = ev('2026-10-28T10:00:00Z', 'labeled', 'ready');
  const b = ev('2026-10-28T10:00:10Z', 'labeled', 'building');
  const c = ev('2026-10-28T10:05:10Z', 'labeled', 'built');
  assert.deepEqual(run([c, a, b]), [['gate', 10 * S], ['build', 5 * M]]);
});

test('Scenario: A build rejected by QA - a run that ends in qa-failed is not a build', () => {
  const events = [
    ev('2026-10-21T16:24:11Z', 'labeled', 'queued'),
    ev('2026-10-21T16:24:25Z', 'labeled', 'building'),
    ev('2026-10-21T16:24:43Z', 'labeled', 'qa-failed'),
  ];
  assert.deepEqual(run(events), [['gate', 14 * S]], 'the gate was passed, the build never ended');
});

test('Scenario: Built again after a failure - only the run that reaches built counts, from the moment it began (sandbox #41)', () => {
  const events = [
    ev('2026-10-21T16:24:11Z', 'labeled', 'queued'),
    ev('2026-10-21T16:24:25Z', 'labeled', 'building'),
    ev('2026-10-21T16:24:43Z', 'labeled', 'qa-failed'),
    ev('2026-10-28T05:36:53Z', 'labeled', 'ready'),
    ev('2026-10-28T05:37:06Z', 'labeled', 'qa-failed'),
    ev('2026-10-28T05:39:15Z', 'labeled', 'ready'),
    ev('2026-10-28T05:39:29Z', 'labeled', 'building'),
    ev('2026-10-28T05:48:07Z', 'labeled', 'built'),
  ];
  assert.deepEqual(run(events), [['gate', 14 * S], ['gate', 14 * S], ['build', 8 * M + 38 * S]]);
});

test('Scenario: Time stopped on a side exit - the days in blocked or needs-spec are not part of the gate', () => {
  const events = [
    ev('2026-10-20T10:00:00Z', 'labeled', 'ready'),
    ev('2026-10-20T10:00:05Z', 'labeled', 'blocked'),
    ev('2026-10-23T10:00:00Z', 'labeled', 'ready'),
    ev('2026-10-23T10:00:20Z', 'labeled', 'building'),
  ];
  assert.deepEqual(run(events), [['gate', 20 * S]], 'only the time since it was ready again');
  const spec = [
    ev('2026-10-20T10:00:00Z', 'labeled', 'ready'),
    ev('2026-10-20T10:00:05Z', 'labeled', 'needs-spec'),
    ev('2026-10-24T10:00:00Z', 'labeled', 'building'),
  ];
  assert.deepEqual(run(spec), [], 'building after needs-spec is not the end of a gate');
});

test('a gate that goes through queued is one gate that began when the issue was ready', () => {
  const events = [
    ev('2026-10-28T10:00:00Z', 'labeled', 'ready'),
    ev('2026-10-28T10:00:03Z', 'labeled', 'queued'),
    ev('2026-10-28T10:30:00Z', 'labeled', 'building'),
  ];
  assert.deepEqual(run(events), [['gate', 30 * M]]);
});

test('Scenario: the whole path to a close as completed gives the five stages', () => {
  const events = [
    ev('2026-10-20T10:00:00Z', 'labeled', 'ready'),
    ev('2026-10-20T10:00:10Z', 'labeled', 'building'),
    ev('2026-10-20T10:06:10Z', 'labeled', 'built'),
    ev('2026-10-20T13:06:10Z', 'labeled', 'in-review'),
    ev('2026-10-21T13:06:10Z', 'labeled', 'pr-open'),
    ev('2026-10-21T13:06:10Z', 'labeled', 'urgent'), // an overlay is not a state
    ev('2026-10-23T13:06:10Z', 'unlabeled', 'pr-open'),
    ev('2026-10-23T13:06:11Z', 'closed', null, 'completed'),
  ];
  assert.deepEqual(run(events), [
    ['gate', 10 * S], ['build', 6 * M], ['wait', 3 * 3600 * S], ['device', 24 * 3600 * S], ['peer', 2 * 24 * 3600 * S + S],
  ]);
});

test('a stage that is skipped has no sample: a solo review goes from built straight to pr-open', () => {
  const events = [
    ev('2026-10-20T10:00:10Z', 'labeled', 'building'),
    ev('2026-10-20T10:06:10Z', 'labeled', 'built'),
    ev('2026-10-20T13:06:10Z', 'labeled', 'pr-open'),
  ];
  assert.deepEqual(run(events), [['build', 6 * M]]);
});

test('a close that is not a completion, a close from another state and a reopening end an attempt without a sample', () => {
  assert.deepEqual(run([ev('2026-10-20T10:00:00Z', 'labeled', 'pr-open'), ev('2026-10-21T10:00:00Z', 'closed', null, 'not_planned')]), []);
  assert.deepEqual(run([ev('2026-10-20T10:00:00Z', 'labeled', 'pr-open'), ev('2026-10-21T10:00:00Z', 'closed')]), [], 'no reason: not a completion');
  assert.deepEqual(run([ev('2026-10-20T10:00:00Z', 'labeled', 'built'), ev('2026-10-21T10:00:00Z', 'closed', null, 'completed')]), [], 'closed from built');
  const reopened = [
    ev('2026-10-20T10:00:00Z', 'labeled', 'pr-open'),
    ev('2026-10-20T11:00:00Z', 'reopened'),
    ev('2026-10-21T10:00:00Z', 'closed', null, 'completed'),
  ];
  assert.deepEqual(run(reopened), []);
});

test('a request for changes and the return to review make the next peer review start again', () => {
  const events = [
    ev('2026-10-20T10:00:00Z', 'labeled', 'pr-open'),
    ev('2026-10-20T12:00:00Z', 'labeled', 'changes-requested'),
    ev('2026-10-21T10:00:00Z', 'labeled', 'pr-open'),
    ev('2026-10-21T11:00:00Z', 'closed', null, 'completed'),
  ];
  assert.deepEqual(run(events), [['peer', 3600 * S]]);
});

test('labels that are not Relevo\'s are ignored, and a renamed label is read by its new name', () => {
  const events = [
    { id: 1, created_at: '2026-10-20T10:00:00Z', event: 'labeled', label: { name: 'bug' } },
    { id: 2, created_at: '2026-10-20T10:00:10Z', event: 'labeled', label: { name: 'go' } },
    { id: 3, created_at: '2026-10-20T10:00:20Z', event: 'labeled', label: { name: 'relevo:building' } },
  ];
  assert.deepEqual(stagesOfIssue(events, { ready: 'go', building: 'relevo:building' }).map((s) => [s.stage, s.ms]), [['gate', 10 * S]]);
  assert.deepEqual(stagesOfIssue([]), []);
});

test('each sample says when it ended, so that the digest can keep the week', () => {
  const events = [ev('2026-10-28T10:00:00Z', 'labeled', 'building'), ev('2026-10-28T10:05:00Z', 'labeled', 'built')];
  assert.equal(stagesOfIssue(events)[0].endedAt, Date.parse('2026-10-28T10:05:00Z'));
});

// ---------- the summary

test('Scenario: Digest with stage times - three builds of 4, 6 and 9 minutes give 6 minutes with the count 3', () => {
  const samples = [4, 6, 9].map((m) => ({ stage: 'build', ms: m * M }));
  assert.deepEqual(summarizeStages(samples), [{ stage: 'build', median: 6 * M, count: 3 }]);
});

test('the median of an even count is the mean of the two in the middle, and the order is fixed', () => {
  const samples = [
    { stage: 'peer', ms: 2 * M }, { stage: 'gate', ms: 10 * S }, { stage: 'gate', ms: 20 * S }, { stage: 'gate', ms: 40 * S }, { stage: 'gate', ms: 30 * S },
  ];
  assert.deepEqual(summarizeStages(samples), [{ stage: 'gate', median: 25 * S, count: 4 }, { stage: 'peer', median: 2 * M, count: 1 }]);
  assert.deepEqual(summarizeStages(samples).map((s) => s.stage), STAGES.filter((s) => s === 'gate' || s === 'peer'));
});

test('Scenario: A stage with no sample / No stage finished - a stage without samples is left out, and no samples give nothing', () => {
  const out = summarizeStages([{ stage: 'build', ms: M }, { stage: 'device', ms: M }]);
  assert.deepEqual(out.map((s) => s.stage), ['build', 'device'], 'the stages that were skipped are not there');
  assert.deepEqual(summarizeStages([]), []);
});

test('the duration is written in seconds, minutes, hours or days, rounded, with the thresholds of the design', () => {
  const f = formatDuration;
  assert.deepEqual([f(0), f(14 * S), f(99.4 * S), f(99.6 * S)], ['0 s', '14 s', '99 s', '2 min']);
  assert.deepEqual([f(6 * M), f(99 * M), f(100 * M)], ['6 min', '99 min', '2 h']);
  assert.deepEqual([f(3 * 3600 * S), f(47 * 3600 * S), f(48 * 3600 * S), f(2 * 24 * 3600 * S), f(36 * 24 * 3600 * S)], ['3 h', '47 h', '2 d', '2 d', '36 d']);
});

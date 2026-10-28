import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { STAGE_ISSUE_CAP, STREAM_PAGE_CAP, gatherStages, gatherStatus } from '../scripts/lib/status-data.mjs';

const root = new URL('../', import.meta.url).pathname;
const tpl = readFileSync(`${root}templates/relevo.yml`, 'utf8').replace('members: []', 'members: [ana]').replace('spec_writer: null', 'spec_writer: ana');
const { config } = loadConfig(tpl);
const NOW = new Date('2026-03-10T12:00:00Z'); // the week begins on 2026-03-03T12:00:00Z
const SEC = 1000;
const MIN = 60 * SEC;

let counter = 0;
const e = (n, iso, event, label, reason, over = {}) => ({
  id: (counter += 1), created_at: iso, event, issue: { number: n, ...(over.pull_request ? { pull_request: {} } : {}) },
  ...(label ? { label: { name: `relevo:${label}` } } : {}), ...(reason ? { state_reason: reason } : {}),
});

/** A fake client: `stream` is the list of pages of the repository events, `issues` the events of each issue. Counts the calls. */
function fakeGh({ stream = [[]], issues = {}, fail = null } = {}) {
  const calls = [];
  const gh = (args) => {
    const path = args[args.length - 1];
    calls.push(path);
    if (fail) throw new Error(fail);
    const page = path.match(/issues\/events\?per_page=100&page=(\d+)$/);
    if (page) return JSON.stringify(stream[Number(page[1]) - 1] ?? []);
    const one = path.match(/issues\/(\d+)\/events\?per_page=100$/);
    if (one) return JSON.stringify([issues[one[1]] ?? []]); // --paginate --slurp: one array per page
    throw new Error(`unexpected ${path}`);
  };
  return { gh, calls, streamCalls: () => calls.filter((c) => c.includes('issues/events')).length, issueCalls: () => calls.filter((c) => /issues\/\d+\/events/.test(c)) };
}
const logs = () => { const l = []; return { log: (m) => l.push(m), l }; };
const read = (gh, extra = {}) => gatherStages({ gh, repo: 'o/r', config, now: NOW, ...extra });

// Issue 7 is built this week. Issue 5 began its peer review nine days ago and finished it two days ago. Issue 4 is old.
const ISSUE_EVENTS = {
  7: [e(7, '2026-03-02T09:00:00Z', 'labeled', 'ready'), e(7, '2026-03-02T09:00:20Z', 'labeled', 'building'), e(7, '2026-03-09T10:00:00Z', 'labeled', 'ready'),
    e(7, '2026-03-09T10:00:14Z', 'labeled', 'building'), e(7, '2026-03-09T10:06:14Z', 'labeled', 'built')],
  5: [e(5, '2026-03-01T12:00:00Z', 'labeled', 'pr-open'), e(5, '2026-03-08T12:00:00Z', 'closed', null, 'completed')],
  4: [e(4, '2026-03-01T09:00:00Z', 'labeled', 'building'), e(4, '2026-03-01T09:05:00Z', 'labeled', 'built')],
};
const STREAM = [[
  e(7, '2026-03-09T10:06:14Z', 'labeled', 'built'),
  e(5, '2026-03-08T12:00:00Z', 'closed', null, 'completed'),
  e(9, '2026-03-08T11:00:00Z', 'labeled', 'built', null, { pull_request: true }), // a pull request is not an issue
  e(8, '2026-03-07T11:00:00Z', 'assigned'),
  e(6, '2026-03-06T11:00:00Z', 'labeled', 'ready'), // the first state cannot end a stage
  e(4, '2026-03-02T09:05:00Z', 'labeled', 'built'), // before the week
]];

test('Scenario: A stage that began before the week - it counts with its whole length, and a stage that ended before the week does not', () => {
  const { gh, issueCalls } = fakeGh({ stream: STREAM, issues: ISSUE_EVENTS });
  const samples = read(gh);
  assert.deepEqual(samples.filter((s) => s.stage === 'peer'), [{ stage: 'peer', ms: 7 * 24 * 3600 * SEC }], 'issue 5: nine days ago to two days ago');
  assert.deepEqual(samples.filter((s) => s.stage === 'build'), [{ stage: 'build', ms: 6 * MIN }]);
  assert.deepEqual(samples.filter((s) => s.stage === 'gate'), [{ stage: 'gate', ms: 14 * SEC }], 'the gate of the 2nd of March ended before the week');
  assert.equal(samples.length, 3);
  assert.deepEqual(issueCalls().map((c) => c.match(/issues\/(\d+)/)[1]).sort(), ['5', '7'], 'only the issues that ended a stage this week are read: not 4, 6, 8 or the pull request 9');
});

test('the stream is read newest first and stops at the first page that reaches back before the week', () => {
  const inWeek = Array.from({ length: 100 }, (_, i) => e(100 + i, '2026-03-09T10:00:00Z', 'assigned'));
  const reaches = [e(1, '2026-03-05T10:00:00Z', 'assigned'), ...Array.from({ length: 98 }, () => e(2, '2026-03-04T10:00:00Z', 'assigned')), e(3, '2026-03-01T10:00:00Z', 'assigned')];
  const f = fakeGh({ stream: [inWeek, reaches, inWeek] });
  read(f.gh);
  assert.equal(f.streamCalls(), 2, 'page 3 is never asked for');
  const short = fakeGh({ stream: [inWeek.slice(0, 40)] });
  read(short.gh);
  assert.equal(short.streamCalls(), 1, 'a page with fewer than 100 events is the last');
});

test('the stop looks at the oldest event of the page, not at the first one', () => {
  const page = [e(1, '2026-03-09T10:00:00Z', 'assigned'), ...Array.from({ length: 98 }, () => e(1, '2026-03-09T09:00:00Z', 'assigned')), e(1, '2026-03-02T10:00:00Z', 'assigned')];
  const f = fakeGh({ stream: [page, page] });
  read(f.gh);
  assert.equal(f.streamCalls(), 1, 'the first event is in the week but the page ends before it');
});

test('the cap of pages and the cap of issues bound the reading, and each says so', () => {
  const full = Array.from({ length: 100 }, (_, i) => e(1000 + i, '2026-03-09T10:00:00Z', 'assigned'));
  const l = logs();
  const f = fakeGh({ stream: Array.from({ length: STREAM_PAGE_CAP + 5 }, () => full) });
  read(f.gh, { log: l.log });
  assert.equal(f.streamCalls(), STREAM_PAGE_CAP);
  assert.match(l.l.join('\n'), new RegExp(`the cap of ${STREAM_PAGE_CAP} pages`));

  const many = Array.from({ length: STAGE_ISSUE_CAP + 7 }, (_, i) => e(500 + i, `2026-03-09T10:${String(i % 60).padStart(2, '0')}:00Z`, 'labeled', 'built'));
  const l2 = logs();
  const g = fakeGh({ stream: [many] });
  read(g.gh, { log: l2.log });
  assert.equal(g.issueCalls().length, STAGE_ISSUE_CAP);
  assert.match(l2.l.join('\n'), new RegExp(`${STAGE_ISSUE_CAP + 7} issues ended a stage, the ${STAGE_ISSUE_CAP} most recent`));
});

test('the number of calls is one page of the stream plus one read per issue that ended a stage', () => {
  const f = fakeGh({ stream: STREAM, issues: ISSUE_EVENTS });
  read(f.gh);
  assert.equal(f.calls.length, 1 + 2);
  const quiet = fakeGh({ stream: [[e(8, '2026-03-07T11:00:00Z', 'assigned')]] });
  assert.deepEqual(read(quiet.gh), []);
  assert.equal(quiet.calls.length, 1, 'no issue ended a stage, so no issue is read');
});

test('a renamed label is read by its new name', () => {
  const renamed = loadConfig(`${tpl}\nlabels:\n  built: done-by-the-agent\n`).config;
  const f = fakeGh({
    stream: [[{ id: 1, created_at: '2026-03-09T10:06:14Z', event: 'labeled', issue: { number: 3 }, label: { name: 'done-by-the-agent' } }]],
    issues: { 3: [e(3, '2026-03-09T10:00:00Z', 'labeled', 'building'), { id: 9999, created_at: '2026-03-09T10:03:00Z', event: 'labeled', label: { name: 'done-by-the-agent' } }] },
  });
  assert.deepEqual(gatherStages({ gh: f.gh, repo: 'o/r', config: renamed, now: NOW }), [{ stage: 'build', ms: 3 * MIN }]);
});

// ---------- failure, and reading nothing more

test('Scenario: The events cannot be read - one line on the log, no samples, and nothing thrown', () => {
  const l = logs();
  const f = fakeGh({ fail: 'HTTP 502: Bad Gateway\nsecond line' });
  assert.deepEqual(read(f.gh, { log: l.log }), []);
  assert.deepEqual(l.l, ['could not read the stage times: HTTP 502: Bad Gateway']);
  const second = logs();
  const g = fakeGh({ stream: STREAM, issues: { 7: ISSUE_EVENTS[7] } }); // issue 5 is missing: its read gives an empty list, not an error
  assert.equal(read(g.gh, { log: second.log }).length, 2);
});

test('Scenario: Reading the times - only GET requests, no write of any kind', () => {
  const f = fakeGh({ stream: STREAM, issues: ISSUE_EVENTS });
  const seen = [];
  const gh = (args) => { seen.push(args); return f.gh(args); };
  read(gh);
  seen.forEach((args) => {
    assert.equal(args[0], 'api');
    assert.ok(!args.some((a) => ['-X', '--method', '-f', '-F', '--field', '--raw-field', '--input'].includes(a)), `a write option in ${args.join(' ')}`);
  });
});

test('gatherStatus reads no events unless the digest asks for the stages', () => {
  const calls = [];
  const gh = (args) => {
    const path = args[args.length - 1];
    calls.push(path);
    if (path.includes('/issues/events')) return '[]';
    if (path.includes('issues?') || path.includes('/pulls?')) return '[]';
    throw new Error('HTTP 404');
  };
  const without = gatherStatus({ gh, repo: 'o/r', config, now: NOW });
  assert.equal('stages' in without, false);
  assert.equal(calls.some((c) => c.includes('/issues/events')), false, 'status reads nothing it does not show');
  const withStages = gatherStatus({ gh, repo: 'o/r', config, now: NOW, withStages: true });
  assert.deepEqual(withStages.stages, []);
  assert.equal(calls.some((c) => c.includes('/issues/events')), true);
});

test('the digest script shows the stages of a state file, and posts nothing for stage times alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'digest-stages-'));
  writeFileSync(join(dir, 'relevo.yml'), tpl);
  const run = (state) => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
    return spawnSync(process.execPath, [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-10T12:00:00Z'], { encoding: 'utf8' });
  };
  const built = { number: 1, title: 'Issue 1', labels: ['relevo:built'], assignees: ['ana'], milestone: 1 };
  const stages = [{ stage: 'build', ms: 4 * MIN }, { stage: 'build', ms: 6 * MIN }, { stage: 'build', ms: 9 * MIN }, { stage: 'gate', ms: 14 * SEC }];
  const waiting = run({ issues: [built], prs: [], milestones: [], stages });
  assert.equal(waiting.status, 0, waiting.stderr);
  assert.match(waiting.stdout, /@ana: #1 \(built\)[\s\S]*Stages, last 7 days \(median\): gate 14 s \(1\), build 6 min \(3\)\./);
  assert.equal(run({ issues: [], prs: [], milestones: [], stages }).stdout, '');
});

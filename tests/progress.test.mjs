import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMessage } from '../scripts/lib/messages.mjs';
import {
  CLOSED_MARKER, PROGRESS_MARKER, closeProgress, currentPhase, deducePhase, isClosed, minutesSince, progressClient, readAnnouncement,
  readTreeFacts, renderClosed, renderProgress, shouldWrite, watch, writeProgress,
} from '../scripts/lib/progress.mjs';
import { countTasks } from '../scripts/lib/tasks-file.mjs';

const TASKS = '# Tasks\n\n## 1. A\n\n- [x] 1.1 one\n- [ ] 1.2 two\n  - [X] 1.3 three\n\n## 2. Review corrections [Iteration 1]\n\n- [ ] 2.1 fix\n';

test('countTasks counts every checkbox, the corrections included, and an empty or missing file has none', () => {
  assert.deepEqual(countTasks(TASKS), { done: 2, total: 4 });
  assert.deepEqual(countTasks('# Tasks\n\nno boxes here\n'), { done: 0, total: 0 });
  assert.deepEqual(countTasks('- [x] a\n- [x] b\n'), { done: 2, total: 2 });
  assert.deepEqual(countTasks(undefined), { done: 0, total: 0 });
});

// ---------- the text

test('the progress text shows the phase, the attempt, the tasks and the minutes, in English and Spanish', () => {
  const text = renderProgress({ phase: 'qa', attempt: 2, of: 3, tasks: { done: 6, total: 9 }, minutes: 7 });
  assert.match(text, /^Relevo build in progress: QA \(attempt 2 of 3\)\nTasks: 6 of 9\nRunning for 7 min/);
  assert.ok(text.endsWith(PROGRESS_MARKER));
  const es = renderProgress({ phase: 'development', tasks: { done: 0, total: 5 }, minutes: 0, language: 'es' });
  assert.match(es, /^Construcción de Relevo en curso: desarrollo\nTareas: 0 de 5\nLleva 0 min/);
  assert.doesNotMatch(es, /intento/, 'no attempt, no attempt text');
});

test('without a task file the tasks line is left out, and the time is in whole minutes', () => {
  const text = renderProgress({ phase: 'planning', tasks: null, minutes: 3 });
  assert.doesNotMatch(text, /Tasks:/);
  assert.equal(minutesSince(0, 59 * 1000), 0);
  assert.equal(minutesSince(0, 61 * 1000), 1);
  assert.equal(minutesSince(10, 5), 0, 'a clock that went back never gives a negative time');
});

test('Scenario: Run ends with a result / without an outcome - the closing line is one line plus the markers', () => {
  const ok = renderClosed({ minutes: 12, runUrl: 'https://example.invalid/run/1' });
  assert.match(ok, /^The Relevo build ended after 12 min\. The result is in the latest comment of this issue\.\nRun: https:\/\/example\.invalid\/run\/1\n\n/);
  assert.ok(ok.endsWith(`${PROGRESS_MARKER}\n${CLOSED_MARKER}`));
  assert.ok(isClosed(ok));
  const none = renderClosed({ minutes: 4, runUrl: null, outcome: 'none' });
  assert.match(none, /ended without an outcome after 4 min\. The reason is in the latest comment/);
  assert.doesNotMatch(none, /Run:/);
  assert.match(renderClosed({ outcome: 'none', language: 'es' }), /terminó sin resultado\. El motivo está en el último comentario/);
  assert.equal(isClosed(renderProgress({ phase: 'qa', minutes: 1 })), false);
  assert.equal(renderMessage('run_progress_closed', {}, 'en').split('\n').length, 1);
});

test('shouldWrite is true only when the text changed', () => {
  assert.equal(shouldWrite('a', 'a'), false);
  assert.equal(shouldWrite('a', 'b'), true);
  assert.equal(shouldWrite(undefined, 'b'), true);
});

// ---------- the phase

test('Scenario: No announcement - the phase is deduced from what the working tree holds', () => {
  assert.equal(deducePhase({ hasChange: false, tasks: null, committed: false }), 'planning');
  assert.equal(deducePhase({ hasChange: true, tasks: null, committed: false }), 'specification');
  assert.equal(deducePhase({ hasChange: true, tasks: { done: 0, total: 0 }, committed: false }), 'specification');
  assert.equal(deducePhase({ hasChange: true, tasks: { done: 2, total: 5 }, committed: false }), 'development');
  assert.equal(deducePhase({ hasChange: true, tasks: { done: 5, total: 5 }, committed: false }), 'qa');
  assert.equal(deducePhase({ hasChange: true, tasks: { done: 5, total: 5 }, committed: true }), 'delivery');
});

test('the tree facts are read from the change folder and from git, and a failure of either reads as nothing', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'progress-tree-'));
  // The checkout is on `feature/7-x` unless a test says otherwise; `ahead` is how many commits it holds above the base.
  const gitOf = (ahead, current = 'feature/7-x') => (args) => {
    if (args[0] === 'rev-parse') return `${current}\n`;
    assert.deepEqual(args, ['rev-list', '--count', 'origin/dev..HEAD']);
    return `${ahead}\n`;
  };
  const facts = (over = {}) => readTreeFacts({ cwd, changeId: 'add-x', base: 'dev', branch: 'feature/7-x', git: gitOf(0), ...over });
  assert.deepEqual(facts(), { hasChange: false, tasks: null, committed: false });
  mkdirSync(join(cwd, 'openspec', 'changes', 'add-x'), { recursive: true });
  assert.deepEqual(facts(), { hasChange: true, tasks: null, committed: false });
  writeFileSync(join(cwd, 'openspec', 'changes', 'add-x', 'tasks.md'), TASKS);
  assert.deepEqual(facts({ git: gitOf(3) }).tasks, { done: 2, total: 4 });
  assert.equal(facts({ git: gitOf(3) }).committed, true);
  assert.equal(facts({ git: () => { throw new Error('no git'); } }).committed, false);
  assert.deepEqual(readTreeFacts({ cwd, changeId: null, base: null, git: gitOf(0) }), { hasChange: false, tasks: null, committed: false });
});

test('a default branch that is ahead of the base is not a delivery: only commits on the branch of the issue count', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'progress-ahead-'));
  const ahead = (current) => (args) => (args[0] === 'rev-parse' ? current : '4');
  // The job starts on main, four commits above dev, before `go` has created the branch.
  assert.equal(readTreeFacts({ cwd, changeId: 'add-x', base: 'dev', branch: 'feature/7-x', git: ahead('main') }).committed, false);
  assert.equal(deducePhase(readTreeFacts({ cwd, changeId: 'add-x', base: 'dev', branch: 'feature/7-x', git: ahead('main') })), 'planning');
  assert.equal(readTreeFacts({ cwd, changeId: 'add-x', base: 'dev', branch: 'feature/7-x', git: ahead('feature/7-x') }).committed, true);
  assert.equal(readTreeFacts({ cwd, changeId: 'add-x', base: 'dev', branch: null, git: ahead('feature/7-x') }).committed, false, 'without the branch of the decision nothing is guessed');
});

test('Scenario: QA starts / Retry after a rejection - the announced phase and attempt win over the tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'progress-phase-'));
  assert.equal(readAnnouncement(dir), null, 'nothing announced');
  assert.equal(readAnnouncement(null), null);
  writeFileSync(join(dir, 'phase.json'), JSON.stringify({ phase: 'qa', attempt: 2, of: 3 }));
  assert.deepEqual(readAnnouncement(dir), { phase: 'qa', attempt: 2, of: 3 });
  const facts = { hasChange: true, tasks: { done: 1, total: 5 }, committed: false };
  assert.deepEqual(currentPhase({ announced: readAnnouncement(dir), facts }), { phase: 'qa', attempt: 2, of: 3 });
  assert.deepEqual(currentPhase({ announced: null, facts }), { phase: 'development', attempt: null, of: null });
  writeFileSync(join(dir, 'phase.json'), JSON.stringify({ phase: 'sleeping', attempt: 'x' }));
  assert.equal(readAnnouncement(dir), null, 'an unknown phase is ignored');
  writeFileSync(join(dir, 'phase.json'), '{not json');
  assert.equal(readAnnouncement(dir), null, 'a garbled file is ignored');
  writeFileSync(join(dir, 'phase.json'), JSON.stringify({ phase: 'development', attempt: -1, of: 1.5 }));
  assert.deepEqual(readAnnouncement(dir), { phase: 'development', attempt: null, of: null });
});

// ---------- the comment

/** An in-memory issue: the fake `gh` and the comments it holds. */
function fakeIssue(initial = []) {
  const comments = initial.map((c, i) => ({ id: 100 + i, user: { type: 'Bot' }, ...c }));
  const calls = [];
  let nextId = 500;
  const gh = (args) => {
    calls.push(args);
    const path = args.find((a) => a.startsWith('repos/'));
    const body = (args.find((a) => a.startsWith('body=')) ?? '').slice(5);
    if (args.includes('--paginate')) return JSON.stringify([comments]);
    if (args.includes('-X')) {
      comments.find((c) => `repos/o/r/issues/comments/${c.id}` === path).body = body;
      return '{}';
    }
    if (body) {
      const c = { id: nextId += 1, user: { type: 'Bot' }, body };
      comments.push(c);
      return JSON.stringify({ id: c.id });
    }
    return JSON.stringify(comments.find((c) => `repos/o/r/issues/comments/${c.id}` === path));
  };
  const writes = () => calls.filter((a) => a.includes('-X') || a.some((x) => String(x).startsWith('body=')));
  return { gh, comments, calls, writes };
}
const clientOf = (issue) => progressClient({ gh: issue.gh, repo: 'o/r', issue: 7 });

test('Scenario: Marker already present - the open comment of the bot is found and edited, never a second created', () => {
  const issue = fakeIssue([{ body: `old\n\n${PROGRESS_MARKER}` }]);
  const state = {};
  assert.equal(writeProgress({ client: clientOf(issue), state, text: `new\n\n${PROGRESS_MARKER}` }), 'written');
  assert.equal(issue.comments.length, 1);
  assert.match(issue.comments[0].body, /^new/);
  assert.equal(state.commentId, 100);
});

test('a comment with the marker typed by a person, or a closed one of an earlier run, is not taken over', () => {
  const person = fakeIssue([{ user: { type: 'User' }, body: `mine ${PROGRESS_MARKER}` }, { body: `old run\n${PROGRESS_MARKER}\n${CLOSED_MARKER}` }]);
  assert.equal(clientOf(person).find(), null);
  const state = {};
  writeProgress({ client: clientOf(person), state, text: `fresh\n\n${PROGRESS_MARKER}` });
  assert.equal(person.comments.length, 3, 'a new comment is created for this run');
  assert.match(person.comments[0].body, /^mine/);
  assert.match(person.comments[1].body, /^old run/);
});

test('Scenario: First report - the first write creates the comment, the next ones edit it, and the same text writes nothing', () => {
  const issue = fakeIssue();
  const state = {};
  const client = clientOf(issue);
  assert.equal(writeProgress({ client, state, text: `a ${PROGRESS_MARKER}` }), 'written');
  assert.equal(issue.comments.length, 1);
  assert.equal(writeProgress({ client, state, text: `a ${PROGRESS_MARKER}` }), 'same');
  assert.equal(writeProgress({ client, state, text: `b ${PROGRESS_MARKER}` }), 'written');
  assert.equal(issue.comments.length, 1, 'still one comment');
  assert.equal(issue.comments[0].body, `b ${PROGRESS_MARKER}`);
  const lists = issue.calls.filter((a) => a.includes('--paginate')).length;
  assert.equal(lists, 1, 'the comments are listed once: the id is kept afterwards');
});

test('Scenario: A check runs after the closing / Closing while a check is running - a closed comment is never written again', () => {
  const issue = fakeIssue();
  const state = {};
  const client = clientOf(issue);
  writeProgress({ client, state, text: `a ${PROGRESS_MARKER}` });
  // The closing happens in another process, which finds the comment through its own state.
  const closer = { commentId: state.commentId };
  assert.equal(closeProgress({ client, state: closer, text: renderClosed({ minutes: 1 }) }), 'done');
  const before = issue.writes().length;
  assert.equal(writeProgress({ client, state, text: `late ${PROGRESS_MARKER}` }), 'closed');
  assert.equal(issue.writes().length, before, 'no write after the closing');
  assert.ok(isClosed(issue.comments[0].body));
  assert.equal(closeProgress({ client, state: { commentId: state.commentId }, text: 'again' }), 'closed', 'closing twice changes nothing');
});

test('closing finds the open comment when the state was lost, and does nothing when there is none', () => {
  const none = fakeIssue();
  assert.equal(closeProgress({ client: clientOf(none), state: {}, text: renderClosed({}) }), 'none');
  assert.equal(none.comments.length, 0, 'nothing is created just to be closed');
  const found = fakeIssue([{ body: `x ${PROGRESS_MARKER}` }]);
  assert.equal(closeProgress({ client: clientOf(found), state: {}, text: renderClosed({}) }), 'done');
  assert.ok(isClosed(found.comments[0].body));
});

// ---------- the loop

/** A clock that moves only when the loop sleeps. */
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, sleep: async (ms) => { t += ms; }, set: (v) => { t = v; } };
}

function harness(over = {}) {
  const issue = fakeIssue();
  const c = clock();
  const facts = { hasChange: true, tasks: { done: 1, total: 4 }, committed: false };
  const h = {
    issue, c, facts, announced: null, building: true, stopAt: Infinity, rounds: 0, logs: [],
    run: (extra = {}) => watch({
      client: clientOf(issue), state: {}, language: 'en', maxMs: 60 * 60 * 1000,
      readFacts: () => { h.rounds += 1; return h.facts; },
      readAnnounced: () => h.announced,
      stopRequested: () => h.rounds >= h.stopAt,
      stillBuilding: () => h.building,
      now: c.now, sleep: c.sleep, log: (m) => h.logs.push(m), ...extra,
    }),
    ...over,
  };
  return h;
}

test('Scenario: Nothing changed - checks every 30 seconds write once a minute at most, and the minutes of a silent run keep growing', async () => {
  const h = harness();
  h.stopAt = 8; // 8 rounds = 3.5 minutes
  assert.equal(await h.run(), 'stop');
  assert.equal(h.issue.comments.length, 1);
  // 30 s per round: minute 0 (rounds 0,1), 1 (2,3), 2 (4,5), 3 (6,7) -> four different texts, four writes.
  assert.equal(h.issue.writes().length, 4);
  assert.match(h.issue.comments[0].body, /Tasks: 1 of 4\nRunning for 3 min/);
  assert.match(h.issue.comments[0].body, /development/);
});

test('Scenario: The agent is silent - the time grows while the tasks and the phase stay', async () => {
  const h = harness();
  h.stopAt = 6;
  await h.run();
  const body = h.issue.comments[0].body;
  assert.match(body, /Running for 2 min/);
  assert.match(body, /Tasks: 1 of 4/);
  assert.match(body, /: development/);
});

test('Scenario: A step finishes - a new phase or task count edits the same comment within one round', async () => {
  const h = harness();
  let n = 0;
  const run = h.run({
    readFacts: () => { n += 1; if (n === 3) h.facts = { ...h.facts, tasks: { done: 4, total: 4 } }; return h.facts; },
    stopRequested: () => n >= 4,
  });
  await run;
  assert.equal(h.issue.comments.length, 1);
  assert.match(h.issue.comments[0].body, /Tasks: 4 of 4/);
  assert.match(h.issue.comments[0].body, /: QA/, 'all tasks checked and nothing announced reads as QA');
  h.announced = { phase: 'development', attempt: 2, of: 3 };
  const again = harness();
  again.announced = { phase: 'development', attempt: 2, of: 3 };
  again.stopAt = 1;
  await again.run();
  assert.match(again.issue.comments[0].body, /development \(attempt 2 of 3\)/);
});

test('Scenario: The check stops with the job - it ends on the stop file, on the issue leaving building, on the limit and on a closed comment', async () => {
  const stop = harness();
  stop.stopAt = 2;
  assert.equal(await stop.run(), 'stop');

  const notBuilding = harness();
  let checks = 0;
  assert.equal(await notBuilding.run({ stillBuilding: () => { checks += 1; return checks < 1; } }), 'not-building');
  assert.equal(notBuilding.rounds, 5, 'the labels are read every fifth round, not every one');

  const limit = harness();
  assert.equal(await limit.run({ maxMs: 3 * 60 * 1000 }), 'limit');
  assert.ok(limit.rounds <= 7, 'the limit bounds the loop');

  const closed = harness();
  closed.stopAt = 20;
  let n = 0;
  const res = await closed.run({
    readFacts: () => {
      n += 1;
      if (n === 3) closeProgress({ client: clientOf(closed.issue), state: {}, text: renderClosed({ minutes: 1 }) });
      return closed.facts;
    },
  });
  assert.equal(res, 'closed');
  assert.ok(isClosed(closed.issue.comments[0].body));
  assert.doesNotMatch(closed.issue.comments[0].body, /Running for/, 'the closing line was not overwritten');
});

test('Scenario: GitHub refuses the edit - a failing round is logged and the loop goes on', async () => {
  const h = harness();
  let fail = true;
  const real = clientOf(h.issue);
  const client = { ...real, create: (b) => { if (fail) { fail = false; throw new Error('HTTP 403: refused\nsecond line'); } return real.create(b); } };
  h.stopAt = 3;
  assert.equal(await h.run({ client }), 'stop');
  assert.deepEqual(h.logs, ['progress round failed: HTTP 403: refused']);
  assert.equal(h.issue.comments.length, 1, 'the next round created the comment');
});

test('a label read that fails is taken as still building', async () => {
  const h = harness();
  h.stopAt = 7;
  const res = await h.run({ stillBuilding: () => { throw new Error('HTTP 500'); } });
  assert.equal(res, 'stop');
  assert.match(h.logs[0], /progress round failed: HTTP 500/);
});

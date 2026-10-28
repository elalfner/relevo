// The progress comment of a cloud build. Implements "A cloud build shows its progress in one comment", "The phase of the
// build is announced and checked", "The workflow signals that the run is alive", "The progress comment is closed when the
// run ends", "A closed progress comment is not edited again" and "Reporting progress never fails the run" of the go
// specification.
//
// Everything that touches the outside is injected (the `gh` client, the clock, the sleep, the files that are read), so
// the loop is tested without a network or a real clock.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMessage } from './messages.mjs';
import { countTasks } from './tasks-file.mjs';

/** Hidden markers: the first finds the comment, the second says that it is closed and must not be written again. */
export const PROGRESS_MARKER = '<!-- relevo:progress -->';
export const CLOSED_MARKER = '<!-- relevo:progress:closed -->';

export const PHASES = ['planning', 'specification', 'development', 'qa', 'delivery'];

/** A round every 30 seconds; the labels of the issue are read every fifth round. */
export const INTERVAL_MS = 30 * 1000;
export const LABEL_CHECK_EVERY = 5;

const MINUTE = 60 * 1000;

/**
 * The phase that the working tree shows when nobody announced one. facts: { hasChange, tasks: {done,total}|null, committed }.
 * It cannot tell QA from a new attempt of development; the announcement exists for that, this only keeps the comment alive.
 */
export function deducePhase(facts) {
  if (facts.committed) return 'delivery';
  if (!facts.hasChange) return 'planning';
  if (!facts.tasks || facts.tasks.total === 0) return 'specification';
  return facts.tasks.done < facts.tasks.total ? 'development' : 'qa';
}

/** What the working tree holds for the change, read with the injected `git(args) -> stdout`. `branch` is the branch of the issue. Never throws. */
export function readTreeFacts({ cwd, changeId, base, branch = null, git }) {
  const dir = changeId ? join(cwd, 'openspec', 'changes', changeId) : null;
  const hasChange = Boolean(dir) && existsSync(dir);
  let tasks = null;
  try {
    if (hasChange && existsSync(join(dir, 'tasks.md'))) tasks = countTasks(readFileSync(join(dir, 'tasks.md'), 'utf8'));
  } catch {
    tasks = null;
  }
  // Delivered means a commit on the branch of the issue. The job starts on the default branch, which may be ahead of the
  // base branch, so commits above the base only count once the checkout is on the branch that `go` creates.
  let committed = false;
  try {
    const onBranch = Boolean(branch) && String(git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim() === branch;
    committed = onBranch && Boolean(base) && Number(String(git(['rev-list', '--count', `origin/${base}..HEAD`])).trim()) > 0;
  } catch {
    committed = false;
  }
  return { hasChange, tasks, committed };
}

/** The phase that `go` announced (`phase.json` under the progress folder), or null when there is none or it is not valid. */
export function readAnnouncement(dir) {
  try {
    if (!dir) return null;
    const file = join(dir, 'phase.json');
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!PHASES.includes(data.phase)) return null;
    const whole = (v) => (Number.isInteger(v) && v > 0 ? v : null);
    return { phase: data.phase, attempt: whole(data.attempt), of: whole(data.of) };
  } catch {
    return null;
  }
}

/** The phase to show: the announced one when there is one, else the one the tree shows. */
export function currentPhase({ announced, facts }) {
  return announced ?? { phase: deducePhase(facts), attempt: null, of: null };
}

/** The text of the progress comment, with its marker. The time is in whole minutes, so the text changes about once a minute. */
export function renderProgress({ phase, attempt = null, of = null, tasks = null, minutes, language = 'en' }) {
  const text = renderMessage('run_progress', {
    phase, attempt, of, minutes,
    tasks_done: tasks ? tasks.done : null, tasks_total: tasks ? tasks.total : null,
  }, language);
  return `${text}\n\n${PROGRESS_MARKER}`;
}

/** The single line that replaces the progress comment when the run ends. `outcome` is `none` for a run that left none. */
export function renderClosed({ minutes = null, runUrl = null, outcome = 'result', language = 'en' }) {
  const text = renderMessage('run_progress_closed', { minutes, run_url: runUrl, outcome }, language);
  return `${text}\n\n${PROGRESS_MARKER}\n${CLOSED_MARKER}`;
}

export const isClosed = (body) => String(body ?? '').includes(CLOSED_MARKER);

/** Whether a round has something to write: the text it would show is not the text already shown. */
export const shouldWrite = (previous, next) => previous !== next;

export const minutesSince = (startedAt, now) => Math.max(0, Math.floor((now - startedAt) / MINUTE));

const paged = (gh, path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

/**
 * The comments of the progress of one issue. Only a comment of the Actions bot with the marker is ever read or edited,
 * so a person who types the marker does not take it over (and the token could not edit their comment anyway).
 */
export function progressClient({ gh, repo, issue }) {
  const list = `repos/${repo}/issues/${issue}/comments`;
  return {
    /** The newest open progress comment, as { id, body }, or null. A closed one belongs to an earlier run. */
    find() {
      const open = paged(gh, `${list}?per_page=100`)
        .filter((c) => c.user?.type === 'Bot' && String(c.body ?? '').includes(PROGRESS_MARKER) && !isClosed(c.body));
      const last = open[open.length - 1];
      return last ? { id: last.id, body: last.body } : null;
    },
    get: (id) => JSON.parse(gh(['api', `repos/${repo}/issues/comments/${id}`])).body ?? '',
    create: (body) => JSON.parse(gh(['api', list, '-f', `body=${body}`])).id,
    edit: (id, body) => { gh(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${id}`, '-f', `body=${body}`]); },
  };
}

/**
 * Writes the text of a round: `state` is { commentId, lastText }. Returns `same` (nothing to write), `written` or `closed`
 * (the comment was closed, so nothing is written). The comment is read before each edit, so a closing that came between
 * two rounds is never undone.
 */
export function writeProgress({ client, state, text }) {
  if (!shouldWrite(state.lastText, text)) return 'same';
  if (state.commentId == null) {
    const found = client.find();
    if (found) state.commentId = found.id;
  }
  if (state.commentId == null) {
    state.commentId = client.create(text);
  } else {
    if (isClosed(client.get(state.commentId))) return 'closed';
    client.edit(state.commentId, text);
  }
  state.lastText = text;
  return 'written';
}

/** Replaces the progress comment by the closing line. Returns `none` (there is no comment), `closed` (it already was) or `done`. */
export function closeProgress({ client, state, text }) {
  const id = state.commentId ?? client.find()?.id ?? null;
  if (id == null) return 'none';
  if (isClosed(client.get(id))) return 'closed';
  client.edit(id, text);
  state.commentId = id;
  state.lastText = text;
  return 'done';
}

/**
 * The loop of the workflow. Ends by itself when the stop file exists, when the issue is no longer building (looked at
 * every fifth round), when the comment turns out to be closed, or when `maxMs` passed: the last is the net for a runner
 * that persists and a job that is cancelled. A round that fails is logged and the loop goes on.
 * Returns why it ended: `stop`, `not-building`, `closed` or `limit`.
 */
export async function watch({
  client, state, language = 'en', readFacts, readAnnounced, stopRequested, stillBuilding,
  now = Date.now, sleep, intervalMs = INTERVAL_MS, maxMs, save = () => {}, log = () => {},
}) {
  if (state.startedAt == null) state.startedAt = now();
  for (let round = 0; ; round += 1) {
    if (stopRequested()) return 'stop';
    if (now() - state.startedAt >= maxMs) return 'limit';
    try {
      if (round > 0 && round % LABEL_CHECK_EVERY === 0 && !stillBuilding()) return 'not-building';
      const facts = readFacts();
      const { phase, attempt, of } = currentPhase({ announced: readAnnounced(), facts });
      const text = renderProgress({ phase, attempt, of, tasks: facts.tasks, minutes: minutesSince(state.startedAt, now()), language });
      const result = writeProgress({ client, state, text });
      save(state);
      if (result === 'closed') return 'closed';
    } catch (err) {
      log(`progress round failed: ${String(err?.message ?? err).split('\n')[0]}`);
    }
    await sleep(intervalMs);
  }
}

// `go-local.mjs status <issue>`: what the build of an issue on this machine is doing, or how it ended. It only reads.
// Implements "The progress of a local build can be read while it runs" of the execution-modes specification.

import { renderMessage } from './messages.mjs';
import { usageLine } from './run-usage.mjs';
import { stateDir, worktreePath } from './worktree-path.mjs';

/** The lines that tell a snapshot: the progress line, when it last changed and, once it ended, how it ended and what it used. */
export function statusLines(snapshot, { language = 'en', now = Date.now() } = {}) {
  const ended = snapshot.ended;
  const text = renderMessage('local_status', {
    phase: snapshot.phase.phase, attempt: snapshot.phase.attempt, of: snapshot.phase.of, minutes: snapshot.minutes,
    group: snapshot.group?.group, groups: snapshot.group?.of,
    tasks_done: snapshot.tasks?.done, tasks_total: snapshot.tasks?.total,
    last_change_minutes: snapshot.lastChange === null ? null : Math.max(0, Math.floor((now - snapshot.lastChange) / 60000)),
    ended: ended ? 'yes' : null, status: ended?.status, outcome: snapshot.outcome,
    usage_line: snapshot.totals ? usageLine({ turns: snapshot.totals.turns ?? null, cost: snapshot.totals.cost ?? null, tokens: snapshot.totals.tokens ?? null }, { language }) : null,
  }, language);
  return text.split('\n');
}

/** { status, lines } for the build of `issue` on this machine. `state.snapshot` and `capture` are injected. */
export function localStatus({ issue, config, capture, state, exists = () => false, now = Date.now }) {
  const language = config.language ?? 'en';
  if (!/^\d+$/.test(String(issue ?? ''))) return { status: 2, lines: ['give the issue number: go-local.mjs status <issue>'] };
  let repoRoot;
  try {
    repoRoot = capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
  } catch {
    return { status: 2, lines: ['not inside a git repository'] };
  }
  const dir = stateDir(repoRoot, issue);
  const worktree = worktreePath(repoRoot, issue);
  const snapshot = exists(dir) ? state.snapshot({ dir, worktree, changeId: null, now: now() }) : null;
  if (!snapshot) return { status: 0, lines: [renderMessage('local_no_build', { issue }, language)] };
  return { status: 0, lines: statusLines(snapshot, { language, now: now() }) };
}

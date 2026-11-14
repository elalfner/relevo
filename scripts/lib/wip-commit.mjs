// The commit that `go` makes of work that it could not finish, so the branch keeps it. There are two: the work that QA
// rejected, and the work of a run that stopped at a limit or was cut. The prefix is the one thing `fix` and the failure
// comment rely on to tell that work from a commit that was approved.

export const WIP_PREFIX = 'wip: rejected by QA';
export const LIMIT_WIP_PREFIX = 'wip: stopped by limit';

const PREFIXES = [WIP_PREFIX, LIMIT_WIP_PREFIX];

/** The subject of the work-in-progress commit of an issue: after a QA rejection (the default) or after a limit (`'limit'`). */
export function wipSubject(issue, kind = 'qa') {
  return `${kind === 'limit' ? LIMIT_WIP_PREFIX : WIP_PREFIX} (#${issue})`;
}

export const CHECKPOINT_PREFIX = 'wip: checkpoint';

/** The subject of the checkpoint that `go` makes after group `k` of `n` of the tasks of an issue. */
export function checkpointSubject(issue, k, n) {
  return `${CHECKPOINT_PREFIX} ${k}/${n} (#${issue})`;
}

/** Whether a commit subject is a checkpoint; the issue is checked too when given. */
export function isCheckpoint(subject, issue = null) {
  const s = String(subject ?? '').trim();
  return new RegExp(`^${CHECKPOINT_PREFIX} \\d+/\\d+ \\(#${issue === null ? '\\d+' : issue}\\)$`).test(s);
}

/** Whether a commit subject is one of those commits; the issue is checked too when given. */
export function isWipCommit(subject, issue = null) {
  const s = String(subject ?? '').trim();
  if (isCheckpoint(s, issue)) return true;
  if (issue === null) return PREFIXES.some((p) => s === p || s.startsWith(`${p} (#`));
  return s === wipSubject(issue) || s === wipSubject(issue, 'limit');
}

/** Whether a commit is one that Relevo makes before the end of a build: the specification, a checkpoint, the work kept at a limit. */
export function isOwnCommit(subject, issue) {
  const s = String(subject ?? '').trim();
  return s === `docs: specification for #${issue}` || isCheckpoint(s, issue) || s === wipSubject(issue, 'limit');
}

/** The message with the hash of the issue text as a trailer, which a later run compares before it resumes. */
export function withIssueHash(message, hash) {
  return /^[0-9a-f]{64}$/.test(String(hash ?? '')) ? `${message}\n\nIssue-hash: ${hash}` : message;
}

/** The hash a commit message carries as its trailer, or null. */
export function issueHashOf(body) {
  return (/^Issue-hash: ([0-9a-f]{64})\s*$/m.exec(String(body ?? '')) ?? [])[1] ?? null;
}

const TASK_ID = /^\d{1,3}\.\d{1,3}$/;

/** The task numbers that a checkpoint may name: only `1.1` like ids, so the trailer cannot carry free text. */
export function cleanTaskIds(tasks) {
  const list = Array.isArray(tasks) ? tasks : String(tasks ?? '').split(',');
  return [...new Set(list.map((t) => String(t).trim()).filter((t) => TASK_ID.test(t)))];
}

/** The message with the tasks of the group as a trailer (`Relevo-Tasks: 1.1, 1.2`), which names the checkpoint whatever its number. */
export function withTasks(message, tasks) {
  const ids = cleanTaskIds(tasks);
  if (ids.length === 0) return message;
  return `${message}${/\n\n[^\n]*: [^\n]*$/.test(message) ? '\n' : '\n\n'}Relevo-Tasks: ${ids.join(', ')}`;
}

/** The task numbers a commit message names in its trailer, or []. */
export function tasksOf(body) {
  const m = /^Relevo-Tasks: (.*)$/m.exec(String(body ?? ''));
  return m ? cleanTaskIds(m[1]) : [];
}

// The reasons of the failure path for which the developer's work exists and is worth keeping.
export const KEEP_REASONS = ['QA rejected after the retries', 'tasks left unfinished', 'run limit reached'];

/** Whether the work is kept for a failure reason. */
export function keepsWork(reason) {
  return KEEP_REASONS.includes(String(reason ?? '').trim());
}

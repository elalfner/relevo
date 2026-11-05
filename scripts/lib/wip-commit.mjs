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

/** Whether a commit subject is one of those commits; the issue is checked too when given. */
export function isWipCommit(subject, issue = null) {
  const s = String(subject ?? '').trim();
  if (issue === null) return PREFIXES.some((p) => s === p || s.startsWith(`${p} (#`));
  return s === wipSubject(issue) || s === wipSubject(issue, 'limit');
}

// The reasons of the failure path for which the developer's work exists and is worth keeping.
export const KEEP_REASONS = ['QA rejected after the retries', 'tasks left unfinished', 'run limit reached'];

/** Whether the work is kept for a failure reason. */
export function keepsWork(reason) {
  return KEEP_REASONS.includes(String(reason ?? '').trim());
}

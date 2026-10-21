// The commit that `go` makes of work that QA rejected, so the branch keeps it. The prefix is the one thing `fix` and
// the failure comment rely on to tell that work from a commit that was approved.

export const WIP_PREFIX = 'wip: rejected by QA';

/** The subject of the work-in-progress commit of an issue. */
export function wipSubject(issue) {
  return `${WIP_PREFIX} (#${issue})`;
}

/** Whether a commit subject is that commit; the issue is checked too when given. */
export function isWipCommit(subject, issue = null) {
  const s = String(subject ?? '').trim();
  if (issue === null) return s === WIP_PREFIX || s.startsWith(`${WIP_PREFIX} (#`);
  return s === wipSubject(issue);
}

// The reasons of the failure path for which the developer's work exists and is worth keeping.
export const KEEP_REASONS = ['QA rejected after the retries', 'tasks left unfinished'];

/** Whether the work is kept for a failure reason. */
export function keepsWork(reason) {
  return KEEP_REASONS.includes(String(reason ?? '').trim());
}

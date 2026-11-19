// Can a run continue from the branch of its issue, or must it stop? Implements "A later run resumes from the checkpoints"
// of the go specification.
//
// A branch is resumed only when nothing on it is a person's: every commit over the base is the specification, a checkpoint
// or the work kept at a limit, for this issue; the tip is a checkpoint or a limit commit (never a QA rejection, which has
// a finding and belongs to `fix`); and the tip carries the hash of the issue text, which has not changed since.
//
// `git(args) -> stdout` is injected so the logic can be tested. The refs `origin/<base>` and `origin/<branch>` are read
// as they are; the command-line wrapper fetches them first.

import { isCheckpoint, isOwnCommit, issueHashOf, wipSubject } from './wip-commit.mjs';

const REF = /^[A-Za-z0-9._/-]+$/;

/**
 * { state, reason, commits, checkpoints, tip }:
 *   absent    no such branch on the remote
 *   resume    the run may continue from it
 *   existing  it may not: `reason` says why
 */
export function resumeState({ git, base, branch, issue, issueHash }) {
  if (![base, branch].every((r) => typeof r === 'string' && REF.test(r) && !r.includes('..'))) return { state: 'existing', reason: 'the base or the branch is not a plain name' };
  try {
    git(['rev-parse', '--verify', '-q', `refs/remotes/origin/${branch}`]);
  } catch {
    return { state: 'absent', reason: null };
  }
  let log;
  try {
    log = git(['log', '--format=%H%x1f%s%x1f%b%x1e', `origin/${base}..origin/${branch}`]);
  } catch (error) {
    return { state: 'existing', reason: `git could not read the branch: ${String(error.message).split('\n')[0].slice(0, 160)}` };
  }
  const commits = log.split('\x1e').map((c) => c.replace(/^\n/, '')).filter((c) => c.trim()).map((c) => {
    const [sha, subject, body] = c.split('\x1f');
    return { sha: sha.trim(), subject: (subject ?? '').trim(), body: body ?? '' };
  });
  if (commits.length === 0) return { state: 'existing', reason: 'the branch has no commit over the base' };
  const foreign = commits.find((c) => !isOwnCommit(c.subject, issue));
  if (foreign) return { state: 'existing', reason: `a commit that is not one of Relevo's for this issue: "${foreign.subject.slice(0, 80)}"` };
  const tip = commits[0];
  if (!isCheckpoint(tip.subject, issue) && tip.subject !== wipSubject(issue, 'limit')) return { state: 'existing', reason: 'the tip of the branch is not a checkpoint' };
  const hash = issueHashOf(tip.body);
  if (!hash) return { state: 'existing', reason: 'the tip of the branch carries no hash of the issue text' };
  if (!issueHash || hash !== issueHash) return { state: 'existing', reason: 'the text of the issue changed since the last checkpoint' };
  return { state: 'resume', reason: null, commits: commits.length, checkpoints: commits.filter((c) => isCheckpoint(c.subject, issue)).length, tip: tip.sha.slice(0, 7) };
}

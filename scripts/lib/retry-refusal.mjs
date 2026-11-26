// What `go-plan.mjs --retry` says when the issue already has a branch on the remote.
// Implements "A refused retry says how to recover from a specification-only branch" of the go specification.
//
// The planner never deletes or rewrites the branch: it only says what the person can do. When the branch holds only the
// specification Relevo wrote, there is no code to correct, so `fix` would not apply and the way out is to delete it. When it holds
// code (the checkpoints of a build that did not finish, or the finished work) the way is `fix`, which needs no description of the defect.

import { execFileSync } from 'node:child_process';
import { classifyBranchChanges } from './branch.mjs';

/** What the remote branch holds: `empty`, `spec-only`, `implementation`, or null when it cannot be read. Read-only. */
export function readBranchKind({ base, branch, git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }) {
  try {
    git('fetch', '--quiet', 'origin', base, branch);
    const paths = git('diff', '--name-only', `origin/${base}...origin/${branch}`).split('\n');
    return classifyBranchChanges(paths, branch.replace(/^feature\//, ''));
  } catch {
    return null;
  }
}

const DELETE = (branch) => `git push origin --delete ${branch}`;

/** The text of the refusal for the issue and the branch, given what the branch holds (`kind`, null when unknown). */
export function retryRefusal({ issue, branch, kind, resume = null }) {
  if (kind === 'spec-only') {
    return `#${issue} already has a branch on the remote (${branch}) and it holds only the specification, so there is no code to fix: delete it with \`${DELETE(branch)}\` and run /relevo:go ${issue} --retry again`;
  }
  if (kind === 'implementation' && resume?.state === 'resume') {
    return `#${issue} already has a branch on the remote (${branch}) and it holds code (checkpoints or the work kept when the build stopped), so it is not built again from the beginning: run /relevo:go ${issue} --resume to continue it from where it stopped`;
  }
  if (kind === 'implementation') {
    return `#${issue} already has a branch on the remote (${branch}) and it holds code (checkpoints or the finished work), so it is not built again: run /relevo:fix ${issue} to correct it (when the branch ends at a commit that go made for a build that did not finish, fix needs no description of the defect), or delete the branch to build again`;
  }
  return `#${issue} already has a branch on the remote (${branch}): run /relevo:fix ${issue} to correct it, or delete the branch to build again`;
}


/**
 * The text of the refusal of `--resume` (and of the label that resumes), by what the check answered and what the branch holds.
 * check  { state: 'absent' | 'existing', reason } from resume-check.mjs; kind from readBranchKind (null when it cannot be read)
 * It names the reason and the step that fits it, and never deletes or rewrites anything.
 */
export function resumeRefusal({ issue, branch, check, kind }) {
  if (check?.state === 'absent') return `#${issue} has no branch on the remote, so there is nothing to continue: /relevo:go ${issue} --retry builds it from the beginning`;
  const reason = String(check?.reason ?? '');
  if (kind === 'spec-only') {
    return `#${issue} cannot be resumed: the branch ${branch} holds only the specification, so there is nothing to continue. Delete it with \`${DELETE(branch)}\` and run /relevo:go ${issue} --retry`;
  }
  if (/could not read|no commit over the base|not a plain/.test(reason) || kind === null) {
    return `#${issue} cannot be resumed: the branch ${branch} could not be read${reason ? ` (${reason})` : ''}. Nothing was changed; check the connection and run it again`;
  }
  if (/not one of Relevo's/.test(reason)) {
    return `#${issue} cannot be resumed: ${reason}. The branch holds work that is not Relevo's, so it is not continued: delete it with \`${DELETE(branch)}\` and run /relevo:go ${issue} --retry to build it from the beginning`;
  }
  if (/text of the issue changed|carries no hash/.test(reason)) {
    return `#${issue} cannot be resumed: the text of the issue changed since the build stopped. Run /relevo:issue ${issue} to settle the text; if the work on the branch no longer fits it, delete the branch (\`${DELETE(branch)}\`) and run /relevo:go ${issue} --retry to build it from the beginning`;
  }
  return `#${issue} cannot be resumed: the work on the branch ${branch} was rejected by QA, or it does not end at a checkpoint or a stop at a limit (${reason || 'no reason given'}). Run /relevo:fix ${issue} to correct it; fix needs no description of the defect when go left the finding`;
}

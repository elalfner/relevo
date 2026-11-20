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

/** The text of the refusal for the issue and the branch, given what the branch holds (`kind`, null when unknown). */
export function retryRefusal({ issue, branch, kind }) {
  if (kind === 'spec-only') {
    return `#${issue} already has a branch on the remote (${branch}) and it holds only the specification, so there is no code to fix: delete it with \`git push origin --delete ${branch}\` and run /relevo:go ${issue} --retry again`;
  }
  if (kind === 'implementation') {
    return `#${issue} already has a branch on the remote (${branch}) and it holds code (checkpoints or the finished work), so it is not built again: run /relevo:fix ${issue} to correct it (when the branch ends at a commit that go made for a build that did not finish, fix needs no description of the defect), or delete the branch to build again`;
  }
  return `#${issue} already has a branch on the remote (${branch}): run /relevo:fix ${issue} to correct it, or delete the branch to build again`;
}

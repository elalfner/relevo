// What `go-plan.mjs --retry` says when the issue already has a branch on the remote.
// Implements "A refused retry says how to recover from a specification-only branch" of the go specification.
//
// The planner never deletes or rewrites the branch: it only says what the person can do. When the branch holds only the
// specification Relevo wrote, there is no code to correct, so `fix` would not apply and the way out is to delete it.

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
  return `#${issue} already has a branch on the remote (${branch}): run /relevo:fix ${issue} to correct it, or delete the branch to build again`;
}

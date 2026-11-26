// Delivering a built issue of a files project: the gate that a pull request would have applied, and the local merge.
// Implements openspec/specs/local-delivery (change local-tracker). The gate is pure; the git work takes an injected `git`.

import { resolveLabelNames } from './labels.mjs';
import { probeMerge } from './merge-probe.mjs';

// The commits `ship` makes itself on the branch (the archive of the specification) do not make the reviewed work stale.
export const OWN_COMMIT = /^chore\(openspec\): archive /;

/**
 * @param {{ config: object, issue: { state: string, labels: {name: string}[] }, delivery: object|null, head: string, after: {review: string[], gate: string[]}, merge: { result: string, files: string[] } }} facts
 *   `after.review` and `after.gate` are the subjects of the commits made after the reviewed commit and after the last green gate.
 * @returns {{ ok: boolean, reasons: string[] }} every reason that stops the merge, in the words shown to the person.
 */
export function shipDecisionFiles({ config, issue, delivery, head, after, merge }) {
  const names = resolveLabelNames(config.labels);
  const has = (k) => issue.labels.some((l) => l.name === names[k]);
  const reasons = [];
  const stale = (subjects) => subjects.filter((s) => !OWN_COMMIT.test(s));
  if (issue.state !== 'OPEN') reasons.push('the issue is closed: it was already shipped');
  else if (!has('built') && !has('in-review')) reasons.push('the issue has not been built: it needs /relevo:go, then /relevo:review');
  if (!delivery?.review || delivery.review.result !== 'passed') reasons.push('the issue was not reviewed: run /relevo:review and finish it with every step passed');
  else if (stale(after.review).length > 0) reasons.push(`the branch changed after the review (${stale(after.review).length} commit(s)): review it again`);
  if (delivery?.gate?.status !== 'green') reasons.push('the validation gate has not passed on this branch: run it again');
  else if (delivery.gate.commit !== head && stale(after.gate).length > 0) reasons.push(`the validation gate has not passed on the commit that would be merged (${stale(after.gate).length} commit(s) came after the last green gate): run it again`);
  if (merge.result === 'conflict') reasons.push(`the branch does not merge cleanly into ${config.branches.base}: ${merge.files.join(', ') || 'conflicting files'}`);
  else if (merge.result !== 'clean') reasons.push(`it could not be checked whether the branch merges cleanly into ${config.branches.base}: ask your git for a merge-tree (git 2.38 or later)`);
  return { ok: reasons.length === 0, reasons };
}

/** The facts the gate needs, read from git. `git(args) -> stdout` throws on failure. */
export function gatherShipFacts({ git, branch, base, delivery }) {
  const subjectsAfter = (commit) => {
    if (!commit) return [];
    try { return git(['log', '--format=%s', `${commit}..${branch}`]).split('\n').filter(Boolean); } catch { return ['(unknown)']; }
  };
  const head = git(['rev-parse', branch]).trim();
  const run = (...args) => {
    try { return { status: 0, stdout: git(args) }; } catch (error) { return { status: error.status ?? 2, stdout: String(error.stdout ?? '') }; }
  };
  return {
    head,
    after: { review: subjectsAfter(delivery?.review?.commit), gate: subjectsAfter(delivery?.gate?.commit) },
    merge: probeMerge(run, base, branch),
  };
}

/**
 * The squash merge of the branch into the base branch, the deletion of the branch and the removal of its worktree.
 * Refuses, changing nothing, unless the base branch is checked out here and the working tree is clean.
 * @returns {{ commit: string, worktree: string|null }}
 */
export function mergeLocal({ git, branch, base, issue, title }) {
  const current = git(['branch', '--show-current']).trim();
  if (current !== base) throw new Error(`check out ${base} first: the merge is made there, and this is ${current || 'a detached head'}`);
  if (git(['status', '--porcelain']).trim() !== '') throw new Error('the working tree has changes: commit or stash them first, so nothing of yours is mixed into the merge');
  const worktrees = git(['worktree', 'list', '--porcelain']).split('\n\n').map((b) => ({ path: /^worktree (.+)$/m.exec(b)?.[1], branch: /^branch refs\/heads\/(.+)$/m.exec(b)?.[1] }));
  const holder = worktrees.find((w) => w.branch === branch)?.path ?? null;
  try {
    git(['merge', '--squash', branch]);
    git(['commit', '-q', '-m', title, '-m', `Issue #${issue}`]);
  } catch (error) {
    try { git(['reset', '--hard', 'HEAD']); } catch { /* the tree was clean before, so there is nothing of the person's to lose */ }
    throw new Error(`the merge failed and was undone: ${String(error.stderr ?? error.message).split('\n')[0]}`);
  }
  const commit = git(['rev-parse', '--short', 'HEAD']).trim();
  let removed = null;
  if (holder) {
    try { git(['worktree', 'remove', holder]); removed = holder; } catch { /* the worktree has something git refuses to discard: it stays and the report says so */ }
  }
  git(['branch', '-D', branch]);
  return { commit, worktree: holder, removed };
}

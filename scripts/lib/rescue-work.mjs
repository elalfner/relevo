// Keeps the work of a run that was cut. When the runner stops the agent (turn or cost limit) or the job is cancelled or
// times out, the failure path of `go` never runs, so the work lives only in the working tree of the runner. A step that
// always runs calls this to commit and push it. Implements "The work is kept when the runner cuts the run" of the go
// specification.
//
// It commits through `commitChange`, so it has the same refusals as any commit of Relevo: protected paths, restricted
// files, temporary markers and credentials. It pushes only after a commit (or when earlier commits of the branch were
// never pushed), never with force, and only as a fast-forward of what the remote has: it overwrites nothing.
//
// `git(args) -> stdout` is injected so the logic can be tested; it throws when git fails.

import { commitChange, refusalText } from './commit-change.mjs';
import { withIssueHash, wipSubject } from './wip-commit.mjs';

// What a run leaves in the working tree that is not the work: tools and the folders of the Relevo scripts.
const NOT_WORK = [/^node_modules\//, /^\.relevo-(receipt|plugin|design)\//];
const NAME_RE = /^[A-Za-z0-9._/-]+$/;

/** The paths of `git status --porcelain=v1 -z`: a renamed file gives its new path and its old one. */
export function changedPaths(porcelainZ) {
  const parts = String(porcelainZ ?? '').split('\0');
  const paths = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    if (entry[0] === 'R' || entry[0] === 'C') {
      i += 1;
      if (parts[i]) paths.push(parts[i]);
    }
  }
  return [...new Set(paths)].filter((p) => !NOT_WORK.some((re) => re.test(p)));
}

/** The decision of the workflow is data: only what looks like a name or a number is read from it. */
export function readDecision(b64) {
  try {
    const d = JSON.parse(Buffer.from(String(b64 ?? ''), 'base64').toString('utf8'));
    const name = (v) => (typeof v === 'string' && NAME_RE.test(v) && !v.includes('..') ? v : null);
    const issue = Number.isInteger(d.issue) && d.issue > 0 ? d.issue : null;
    const allow = Array.isArray(d.allow_paths) ? d.allow_paths.filter((p) => typeof p === 'string' && p.trim() && !p.startsWith('-')) : [];
    const path = typeof d.path === 'string' && !d.path.includes('..') && !d.path.startsWith('-') ? d.path : null;
    if (issue === null || name(d.branch) === null) return null;
    const issueHash = typeof d.issue_hash === 'string' && /^[0-9a-f]{64}$/.test(d.issue_hash) ? d.issue_hash : null;
    return { issue, branch: name(d.branch), base: name(d.base), change: name(d.change_id), within: path, allow, issueHash };
  } catch {
    return null;
  }
}

/**
 * Commit and push what a cut run left, or what a group of tasks just finished (a checkpoint). Returns
 * { state, branch, files, commit, detail }:
 *   kept        the work is on the branch of the issue on the remote
 *   unsafe      a commit was refused (protected path, restricted file, marker or credential): nothing was pushed
 *   not_pushed  the commit was made (or there was one) but the push failed
 *   existing    the remote branch has commits that this branch lacks: it was not touched
 *   nothing     there was nothing to keep, or the run is on a branch that is not the base and not the issue's (the edits are counted)
 * The branch may already be on the remote because of the checkpoints of this same run: a push that is a fast-forward of
 * the remote tip is allowed, and any other push is refused, so nothing is ever overwritten.
 *   subject  the subject of the commit (`wip: stopped by limit (#N)` by default); the hash of the issue text goes in as a trailer
 */
export function rescueWork({ git, decision, rulesFile = null, platformPaths = [], restricted, subject = null }) {
  const result = (state, extra = {}) => ({ state, branch: decision.branch, files: 0, commit: null, detail: '', ...extra });
  let current;
  try {
    current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch (error) {
    return result('not_pushed', { detail: `git could not read the branch: ${firstLine(error)}` });
  }
  if (current !== decision.branch) {
    // The run never moved to the branch of the issue (the developer worked on the base branch or on a detached head). The
    // edits are carried to a new branch of the issue, from where the run stands, and committed there: the base branch is
    // never committed to, and the working tree of a runner is gone when the job ends. A branch of another name, or one that
    // already exists here, is not touched: the edits are only counted.
    let left = 0;
    let exists = false;
    try {
      left = changedPaths(git(['status', '--porcelain=v1', '-z', '--untracked-files=all'])).length;
      try {
        git(['rev-parse', '--verify', '-q', `refs/heads/${decision.branch}`]);
        exists = true;
      } catch { /* no such local branch */ }
    } catch { /* the count is only information */ }
    const onBase = current === 'HEAD' || (decision.base !== null && current === decision.base);
    if (left === 0) return result('nothing', { detail: `the branch of the issue was not created (the run is on ${current || 'no branch'})` });
    if (exists || !onBase) {
      return result('nothing', { files: left, detail: `the run is on ${current || 'no branch'}, not on the branch of the issue; ${left} changed file(s) in the working tree were not committed` });
    }
    try {
      git(['checkout', '-b', decision.branch]);
    } catch (error) {
      return result('not_pushed', { files: left, detail: `the branch of the issue could not be created to keep ${left} changed file(s): ${firstLine(error)}` });
    }
  }

  try {
    const tip = git(['ls-remote', '--heads', 'origin', decision.branch]).trim().split(/\s+/)[0];
    if (tip) {
      // A remote tip that this branch contains is the work of this run (its checkpoints): pushing is a fast-forward. Any
      // other, including a commit this clone does not even have, belongs to someone else and is left alone.
      let contained = false;
      try {
        git(['merge-base', '--is-ancestor', tip, 'HEAD']);
        contained = true;
      } catch { /* not an ancestor, or an object this clone does not have */ }
      if (!contained) return result('existing', { detail: 'the branch is already on the remote with commits this run does not have, so it was not touched' });
    }
  } catch (error) {
    return result('not_pushed', { detail: `git could not ask the remote: ${firstLine(error)}` });
  }

  let paths;
  let ahead = 0;
  try {
    paths = changedPaths(git(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
    if (decision.base) ahead = Number(git(['rev-list', '--count', `origin/${decision.base}..HEAD`]).trim()) || 0;
  } catch (error) {
    return result('not_pushed', { detail: `git could not read the working tree: ${firstLine(error)}` });
  }
  if (paths.length === 0 && ahead === 0) return result('nothing', { detail: 'the working tree has nothing to keep' });

  let commit = null;
  if (paths.length > 0) {
    let committed;
    try {
      committed = commitChange({
        git, message: withIssueHash(subject ?? wipSubject(decision.issue, 'limit'), decision.issueHash), paths, allow: decision.allow, rulesFile, platformPaths,
        within: decision.within, change: decision.change, restricted,
      });
    } catch (error) {
      return result('not_pushed', { files: paths.length, detail: `the commit failed: ${firstLine(error)}` });
    }
    if (!committed.ok) return result('unsafe', { files: paths.length, detail: refusalText(committed) });
    commit = committed.commit;
  }

  try {
    git(['push', '-u', 'origin', decision.branch]);
  } catch (error) {
    return result('not_pushed', { files: paths.length, commit, detail: `the push failed: ${firstLine(error)}` });
  }
  return result('kept', { files: paths.length, commit, detail: commit ? `committed ${paths.length} file(s) as ${commit}` : 'the commits of the branch were pushed' });
}

function firstLine(error) {
  return String(error?.stderr || error?.message || error).trim().split('\n')[0].slice(0, 200);
}

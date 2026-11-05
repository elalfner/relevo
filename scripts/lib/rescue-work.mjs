// Keeps the work of a run that was cut. When the runner stops the agent (turn or cost limit) or the job is cancelled or
// times out, the failure path of `go` never runs, so the work lives only in the working tree of the runner. A step that
// always runs calls this to commit and push it. Implements "The work is kept when the runner cuts the run" of the go
// specification.
//
// It commits through `commitChange`, so it has the same refusals as any commit of Relevo: protected paths, restricted
// files, temporary markers and credentials. It pushes only after a commit (or when earlier commits of the branch were
// never pushed), never with force, and never to a branch that already exists on the remote.
//
// `git(args) -> stdout` is injected so the logic can be tested; it throws when git fails.

import { commitChange, refusalText } from './commit-change.mjs';
import { wipSubject } from './wip-commit.mjs';

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
    return { issue, branch: name(d.branch), base: name(d.base), change: name(d.change_id), within: path, allow };
  } catch {
    return null;
  }
}

/**
 * Commit and push what a cut run left. Returns { state, branch, files, commit, detail }:
 *   kept        the work is on the branch of the issue on the remote
 *   unsafe      a commit was refused (protected path, restricted file, marker or credential): nothing was pushed
 *   not_pushed  the commit was made (or there was one) but the push failed
 *   existing    the branch already exists on the remote: it was not touched
 *   nothing     there was nothing to keep: the branch was never created, or it holds no work
 */
export function rescueWork({ git, decision, rulesFile = null, platformPaths = [], restricted }) {
  const result = (state, extra = {}) => ({ state, branch: decision.branch, files: 0, commit: null, detail: '', ...extra });
  let current;
  try {
    current = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch (error) {
    return result('not_pushed', { detail: `git could not read the branch: ${firstLine(error)}` });
  }
  if (current !== decision.branch) return result('nothing', { detail: `the branch of the issue was not created (the run is on ${current || 'no branch'})` });

  try {
    if (git(['ls-remote', '--heads', 'origin', decision.branch]).trim()) return result('existing', { detail: 'the branch is already on the remote, so it was not touched' });
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
        git, message: wipSubject(decision.issue, 'limit'), paths, allow: decision.allow, rulesFile, platformPaths,
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

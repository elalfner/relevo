// What the planner asks about the branch of a `build-failed` issue: may a run continue from it? Read-only, through the REST API, so the
// `decide` job (no checkout) and a machine ask the same thing. See resume-check.mjs for the check itself and resume-rest.mjs for the adapter.

import { issueHash } from './issue-hash.mjs';
import { resumeState } from './resume-check.mjs';
import { restGit } from './resume-rest.mjs';

/** The first branch `feature/<n>-*` of the issue on the remote, or null (nothing there). Throws when it cannot be looked for. */
export function branchOf({ gh, repo, number }) {
  const refs = JSON.parse(gh(['api', `repos/${repo}/git/matching-refs/heads/feature/${number}-`]));
  return Array.isArray(refs) && refs.length > 0 ? String(refs[0].ref).replace(/^refs\/heads\//, '') : null;
}

/**
 * The answer of the resume check for the branch of the issue, as { state, reason, ... }. `title` and `body` are the text of the issue now;
 * when they are not given they are read. A text or a branch that cannot be read is `existing` with the reason, never `resume`.
 */
export function resumeCheckFor({ gh, repo, number, base, branch, title, body }) {
  try {
    let text = { title, body };
    if (typeof title !== 'string' || typeof body !== 'string') {
      const issue = JSON.parse(gh(['api', `repos/${repo}/issues/${number}`]));
      text = { title: issue.title ?? '', body: issue.body ?? '' };
    }
    return resumeState({ git: restGit({ gh, repo }), base, branch, issue: number, issueHash: issueHash(text) });
  } catch (error) {
    return { state: 'existing', reason: `the branch could not be read: ${String(error?.message ?? error).split('\n')[0].slice(0, 160)}` };
  }
}

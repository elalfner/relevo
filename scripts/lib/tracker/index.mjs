// The tracker of a project: the one place that knows where issues, their state, their comments and their delivery live.
// `tracker` in relevo.yml picks the backend; the skills and scripts call these verbs and never `gh issue` or `gh pr`.

import { githubBackend } from './github.mjs';

export const VERBS = ['issueGet', 'issueList', 'issueCreate', 'issueEditBody', 'stateSet', 'commentAdd', 'commentsList', 'issueClose', 'deliveryOpen', 'deliveryGet'];

/**
 * @param {{tracker?: string}} config  the validated relevo.yml
 * @param {{gh?: Function, repo?: string|null, files?: Function}} io  `gh` for github, `files` (a factory) for files
 */
export function createTracker(config, io = {}) {
  const kind = config?.tracker ?? 'github';
  if (kind === 'github') {
    if (typeof io.gh !== 'function') throw new Error('the github tracker needs a gh client');
    return githubBackend({ gh: io.gh, repo: io.repo ?? null });
  }
  if (kind === 'files') {
    if (typeof io.files !== 'function') throw new Error('the files tracker is not available here');
    return io.files(config);
  }
  throw new Error(`unknown tracker "${kind}"`);
}

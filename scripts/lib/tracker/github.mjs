// The GitHub backend of the tracker: each verb is the `gh` call the skills and scripts made inline before, so a github
// project behaves as it always did. `gh(args, input?) -> stdout` is injected (see gh-client.mjs) and throws on failure.
// Implements the entry point of "Go reads and moves the issue through the tracker" (local-tracker design, decision 1).

export const ISSUE_FIELDS = 'number,title,body,state,labels,comments,assignees,milestone';
export const DELIVERY_FIELDS = 'number,state,isDraft,mergeable,title,author,reviews,headRefName,baseRefName,url';

/** `repo` is optional: without it `gh` uses the repository of the working directory. */
export function githubBackend({ gh, repo = null }) {
  const scope = repo ? ['--repo', repo] : [];
  const json = (args) => JSON.parse(gh(args));
  return {
    kind: 'github',
    issueGet: (n, fields = ISSUE_FIELDS) => json(['issue', 'view', String(n), '--json', fields, ...scope]),
    issueList: ({ state = 'open', search = null, fields = 'number,title,labels', limit = 100 } = {}) =>
      json(['issue', 'list', '--state', state, ...(search ? ['--search', search] : []), '--json', fields, '--limit', String(limit), ...scope]),
    /** Returns the URL of the new issue. */
    issueCreate: ({ title, body, milestone = null, assignee = null }) => gh([
      'issue', 'create', '--title', title, '--body-file', '-',
      ...(milestone ? ['--milestone', milestone] : []), ...(assignee ? ['--assignee', assignee] : []), ...scope,
    ], body).trim(),
    issueEditBody: (n, body) => { gh(['issue', 'edit', String(n), '--body-file', '-', ...scope], body); },
    /** Moves the issue between lifecycle states: `add` and `remove` are label names. */
    stateSet: (n, { add = [], remove = [] }) => {
      if (add.length + remove.length === 0) return;
      gh(['issue', 'edit', String(n), ...add.flatMap((l) => ['--add-label', l]), ...remove.flatMap((l) => ['--remove-label', l]), ...scope]);
    },
    commentAdd: (n, body) => { gh(['issue', 'comment', String(n), '--body-file', '-', ...scope], body); },
    commentsList: (n) => json(['issue', 'view', String(n), '--json', 'comments', ...scope]).comments ?? [],
    issueClose: (n) => { gh(['issue', 'close', String(n), '--reason', 'completed', ...scope]); },
    /** Opens the pull request of a built branch and returns its URL. */
    deliveryOpen: ({ branch, base, title, body }) => gh(['pr', 'create', '--head', branch, '--base', base, '--title', title, '--body-file', '-', ...scope], body).trim(),
    /** The pull request of a branch as `gh pr view --json` gives it, or null when there is none. */
    deliveryGet: (branch) => {
      try {
        return json(['pr', 'view', branch, '--json', DELIVERY_FIELDS, ...scope]);
      } catch (error) {
        if (/no pull requests? found/i.test(String(error.stderr ?? error.message))) return null;
        throw error;
      }
    },
  };
}

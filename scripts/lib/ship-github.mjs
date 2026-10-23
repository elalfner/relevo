// What ship reads from GitHub besides the pull request: the commits since the approved head, the checks of that
// head, and whether the base branch requires checks. The client is injected (`gh(args) -> stdout`) for the tests.
// Implements "Checks of the approved head count for the archive commit" and "Repositories that require checks ship
// with an App" of openspec/specs/ship/spec.md.

const SPECS_DIR = 'openspec/';
// The compare API lists at most 300 files; a longer list cannot be proven to stay inside the specifications.
const COMPARE_FILE_LIMIT = 300;

const ROLLUP_QUERY = `query($owner: String!, $name: String!, $oid: GitObjectID!) {
  repository(owner: $owner, name: $name) {
    object(oid: $oid) {
      ... on Commit {
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun { name status conclusion }
              ... on StatusContext { context state }
            }
          }
        }
      }
    }
  }
}`;

// The fields shipDecision reads.
export const PR_FIELDS = 'number,state,isDraft,mergeable,title,author,reviews,statusCheckRollup,headRefName,headRefOid,baseRefName';

/** The open pull request of `branch` (or its latest one), as `gh pr view --json` gives it, or null when none exists. */
export function loadPr(gh, repo, branch) {
  const found = JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state', '--limit', '5']));
  const open = found.find((p) => p.state === 'OPEN') ?? found[0];
  return open ? JSON.parse(gh(['pr', 'view', String(open.number), '--repo', repo, '--json', PR_FIELDS])) : null;
}

const notFound = (err) => /404|Not Found/i.test(String(err?.stderr ?? err?.message ?? err));

/** True when every file that changed from `baseline` to `head` is under `openspec/`, and something changed. */
export function changedOnlySpecs(gh, repo, baseline, head) {
  if (!baseline || !head || baseline === head) return false;
  const data = JSON.parse(gh(['api', `repos/${repo}/compare/${baseline}...${head}`]));
  const files = data.files ?? [];
  if (files.length === 0 || files.length >= COMPARE_FILE_LIMIT) return false;
  return files.every((f) => f.filename.startsWith(SPECS_DIR) && (!f.previous_filename || f.previous_filename.startsWith(SPECS_DIR)));
}

/** The status check rollup of one commit, in the shape `gh pr view --json statusCheckRollup` gives. */
export function commitRollup(gh, repo, oid) {
  const [owner, name] = repo.split('/');
  const data = JSON.parse(gh(['api', 'graphql', '-f', `query=${ROLLUP_QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-f', `oid=${oid}`]));
  return data.data?.repository?.object?.statusCheckRollup?.contexts?.nodes ?? [];
}

/** The input of shipDecision's `baselineChecks`, or undefined when there is no baseline to compare. */
export function baselineChecks(gh, repo, baseline, head) {
  if (!baseline || !head || baseline === head) return undefined;
  const archiveOnly = changedOnlySpecs(gh, repo, baseline, head);
  return { archiveOnly, rollup: archiveOnly ? commitRollup(gh, repo, baseline) : [] };
}

/**
 * Whether merging into `branch` requires status checks, by a ruleset or by classic branch protection.
 * Returns { required: boolean, contexts: [names] }. A branch without protection requires none.
 */
export function requiredChecks(gh, repo, branch) {
  const contexts = new Set();
  let required = false;
  const rules = JSON.parse(gh(['api', `repos/${repo}/rules/branches/${encodeURIComponent(branch)}`]));
  (Array.isArray(rules) ? rules : []).filter((r) => r.type === 'required_status_checks').forEach((r) => {
    required = true;
    (r.parameters?.required_status_checks ?? []).forEach((c) => contexts.add(c.context));
  });
  try {
    const protection = JSON.parse(gh(['api', `repos/${repo}/branches/${encodeURIComponent(branch)}/protection`]));
    const classic = protection.required_status_checks;
    if (classic) {
      required = true;
      (classic.contexts ?? []).forEach((c) => contexts.add(c));
      (classic.checks ?? []).forEach((c) => contexts.add(c.context));
    }
  } catch (err) {
    if (!notFound(err)) throw err;
  }
  return { required, contexts: [...contexts] };
}

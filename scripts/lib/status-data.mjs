// Reads what `status` and the digest need from GitHub. Read-only: every call is a GET.
// The client is injected (`gh(args) -> stdout`).

import { issueFromBranch } from './branch.mjs';
import { LABELS, resolveLabelNames } from './labels.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { cloudBuilds, CLOUD_VARIABLE } from './execution-mode.mjs';

const paged = (gh, path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

// The first line of an error, which is the reason a read failed.
const reasonOf = (err) => String(err?.stderr ?? err?.message ?? err).trim().split('\n')[0];
const notFound = (err) => /404|Not Found/i.test(String(err?.stderr ?? err?.message ?? err));

export function gatherStatus({ gh, ghLinks = gh, repo, config }) {
  // The reads that fail and are not an answer; the report lists them so that a partial report is not taken for a complete one.
  const unread = [];
  const names = resolveLabelNames(config.labels);
  const byNumber = new Map();
  LABELS.forEach((l) => {
    paged(gh, `repos/${repo}/issues?state=open&per_page=100&labels=${encodeURIComponent(names[l.key])}`)
      .filter((i) => !i.pull_request)
      .forEach((i) => byNumber.set(i.number, {
        number: i.number, title: i.title, updated_at: i.updated_at ?? null, labels: i.labels.map((x) => (typeof x === 'string' ? x : x.name)),
        assignees: (i.assignees ?? []).map((a) => a.login), milestone: i.milestone?.number ?? null,
        // Only blocked issues need their text: it names what they wait for in other repositories.
        ...(i.labels.some((x) => (typeof x === 'string' ? x : x.name) === names.blocked) ? { body: i.body ?? '' } : {}),
      }));
  });
  const issues = [...byNumber.values()];

  const wanted = new Set(issues.map((i) => i.milestone).filter(Boolean));
  const milestones = [...wanted].map((n) => {
    const m = JSON.parse(gh(['api', `repos/${repo}/milestones/${n}`]));
    return { number: m.number, title: m.title, due_on: m.due_on ?? null, closed_issues: m.closed_issues ?? 0 };
  });

  const prs = [];
  paged(gh, `repos/${repo}/pulls?state=open&per_page=100`).forEach((pr) => {
    const issue = issueFromBranch(pr.head.ref);
    if (!issue) return;
    const reviewer = (pr.requested_reviewers ?? [])[0]?.login ?? null;
    const reviews = paged(gh, `repos/${repo}/pulls/${pr.number}/reviews?per_page=100`);
    const latest = new Map();
    reviews.filter((r) => r.user && r.user.login !== pr.user.login && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
      .forEach((r) => latest.set(r.user.login, r));
    const approvedBy = [...latest.values()].filter((r) => r.state === 'APPROVED').map((r) => r.user.login);
    const timeline = paged(gh, `repos/${repo}/issues/${pr.number}/timeline?per_page=100`)
      .filter((e) => e.event === 'review_requested');
    let behind = 0;
    try {
      behind = JSON.parse(gh(['api', `repos/${repo}/compare/${pr.head.sha}...${pr.base.ref}`])).ahead_by ?? 0;
    } catch (err) {
      behind = 0;
      unread.push({ what: 'compare', pr: pr.number, reason: reasonOf(err) });
    }
    prs.push({
      number: pr.number, issue, url: pr.html_url, author: pr.user.login,
      reviewer: reviewer ?? approvedBy[0] ?? null,
      requested_at: timeline.length ? timeline[timeline.length - 1].created_at : null,
      approved: approvedBy.length > 0, behind_by: behind,
    });
  });
  return { issues: issues.map(({ body, ...rest }) => rest), prs, milestones, externalBlocks: readExternalBlocks({ ghLinks, issues, repo, config, names }), cloudBuilds: readCloudBuilds({ gh, repo, unread }), unread };
}

/**
 * What each blocked issue waits for in other (linked) repositories: { [issue number]: [{ ref, state, lifecycle }] }.
 * `state` is `open`, `closed` (not completed) or `unreadable`; a dependency that is completed is not listed. The
 * lifecycle is the Relevo label of the other issue, without its prefix, as that repository names it.
 */
function readExternalBlocks({ ghLinks, issues, repo, config, names }) {
  const linked = new Set((config.links ?? []).map((l) => l.toLowerCase()));
  const out = {};
  issues.filter((i) => i.labels.includes(names.blocked)).forEach((i) => {
    const waits = [];
    parseIssueBody(i.body ?? '').dependsOnExternal
      .filter((d) => d.repo.toLowerCase() !== String(repo).toLowerCase() && linked.has(d.repo.toLowerCase()))
      .forEach((d) => {
        const ref = `${d.repo}#${d.number}`;
        try {
          const dep = JSON.parse(ghLinks(['api', `repos/${d.repo}/issues/${d.number}`]));
          if (dep.state === 'closed' && dep.state_reason === 'completed') return;
          const label = (dep.labels ?? []).map((x) => (typeof x === 'string' ? x : x.name)).find((n) => String(n).startsWith('relevo:'));
          waits.push({ ref, state: dep.state === 'closed' ? 'closed' : 'open', lifecycle: label ? label.slice('relevo:'.length) : null });
        } catch {
          waits.push({ ref, state: 'unreadable', lifecycle: null });
        }
      });
    if (waits.length) out[i.number] = waits;
  });
  return out;
}

/**
 * Does the cloud build? The go workflow is on the default branch and the repository variable that pauses the cloud
 * is not `off`. When the workflow cannot be read the answer is `true` (the cautious one: no extra rows, no claim
 * that a person must build by hand).
 */
function readCloudBuilds({ gh, repo, unread = [] }) {
  let workflowPresent;
  try {
    gh(['api', `repos/${repo}/contents/.github/workflows/relevo-go.yml`]);
    workflowPresent = true;
  } catch (err) {
    if (!notFound(err)) {
      unread.push({ what: 'workflow', reason: reasonOf(err) });
      return true;
    }
    workflowPresent = false;
  }
  let variable = null;
  try {
    variable = JSON.parse(gh(['api', `repos/${repo}/actions/variables/${CLOUD_VARIABLE}`])).value ?? null;
  } catch (err) {
    variable = null;
    if (!notFound(err)) unread.push({ what: 'variable', reason: reasonOf(err) });
  }
  return cloudBuilds({ workflowPresent, variable });
}

// Reads what `status` and the digest need from GitHub. Read-only: every call is a GET.
// The client is injected (`gh(args) -> stdout`).

import { issueFromBranch } from './branch.mjs';
import { LABELS, resolveLabelNames } from './labels.mjs';

const paged = (gh, path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

export function gatherStatus({ gh, repo, config }) {
  const names = resolveLabelNames(config.labels);
  const byNumber = new Map();
  LABELS.forEach((l) => {
    paged(gh, `repos/${repo}/issues?state=open&per_page=100&labels=${encodeURIComponent(names[l.key])}`)
      .filter((i) => !i.pull_request)
      .forEach((i) => byNumber.set(i.number, {
        number: i.number, title: i.title, labels: i.labels.map((x) => (typeof x === 'string' ? x : x.name)),
        assignees: (i.assignees ?? []).map((a) => a.login), milestone: i.milestone?.number ?? null,
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
    } catch {
      behind = 0;
    }
    prs.push({
      number: pr.number, issue, url: pr.html_url, author: pr.user.login,
      reviewer: reviewer ?? approvedBy[0] ?? null,
      requested_at: timeline.length ? timeline[timeline.length - 1].created_at : null,
      approved: approvedBy.length > 0, behind_by: behind,
    });
  });
  return { issues, prs, milestones };
}

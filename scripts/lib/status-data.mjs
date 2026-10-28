// Reads what `status` and the digest need from GitHub. Read-only: every call is a GET.
// The client is injected (`gh(args) -> stdout`).

import { issueFromBranch } from './branch.mjs';
import { LABELS, resolveLabelNames } from './labels.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { cloudBuilds, CLOUD_VARIABLE } from './execution-mode.mjs';
import { parseUsageMarker, USAGE_DAYS } from './run-usage.mjs';
import { STAGE_DAYS, stagesOfIssue } from './stages.mjs';

const paged = (gh, path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

// The first line of an error, which is the reason a read failed.
const reasonOf = (err) => String(err?.stderr ?? err?.message ?? err).trim().split('\n')[0];
const notFound = (err) => /404|Not Found/i.test(String(err?.stderr ?? err?.message ?? err));

/**
 * The usage of the cloud runs of the last seven days, as parsed markers (see parseUsageMarker). One paged read of the
 * comments of the whole repository, closed issues included, however many issues there are. `since` filters by the time
 * a comment was updated, so the date it was created is checked against the window too. A read that fails gives no
 * runs: the digest is then posted without its line of usage.
 */
export function gatherUsage({ gh, repo, now = new Date() }) {
  const from = new Date(now).getTime() - USAGE_DAYS * 24 * 3600 * 1000;
  try {
    return paged(gh, `repos/${repo}/issues/comments?since=${encodeURIComponent(new Date(from).toISOString())}&per_page=100`)
      .filter((c) => Date.parse(c.created_at) >= from)
      .map(parseUsageMarker)
      .filter(Boolean);
  } catch (err) {
    process.stderr.write(`could not read the usage of the runs: ${reasonOf(err)}\n`);
    return [];
  }
}

/** The most pages of the stream of events that one digest reads, and the most issues whose events it then reads. */
export const STREAM_PAGE_CAP = 30;
export const STAGE_ISSUE_CAP = 100;

/**
 * The stages that finished in the last seven days, as [{ stage, ms }] (see stagesOfIssue). Two reads. First the events
 * of the whole repository, newest first, until a page reaches back before the window: they say which issues can have
 * ended a stage (a state label other than the first, or a close; pull requests are left out). Then the events of each of
 * those issues, whole, because a stage that ended this week may have begun before it. A read that fails gives no
 * samples, so the digest is posted without its line of stage times. Nothing is written.
 */
export function gatherStages({ gh, repo, config, now = new Date(), log = (m) => process.stderr.write(`${m}\n`) }) {
  const from = new Date(now).getTime() - STAGE_DAYS * 24 * 3600 * 1000;
  try {
    const labels = resolveLabelNames(config.labels);
    const ends = new Set(['building', 'built', 'in-review', 'pr-open'].map((k) => labels[k]));
    const candidates = new Map(); // issue number -> the time of its latest event in the window
    let reachedBack = false;
    for (let page = 1; page <= STREAM_PAGE_CAP && !reachedBack; page += 1) {
      const events = JSON.parse(gh(['api', `repos/${repo}/issues/events?per_page=100&page=${page}`]));
      let oldest = Infinity;
      events.forEach((e) => {
        const at = Date.parse(e.created_at);
        oldest = Math.min(oldest, at);
        if (at < from || !e.issue || e.issue.pull_request) return;
        if ((e.event === 'labeled' && ends.has(e.label?.name)) || e.event === 'closed') {
          candidates.set(e.issue.number, Math.max(candidates.get(e.issue.number) ?? 0, at));
        }
      });
      reachedBack = events.length < 100 || oldest < from;
      if (!reachedBack && page === STREAM_PAGE_CAP) log(`stage times: the cap of ${STREAM_PAGE_CAP} pages of events was reached, so what was read is used`);
    }
    const numbers = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    if (numbers.length > STAGE_ISSUE_CAP) log(`stage times: ${numbers.length} issues ended a stage, the ${STAGE_ISSUE_CAP} most recent are read`);
    return numbers.slice(0, STAGE_ISSUE_CAP).flatMap((n) => stagesOfIssue(paged(gh, `repos/${repo}/issues/${n}/events?per_page=100`), labels)
      .filter((st) => st.endedAt >= from)
      .map(({ stage, ms }) => ({ stage, ms })));
  } catch (err) {
    log(`could not read the stage times: ${reasonOf(err)}`);
    return [];
  }
}

export function gatherStatus({ gh, ghLinks = gh, repo, config, withUsage = false, withStages = false, now = new Date() }) {
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
  return { issues: issues.map(({ body, ...rest }) => rest), prs, milestones, externalBlocks: readExternalBlocks({ ghLinks, issues, repo, config, names }), cloudBuilds: readCloudBuilds({ gh, repo, unread }), unread, ...(withUsage ? { usage: gatherUsage({ gh, repo, now }) } : {}), ...(withStages ? { stages: gatherStages({ gh, repo, config, now }) } : {}) };
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

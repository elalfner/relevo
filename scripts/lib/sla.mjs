// Review reminder and escalation. Implements "Review reminders and escalation" of
// openspec/specs/issue-lifecycle/spec.md.
// The GitHub client is injected (`gh(args) -> stdout`), so everything here is testable without a network.

import { issueFromBranch } from './branch.mjs';
import { resolveLabelNames } from './labels.mjs';
import { renderMessage } from './messages.mjs';

/** Hidden markers that make the reminder and the escalation happen once. */
export const MARKERS = {
  review_reminder: '<!-- relevo:review_reminder -->',
  review_escalation: '<!-- relevo:review_escalation -->',
};

const HOUR = 3600 * 1000;

/**
 * prs: [{ number, issue, url, reviewer, requested_at, reviewed, reminded, escalated, labels: [names] }]
 * Returns decisions: { pr, issue, action: 'remind' | 'escalate', hours, labels: { add }, comment: { kind, data } | null }
 */
export function planSla({ config, prs, now = new Date() }) {
  const sla = config.limits.review_sla_hours;
  const names = resolveLabelNames(config.labels);
  const decisions = [];
  prs.forEach((pr) => {
    if (pr.reviewed || !pr.reviewer || !pr.requested_at) return;
    const waited = (new Date(now).getTime() - Date.parse(pr.requested_at)) / HOUR;
    const hours = Math.floor(waited);
    if (waited >= 2 * sla && !pr.escalated) {
      const specWriter = config.team.spec_writer;
      decisions.push({
        pr: pr.number, issue: pr.issue, action: 'escalate', hours,
        labels: { add: pr.labels.includes(names['needs-reviewer']) ? [] : [names['needs-reviewer']] },
        comment: specWriter
          ? { kind: 'review_escalation', data: { spec_writer: specWriter, issue: pr.issue, pr: pr.url, reviewer: pr.reviewer, hours } }
          : null,
      });
    } else if (waited >= sla && waited < 2 * sla && !pr.reminded && !pr.escalated) {
      decisions.push({
        pr: pr.number, issue: pr.issue, action: 'remind', hours, labels: { add: [] },
        comment: { kind: 'review_reminder', data: { reviewer: pr.reviewer, issue: pr.issue, pr: pr.url, hours } },
      });
    }
  });
  return decisions;
}

const json = (gh, args) => JSON.parse(gh(args));
const paged = (gh, path) => JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();

/** Open pull requests of Relevo issues that wait for a review, with what the SLA needs to know. */
export function gatherPrs({ gh, repo, config }) {
  const names = resolveLabelNames(config.labels);
  const prs = [];
  paged(gh, `repos/${repo}/pulls?state=open&per_page=100`).forEach((pr) => {
    const issue = issueFromBranch(pr.head.ref);
    if (!issue) return;
    const labels = json(gh, ['api', `repos/${repo}/issues/${issue}`]).labels.map((l) => (typeof l === 'string' ? l : l.name));
    if (!labels.includes(names['pr-open'])) return;
    const reviewer = (pr.requested_reviewers ?? [])[0]?.login ?? null;
    const timeline = paged(gh, `repos/${repo}/issues/${pr.number}/timeline?per_page=100`);
    const requests = timeline.filter((e) => e.event === 'review_requested' && (!reviewer || e.requested_reviewer?.login === reviewer));
    const requested_at = requests.length ? requests[requests.length - 1].created_at : null;
    const reviews = paged(gh, `repos/${repo}/pulls/${pr.number}/reviews?per_page=100`)
      .filter((r) => r.submitted_at && r.user?.login !== pr.user?.login);
    const reviewed = requested_at ? reviews.some((r) => Date.parse(r.submitted_at) >= Date.parse(requested_at)) : reviews.length > 0;
    const comments = paged(gh, `repos/${repo}/issues/${pr.number}/comments?per_page=100`).map((c) => c.body ?? '');
    prs.push({
      number: pr.number, issue, url: pr.html_url, reviewer, requested_at, reviewed, labels,
      reminded: comments.some((b) => b.includes(MARKERS.review_reminder)),
      escalated: comments.some((b) => b.includes(MARKERS.review_escalation)),
    });
  });
  return prs;
}

/** The `gh` commands that carry out one decision. Pure. */
export function slaCommands(decision, { repo, config }) {
  const commands = [];
  if (decision.labels.add.length) {
    const edit = ['issue', 'edit', String(decision.issue), '--repo', repo];
    decision.labels.add.forEach((l) => edit.push('--add-label', l));
    commands.push(edit);
  }
  if (decision.comment) {
    const body = `${renderMessage(decision.comment.kind, decision.comment.data, config.language)}\n\n${MARKERS[decision.comment.kind]}`;
    commands.push(['issue', 'comment', String(decision.pr), '--repo', repo, '--body', body]);
  }
  return commands;
}

// Chooses who reviews a pull request.
// Implements "Reviewer selection" of openspec/specs/issue-lifecycle/spec.md.

import { resolveLabelNames } from './labels.mjs';

/**
 * members      team.members
 * specWriter   team.spec_writer (never reviews)
 * author       whoever opens the pull request (never reviews their own)
 * approvers    team.approvers (only used when mode is "roles")
 * mode         review.mode
 * openCounts   { login: number of open review requests }
 * prNumber     breaks ties in rotation
 * Returns a login, or null when nobody is eligible.
 */
export function pickReviewer({ members, specWriter = null, author, approvers = [], mode = 'peer', openCounts = {}, prNumber = 0 }) {
  const eligible = members.filter((m) => m !== author && m !== specWriter && (mode !== 'roles' || approvers.includes(m)));
  if (eligible.length === 0) return null;
  const load = (m) => openCounts[m] ?? 0;
  const least = Math.min(...eligible.map(load));
  const ties = eligible.filter((m) => load(m) === least).sort();
  return ties[prNumber % ties.length];
}

/**
 * What to do when nobody is eligible: label the issue `needs-reviewer` next to its state and mention the spec writer.
 * Returns { labels: { add, remove }, comment } (comment is null when there is no spec writer to mention).
 */
export function noReviewerDecision({ config, issue }) {
  const names = resolveLabelNames(config.labels);
  const already = issue.labels?.includes(names['needs-reviewer']);
  const specWriter = config.team.spec_writer;
  return {
    labels: { add: already ? [] : [names['needs-reviewer']], remove: [] },
    comment: specWriter
      ? { kind: 'needs_reviewer', data: { spec_writer: specWriter, issue: issue.number, title: issue.title, pr: issue.pr } }
      : null,
  };
}

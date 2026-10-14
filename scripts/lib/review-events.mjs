// Keeps the lifecycle label in step with pull request reviews. Implements "Review events update the label"
// of openspec/changes/relevo-v1/specs/issue-lifecycle/spec.md. Pure: data in, decision out.
//
// event  { kind: 'review', state: 'changes_requested' | 'approved' | 'commented' | ..., reviewer, body, url }
//        { kind: 'push' }
// pr     { number, url, author }
// issue  { number, labels: [names] }

import { resolveLabelNames, transition } from './labels.mjs';

const SUMMARY_LENGTH = 300;

function summarise(body, es) {
  const text = String(body ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return es ? 'Revisa los comentarios en el pull request.' : 'See the comments on the pull request.';
  return text.length > SUMMARY_LENGTH ? `${text.slice(0, SUMMARY_LENGTH)}…` : text;
}

/** Returns { action, labels: { add, remove }, comment } or null when the event changes nothing. */
export function planReviewEvent({ config, event, pr, issue }) {
  if (config.review.mode === 'none') return null;
  const names = resolveLabelNames(config.labels);
  const has = (key) => issue.labels.includes(names[key]);
  const es = String(config.language ?? 'en').startsWith('es');

  if (event.kind === 'push') {
    if (!has('changes-requested')) return null;
    return { action: 'back-to-pr-open', labels: transition(issue.labels, 'pr-open', config.labels), comment: null };
  }

  if (event.kind !== 'review' || event.reviewer === pr.author) return null;

  if (event.state === 'changes_requested') {
    if (!has('pr-open') && !has('changes-requested')) return null;
    return {
      action: 'changes-requested',
      labels: transition(issue.labels, 'changes-requested', config.labels),
      comment: {
        kind: 'changes_requested',
        data: { author: pr.author, issue: issue.number, reviewer: event.reviewer, summary: summarise(event.body, es), pr: event.url ?? pr.url },
      },
    };
  }

  if (event.state === 'approved') {
    if (!has('pr-open')) return null;
    // Who runs `ship`: the approver with merger "approver", the author with merger "author".
    const recipient = config.review.merger === 'author' ? pr.author : event.reviewer;
    return {
      action: 'approved',
      labels: { add: [], remove: [] },
      comment: { kind: 'approved', data: { recipient, issue: issue.number, reviewer: event.reviewer, pr: pr.url } },
    };
  }
  return null;
}

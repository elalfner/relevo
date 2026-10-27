// Decides whether a pull request may be merged and what the person must still confirm.
// Implements openspec/specs/ship/spec.md.
//
// `pr` is the JSON of `gh pr view --json number,state,isDraft,mergeable,title,author,reviews,statusCheckRollup,headRefName,headRefOid,baseRefName`.

import { resolveLabelNames } from './labels.mjs';

const OK_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** Latest decisive review of each person: APPROVED, CHANGES_REQUESTED or DISMISSED. Plain comments never count. */
export function latestReviewStates(reviews = []) {
  const ordered = [...reviews].sort((a, b) => String(a.submittedAt ?? '').localeCompare(String(b.submittedAt ?? '')));
  const states = new Map();
  ordered.forEach((r) => {
    const login = r.author?.login;
    if (!login) return;
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) states.set(login, r.state);
  });
  return states;
}

/** Like latestReviewStates, with the commit each decisive review was given on: login -> { state, oid }. */
export function latestReviews(reviews = []) {
  const ordered = [...reviews].sort((a, b) => String(a.submittedAt ?? '').localeCompare(String(b.submittedAt ?? '')));
  const latest = new Map();
  ordered.forEach((r) => {
    const login = r.author?.login;
    if (!login) return;
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) latest.set(login, { state: r.state, oid: r.commit?.oid ?? null });
  });
  return latest;
}

// state of the issue -> the command that is missing
const MISSING_COMMAND = {
  built: '/relevo:review',
  'in-review': '/relevo:review',
  'qa-failed': '/relevo:fix',
  'changes-requested': '/relevo:fix',
};
const STATE_KEYS = ['ready', 'queued', 'building', 'built', 'in-review', 'pr-open', 'qa-failed', 'changes-requested', 'needs-spec', 'blocked'];

/** Summarise the checks of a pull request: none, passing, failing or pending. */
export function checkRollup(rollup = []) {
  if (!rollup || rollup.length === 0) return { state: 'none', failing: [], pending: [] };
  const failing = [];
  const pending = [];
  rollup.forEach((c) => {
    if (c.__typename === 'StatusContext') {
      if (['FAILURE', 'ERROR'].includes(c.state)) failing.push(c.context);
      else if (c.state !== 'SUCCESS') pending.push(c.context);
      return;
    }
    const name = c.name ?? 'a check';
    if (c.status !== 'COMPLETED') pending.push(name);
    else if (!OK_CONCLUSIONS.has(c.conclusion)) failing.push(name);
  });
  if (failing.length > 0) return { state: 'failing', failing, pending };
  if (pending.length > 0) return { state: 'pending', failing, pending };
  return { state: 'passing', failing, pending };
}

/**
 * config   effective configuration
 * pr       the pull request, or null when none exists for the branch
 * invoker  GitHub login of the person running ship
 * baseline optional: the head commit recorded when ship started; an approval given on it still counts
 * labels   optional: the names of the issue's labels; when given, the issue must be pr-open
 * issue    optional: the issue number, used in the messages about the state
 * baselineChecks optional: { archiveOnly, rollup } of the baseline. When the head differs from it only under
 *          `openspec/` (archiveOnly) and the head has no checks of its own, the baseline's checks are judged.
 * Returns { allowed, reasons, confirm, summary }.
 *   reasons  why it must stop (empty when allowed)
 *   confirm  what the person must still confirm in writing, always including "merge"
 */
export function shipDecision({ config, pr, invoker, baseline, labels, issue, baselineChecks }) {
  const reasons = [];
  const warnings = [];
  const confirm = ['merge'];

  if (!pr) {
    return { allowed: false, reasons: ['there is no pull request for this branch: it is opened by /relevo:review'], confirm: [], summary: null };
  }
  if (pr.state === 'MERGED') return { allowed: false, reasons: ['the pull request is already merged'], confirm: [], summary: null };
  if (pr.state === 'CLOSED') return { allowed: false, reasons: ['the pull request was closed without merging'], confirm: [], summary: null };
  if (pr.isDraft) reasons.push('the pull request is still a draft');

  if (labels) {
    const names = resolveLabelNames(config.labels);
    const state = STATE_KEYS.find((k) => labels.includes(names[k])) ?? null;
    if (state !== 'pr-open') {
      const command = MISSING_COMMAND[state] ?? '/relevo:review';
      reasons.push(`the issue is ${state ? `"${state}"` : 'not in a Relevo state'}, not "pr-open": run ${command}${issue ? ` ${issue}` : ''} first`);
    }
  }

  if (pr.mergeable === 'CONFLICTING') reasons.push('the pull request has conflicts: the author must synchronise the branch with the base branch');
  else if (pr.mergeable !== 'MERGEABLE') reasons.push('GitHub has not finished checking whether the pull request can be merged: try again in a minute');

  // A push with the workflow token starts no workflows, so the archive commit may have no checks: the checks of the
  // approved head still vouch for the code when only the specifications changed since.
  let checks = checkRollup(pr.statusCheckRollup);
  let checksFrom = 'head';
  if (checks.state === 'none' && baselineChecks?.archiveOnly) {
    const carried = checkRollup(baselineChecks.rollup);
    if (carried.state !== 'none') {
      checks = carried;
      checksFrom = 'baseline';
    }
  }
  if (checks.state === 'failing') reasons.push(`checks are failing: ${checks.failing.join(', ')}`);
  else if (checks.state === 'pending') reasons.push(`checks are still running: ${checks.pending.join(', ')}`);
  else if (checks.state === 'none') confirm.push('no-ci');

  const author = pr.author?.login;
  const mode = config.review.mode;
  let approvedBy = [];

  if (mode === 'peer' || mode === 'roles') {
    const latest = latestReviews(pr.reviews);
    const eligible = (login) => login !== author && (mode !== 'roles' || config.team.approvers.includes(login));
    const approvals = [...latest].filter(([login, r]) => r.state === 'APPROVED' && eligible(login));
    const stale = [];
    approvedBy = approvals
      .filter(([login, r]) => {
        if (!pr.headRefOid) return true;
        if (!r.oid) {
          if (!warnings.includes('review-commit-unknown')) warnings.push('review-commit-unknown');
          return true;
        }
        if (r.oid === pr.headRefOid || (baseline && r.oid === baseline)) return true;
        stale.push(`${login} (${r.oid.slice(0, 7)})`);
        return false;
      })
      .map(([login]) => login);
    const changesBy = [...latest].filter(([, r]) => r.state === 'CHANGES_REQUESTED').map(([login]) => login);
    if (stale.length > 0) reasons.push(`the approval of ${stale.join(', ')} was given on an older commit than the current ${pr.headRefOid.slice(0, 7)}: a new approval is needed on the current code`);

    if (changesBy.length > 0) reasons.push(`changes were requested by ${changesBy.join(', ')} and not yet resolved`);
    if (approvedBy.length === 0) {
      reasons.push(mode === 'roles' ? 'waiting for an approval from one of the approvers (someone other than the author)' : 'waiting for an approval from someone other than the author');
    }

    if (config.review.merger === 'approver' && invoker === author) {
      const peers = approvedBy.length > 0 ? approvedBy : config.team.members.filter((m) => m !== author && m !== config.team.spec_writer);
      reasons.push(`the author cannot run ship here (review.merger is "approver"): ${peers.join(' or ')} should run it`);
    } else if (config.review.merger === 'approver') {
      const { spec_writer: writer, members, approvers } = config.team;
      let eligibleToRun = true;
      if (invoker === writer) {
        reasons.push('the spec writer never reviews or merges: someone else should run ship');
        eligibleToRun = false;
      } else if (members.length > 0 && !members.includes(invoker)) {
        reasons.push(`${invoker} is not listed in team.members: only members run ship`);
        eligibleToRun = false;
      } else if (mode === 'roles' && !approvers.includes(invoker)) {
        reasons.push(`${invoker} is not one of the approvers (team.approvers): one of them should run ship`);
        eligibleToRun = false;
      }
      if (eligibleToRun && approvedBy.length > 0 && !approvedBy.includes(invoker)) confirm.push('not-approver');
    }
    if (config.review.merger === 'author' && invoker !== author) {
      reasons.push(`the author (${author}) runs ship here (review.merger is "author")`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    confirm,
    summary: { pr: pr.number, title: pr.title, author, branch: pr.headRefName, base: pr.baseRefName, head: pr.headRefOid ?? null, mode, approvedBy, checks: checks.state, checksFrom, ...(warnings.length > 0 ? { warnings } : {}) },
  };
}

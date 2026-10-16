// Decides whether a pull request may be merged and what the person must still confirm.
// Implements openspec/specs/ship/spec.md.
//
// `pr` is the JSON of `gh pr view --json number,state,isDraft,mergeable,title,author,reviews,statusCheckRollup,headRefName,baseRefName`.

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
 * Returns { allowed, reasons, confirm, summary }.
 *   reasons  why it must stop (empty when allowed)
 *   confirm  what the person must still confirm in writing, always including "merge"
 */
export function shipDecision({ config, pr, invoker }) {
  const reasons = [];
  const confirm = ['merge'];

  if (!pr) {
    return { allowed: false, reasons: ['there is no pull request for this branch: it is opened by /relevo:review'], confirm: [], summary: null };
  }
  if (pr.state === 'MERGED') return { allowed: false, reasons: ['the pull request is already merged'], confirm: [], summary: null };
  if (pr.state === 'CLOSED') return { allowed: false, reasons: ['the pull request was closed without merging'], confirm: [], summary: null };
  if (pr.isDraft) reasons.push('the pull request is still a draft');

  if (pr.mergeable === 'CONFLICTING') reasons.push('the pull request has conflicts: the author must synchronise the branch with the base branch');
  else if (pr.mergeable !== 'MERGEABLE') reasons.push('GitHub has not finished checking whether the pull request can be merged: try again in a minute');

  const checks = checkRollup(pr.statusCheckRollup);
  if (checks.state === 'failing') reasons.push(`checks are failing: ${checks.failing.join(', ')}`);
  else if (checks.state === 'pending') reasons.push(`checks are still running: ${checks.pending.join(', ')}`);
  else if (checks.state === 'none') confirm.push('no-ci');

  const author = pr.author?.login;
  const mode = config.review.mode;
  let approvedBy = [];

  if (mode === 'peer' || mode === 'roles') {
    const states = latestReviewStates(pr.reviews);
    const eligible = (login) => login !== author && (mode !== 'roles' || config.team.approvers.includes(login));
    approvedBy = [...states].filter(([login, state]) => state === 'APPROVED' && eligible(login)).map(([login]) => login);
    const changesBy = [...states].filter(([, state]) => state === 'CHANGES_REQUESTED').map(([login]) => login);

    if (changesBy.length > 0) reasons.push(`changes were requested by ${changesBy.join(', ')} and not yet resolved`);
    if (approvedBy.length === 0) {
      reasons.push(mode === 'roles' ? 'waiting for an approval from one of the approvers (someone other than the author)' : 'waiting for an approval from someone other than the author');
    }

    if (config.review.merger === 'approver' && invoker === author) {
      const peers = approvedBy.length > 0 ? approvedBy : config.team.members.filter((m) => m !== author && m !== config.team.spec_writer);
      reasons.push(`the author cannot run ship here (review.merger is "approver"): ${peers.join(' or ')} should run it`);
    }
    if (config.review.merger === 'author' && invoker !== author) {
      reasons.push(`the author (${author}) runs ship here (review.merger is "author")`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    confirm,
    summary: { pr: pr.number, title: pr.title, author, branch: pr.headRefName, base: pr.baseRefName, mode, approvedBy, checks: checks.state },
  };
}

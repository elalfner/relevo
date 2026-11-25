// What `go` does with an issue of a files project. The planner of a team (plan.mjs) weighs a milestone, an assignee, the capacity
// of a reviewer and a queue; a files project has none of them, so this one asks only what can stop one person's build: the issue
// is open and approved, the approved text is the text that is there, the text is complete, the dependencies are shipped and the
// platform is known. It returns the decision in the shape of plan.mjs, so that `go` reads the same fields.
// Implements "Go reads and moves the issue through the tracker" and "There are no roles, assignees, milestones or queue".

import { branchName, changeId } from './branch.mjs';
import { checkIssueDraft } from './issue-check.mjs';
import { issueHash } from './issue-hash.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { resolveLabelNames } from './labels.mjs';
import { resolvePlatform } from './platform-of.mjs';
import { stallBlock } from './resume-gate.mjs';

/**
 * @param {{ config: object, tracker: object, only?: number|null, retry?: boolean, resume?: boolean, hasBranch?: (n: number) => boolean, resumeCheck?: (n: number) => ({ state: string, reason: string|null }|null), stalled?: (n: number) => ({ turns: number, minutes: number, cost: number }|null) }} input
 *   `tracker` is the files backend; `hasBranch` says whether a build already left a branch for the issue (for `--retry` and `--resume`).
 *   `--resume` continues a failed build from its branch when `resumeCheck` (the answer of resume-check.mjs) says `resume`, unless the last resume finished
 *   no task and no limit of the configuration is higher than the one `stalled` recorded.
 * @returns {{ decisions: object[], summary: Record<string, number> }}
 */
export function planFiles({ config, tracker, only = null, retry = false, resume = false, hasBranch = () => false, resumeCheck = () => null, stalled = () => null }) {
  const names = resolveLabelNames(config.labels);
  const issues = tracker.issueList({ state: 'all', fields: 'number,title,body,state,labels' })
    .filter((i) => only === null || i.number === only);
  const decisions = [];
  const out = (issue, action, reason, extra = {}) => decisions.push({ issue: issue.number, action, reason, labels: { add: [], remove: [] }, ...extra });
  const has = (issue, key) => issue.labels.some((l) => l.name === names[key]);

  if (only !== null && issues.length === 0) {
    return { decisions: [{ issue: only, action: 'skip', reason: `there is no issue ${only}: no .relevo/issues/${only}.md`, labels: { add: [], remove: [] } }], summary: { skip: 1 } };
  }

  for (const issue of issues) {
    if (issue.state !== 'OPEN') { out(issue, 'skip', 'the issue is closed'); continue; }
    if (has(issue, 'building')) { out(issue, 'skip', 'it is already being built (go_building)'); continue; }
    if (['built', 'in-review'].some((k) => has(issue, k))) { out(issue, 'skip', 'it was already built: use /relevo:fix to correct it (go_already_built)'); continue; }

    const failed = has(issue, 'build-failed');
    if (failed && resume) {
      if (!hasBranch(issue.number)) { out(issue, 'skip', 'there is nothing to continue: the issue has no branch, so --retry builds it from the beginning'); continue; }
      const answer = resumeCheck(issue.number);
      if (answer?.state !== 'resume') { out(issue, 'skip', `the branch of the issue cannot be resumed${answer?.reason ? `: ${answer.reason}` : ''}`); continue; }
      const block = stallBlock(stalled(issue.number), config.limits);
      if (block) { out(issue, 'skip', `the last resume finished no task: raise one of ${block.raise.map((k) => `limits.${k}`).join(', ')} in relevo.yml, or split the issue`); continue; }
    } else if (failed && !retry) { out(issue, 'skip', 'the last build failed: run it again with --retry when nothing was pushed, or /relevo:fix when there is a branch (go_use_fix)'); continue; }
    if (failed && !resume && hasBranch(issue.number)) { out(issue, 'skip', 'the issue has a branch: correct it with /relevo:fix (go_use_fix)'); continue; }
    if (!failed && !has(issue, 'ready') && !has(issue, 'queued')) { out(issue, 'skip', 'the issue is not approved: apply ready first (go_needs_ready)'); continue; }

    // An issue that was ready and failed is approved again by the person who retries it, so the hash is taken now.
    if (!failed) {
      const approval = tracker.approvalCheck(issue.number);
      if (!approval.ok) { out(issue, 'skip', 'issue changed after ready: approve it again before it is built'); continue; }
    }

    const full = tracker.issueGet(issue.number);
    const check = checkIssueDraft({ title: full.title, body: full.body, platforms: config.platforms, links: [] });
    if (!check.ok) {
      out(issue, 'needs-spec', 'the issue is not complete enough to build', { missing: check.problems, labels: { add: [names['needs-spec']], remove: [names.ready, names.queued, names['build-failed']] } });
      continue;
    }
    const deps = tracker.dependencyCheck(issue.number);
    if (deps.missing.length > 0 || deps.external.length > 0) {
      out(issue, 'needs-spec', 'a dependency cannot be met', { missing: deps.problems.filter((p) => !p.startsWith('waiting')), labels: { add: [names['needs-spec']], remove: [names.ready, names.queued, names['build-failed']] } });
      continue;
    }
    if (deps.waiting.length > 0) { out(issue, 'skip', `waiting for ${deps.waiting.map((d) => `#${d}`).join(', ')} to be shipped`, { blockers: deps.waiting }); continue; }
    const platform = resolvePlatform({ platforms: config.platforms, body: full.body });
    if (!platform.ok) {
      out(issue, 'needs-spec', platform.message, { missing: [platform.message], labels: { add: [names['needs-spec']], remove: [names.ready, names.queued, names['build-failed']] } });
      continue;
    }

    const parsed = parseIssueBody(full.body);
    out(issue, 'start', 'all gates passed', {
      // `building` and `local` in one change, as a claim on a machine does.
      labels: { add: [names.building, names.local], remove: [names.ready, names.queued, names['build-failed']] },
      branch: branchName(issue.number, full.title),
      change_id: changeId(issue.number, full.title),
      base: config.branches.base,
      assignee: null,
      spec_writer: null,
      title: full.title,
      qa_retries: config.qa.retries,
      run_max_turns: config.limits.run_max_turns,
      run_max_minutes: config.limits.run_max_minutes,
      run_max_cost: config.limits.run_max_cost,
      issue_hash: issueHash({ title: full.title, body: full.body }),
      allow_paths: parsed.allowPaths,
      platform: platform.name,
      stack: platform.entry.stack,
      path: platform.entry.path,
      targets: platform.entry.targets,
    });
  }
  const summary = {};
  decisions.forEach((d) => { summary[d.action] = (summary[d.action] ?? 0) + 1; });
  return { decisions, summary };
}

/** Carries the decisions out through the tracker: the labels, and a comment that says why an issue went back. Returns how many changed. */
export function applyFiles(decisions, { tracker, includeStart = false }) {
  let applied = 0;
  decisions.forEach((d) => {
    if (d.action === 'start' && !includeStart) return;
    const { add = [], remove = [] } = d.labels ?? {};
    if (add.length + remove.length > 0) { tracker.stateSet(d.issue, { add, remove }); applied += 1; }
    if (d.action === 'needs-spec') tracker.commentAdd(d.issue, `Sent back: ${d.reason}.\n\n${(d.missing ?? []).map((m) => `- ${m}`).join('\n')}`);
  });
  return applied;
}

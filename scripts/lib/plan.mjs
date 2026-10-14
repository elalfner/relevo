// Decides what `go` does with every candidate issue. Pure function: data in, decisions out.
// Implements openspec/changes/relevo-v1/specs/go/spec.md (trigger, gates, queue, limits).
//
// Input:
//   config     effective configuration (see config.mjs)
//   issues     [{ number, title, body, state, labels: [names], assignees: [logins],
//                 milestone: { number, due_on } | null,
//                 ready_at: ISO | null,   // when the ready label was last applied
//                 ready_by: login | null  // who applied it }]
//   completed  issue numbers closed as completed (their pull request merged)
//   running    issue numbers with an agent run in progress
//   permissions  { login: 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' }
//
// Output: { decisions: [...], summary }, in the order the issues were processed.

import { parseIssueBody } from './issue-parse.mjs';
import { resolveLabelNames, transition } from './labels.mjs';
import { branchName, changeId } from './branch.mjs';

const MAY_TRIGGER = new Set(['admin', 'maintain', 'write']);
// In a public repository only maintainers may start work: anyone with write access could otherwise start a
// run from an issue written by a stranger.
const MAY_TRIGGER_PUBLIC = new Set(['admin', 'maintain']);

function byReadyAt(a, b) {
  const ta = a.ready_at ? Date.parse(a.ready_at) : Number.POSITIVE_INFINITY;
  const tb = b.ready_at ? Date.parse(b.ready_at) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.number - b.number;
}

export function planGo({ config, issues, completed = [], running = [], permissions = {} }) {
  const names = resolveLabelNames(config.labels);
  const has = (issue, key) => issue.labels.includes(names[key]);
  const open = issues.filter((i) => i.state === 'open');
  const completedSet = new Set(completed);

  const runningSet = new Set(running);
  open.filter((i) => has(i, 'building')).forEach((i) => runningSet.add(i.number));
  let freeSlots = Math.max(0, config.limits.concurrent_agents - runningSet.size);

  const builtBy = new Map();
  open.filter((i) => has(i, 'built')).forEach((i) => {
    const owner = i.assignees[0];
    if (owner) builtBy.set(owner, (builtBy.get(owner) ?? 0) + 1);
  });

  const candidates = open
    .filter((i) => has(i, 'ready') || has(i, 'queued') || has(i, 'blocked'))
    .sort(byReadyAt);

  const decisions = [];

  function decision(issue, action, reason, extra = {}) {
    const labels = extra.labels ?? { add: [], remove: [] };
    const out = {
      issue: issue.number,
      action,
      reason,
      labels,
      comment: extra.comment ?? null,
      assign: extra.assign ?? null,
    };
    if (action === 'start') Object.assign(out, extra.start);
    decisions.push(out);
  }

  const moveTo = (issue, key) => transition(issue.labels, key, config.labels);
  const dropReady = (issue) => ({ add: [], remove: issue.labels.filter((l) => l === names.ready) });

  candidates.forEach((issue) => {
    if (runningSet.has(issue.number)) {
      decision(issue, 'skip', 'an agent is already running for this issue');
      return;
    }

    const parsed = parseIssueBody(issue.body);
    const assignee = issue.assignees[0] ?? null;

    if (has(issue, 'ready')) {
      // Trigger: only people with write access may start work.
      const permission = issue.ready_by ? permissions[issue.ready_by] : undefined;
      const isPublic = config.trust === 'public';
      if (!issue.ready_by || !(isPublic ? MAY_TRIGGER_PUBLIC : MAY_TRIGGER).has(permission)) {
        decision(issue, 'denied', isPublic ? 'the ready label was not applied by a maintainer (trust is public)' : 'the ready label was not applied by someone with write access', {
          labels: dropReady(issue),
          comment: { kind: isPublic ? 'ready_denied_maintainer' : 'ready_denied', data: { issue: issue.number, actor: issue.ready_by ?? undefined } },
        });
        return;
      }
      if (!issue.milestone) {
        decision(issue, 'no-milestone', 'the issue has no milestone', {
          labels: dropReady(issue),
          comment: { kind: 'no_milestone', data: { issue: issue.number, actor: issue.ready_by } },
        });
        return;
      }
      if (!assignee) {
        decision(issue, 'no-assignee', 'the issue has no assignee', {
          labels: dropReady(issue),
          comment: { kind: 'no_assignee', data: { issue: issue.number, actor: issue.ready_by } },
        });
        return;
      }
      // Gate 1: the spec. The agent never invents scenarios.
      if (parsed.missing.length > 0) {
        const specWriter = config.team.spec_writer ?? issue.ready_by;
        decision(issue, 'needs-spec', `the spec is incomplete: ${parsed.missing.join('; ')}`, {
          labels: moveTo(issue, 'needs-spec'),
          assign: [specWriter],
          comment: {
            kind: 'needs_spec',
            data: { spec_writer: specWriter, issue: issue.number, title: issue.title, missing: parsed.missing.join('; ') },
          },
        });
        return;
      }
    }

    // Gate 2: dependencies must be merged.
    const blockers = parsed.dependsOn.filter((n) => !completedSet.has(n));
    if (blockers.length > 0) {
      const entering = !has(issue, 'blocked');
      decision(issue, 'block', `waiting for ${blockers.map((n) => `#${n}`).join(', ')}`, {
        labels: moveTo(issue, 'blocked'),
        comment: entering
          ? { kind: 'blocked_notice', data: { issue: issue.number, title: issue.title, blockers: blockers.map((n) => `#${n}`).join(', ') } }
          : null,
      });
      return;
    }

    // Gate 3: capacity of the assignee.
    const built = assignee ? builtBy.get(assignee) ?? 0 : 0;
    if (assignee && built >= config.limits.built_unreviewed_per_person) {
      decision(issue, 'queue', `${assignee} already has ${built} built issues waiting for review`, {
        labels: moveTo(issue, 'queued'),
        comment: has(issue, 'queued')
          ? null
          : { kind: 'queued_capacity', data: { issue: issue.number, title: issue.title, assignee, built, limit: config.limits.built_unreviewed_per_person } },
      });
      return;
    }

    // Global limit on concurrent agents.
    if (freeSlots <= 0) {
      decision(issue, 'queue', 'the limit of concurrent agents is reached', {
        labels: moveTo(issue, 'queued'),
        comment: has(issue, 'queued') ? null : { kind: 'queued_agents', data: { issue: issue.number, title: issue.title } },
      });
      return;
    }

    freeSlots -= 1;
    runningSet.add(issue.number);
    decision(issue, 'start', 'all gates passed', {
      labels: moveTo(issue, 'building'),
      start: {
        branch: branchName(issue.number, issue.title),
        change_id: changeId(issue.number, issue.title),
        base: config.branches.base,
        assignee,
        title: issue.title,
        qa_retries: config.qa.retries,
        run_max_turns: config.limits.run_max_turns,
        run_max_cost: config.limits.run_max_cost,
      },
    });
  });

  const summary = {};
  decisions.forEach((d) => {
    summary[d.action] = (summary[d.action] ?? 0) + 1;
  });
  return { decisions, summary };
}

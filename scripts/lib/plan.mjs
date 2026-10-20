// Decides what `go` does with every candidate issue. Pure function: data in, decisions out.
// Implements openspec/specs/go/spec.md (trigger, gates, queue, limits).
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
import { issueHash } from './issue-hash.mjs';
import { resolvePlatform } from './platform-of.mjs';

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

/**
 * Without a model credential in the repository the cloud cannot build: a `start` decision becomes `local`, which
 * claims nothing and moves no label, and says to run `go` on a machine or to add the secret.
 * Every other decision is returned as it is.
 */
export function withoutCredential(decisions, issues = []) {
  return decisions.map((d) => {
    if (d.action !== 'start') return d;
    const issue = issues.find((i) => i.number === d.issue);
    return {
      issue: d.issue,
      action: 'local',
      reason: 'the repository has no model credential, so the cloud cannot build it',
      labels: { add: [], remove: [] },
      comment: { kind: 'cloud_not_configured', data: { issue: d.issue, actor: issue?.ready_by ?? d.assignee } },
      assign: null,
    };
  });
}

export function planGo({ config, issues, completed = [], completedExternal = [], unreadable = [], repo = null, running = [], permissions = {} }) {
  const names = resolveLabelNames(config.labels);
  const has = (issue, key) => issue.labels.includes(names[key]);
  const open = issues.filter((i) => i.state === 'open');
  const completedSet = new Set(completed);
  const completedExternalSet = new Set(completedExternal.map((r) => r.toLowerCase()));
  const unreadableSet = new Set(unreadable.map((r) => r.toLowerCase()));
  const linked = (config.links ?? []);
  const own = repo ? repo.toLowerCase() : null;

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
    // The platform the issue is for. When it cannot be resolved that is a missing part of the specification.
    const platform = resolvePlatform({ platforms: config.platforms, body: issue.body });
    // Dependencies: the own repository in full is a local reference; a repository outside `links` is a missing part
    // of the specification (nothing is read from it); a token that is not a reference is too.
    const localDeps = [...parsed.dependsOn];
    const externalDeps = [];
    parsed.dependsOnExternal.forEach((d) => {
      if (own && d.repo.toLowerCase() === own) {
        if (!localDeps.includes(d.number)) localDeps.push(d.number);
      } else externalDeps.push(d);
    });
    const linkProblems = [
      ...parsed.dependsOnInvalid.map((t) => `a valid Depends-on reference instead of "${t}" (write #12, or owner/repo#12 for a linked repository)`),
      ...[...new Set(externalDeps.map((d) => d.repo))].filter((r) => !linked.some((l) => l.toLowerCase() === r.toLowerCase()))
        .map((r) => `a Depends-on that names ${r}, which is not in links of relevo.yml (${linked.length ? linked.join(', ') : 'no repository is linked'})`),
    ];
    // A question left open in the issue is an ambiguity, not a missing part: the writer has to decide, not just add text.
    const openQuestion = parsed.openQuestions[0]?.replace(/^[-*+]\s+/, '').slice(0, 120);
    const ambiguity = [
      ...(openQuestion ? [`an answer to the open question "${openQuestion}"`] : []),
      ...(parsed.needsClarification ? ['the text NEEDS CLARIFICATION resolved'] : []),
    ];
    const missing = [...parsed.missing, ...(platform.ok ? [] : [platform.message]), ...linkProblems, ...ambiguity];
    const needsSpec = () => {
      const specWriter = config.team.spec_writer ?? issue.ready_by;
      decision(issue, 'needs-spec', `the spec is incomplete: ${missing.join('; ')}`, {
        labels: moveTo(issue, 'needs-spec'),
        assign: [specWriter],
        comment: {
          kind: 'needs_spec',
          data: { spec_writer: specWriter, issue: issue.number, title: issue.title, missing: missing.join('; '), reason: ambiguity.length > 0 ? 'ambiguous' : 'missing' },
        },
      });
    };

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
      if (missing.length > 0) {
        needsSpec();
        return;
      }
    }

    // An issue that was edited after it passed the gate can still name a repository that is not linked.
    if (linkProblems.length > 0) {
      needsSpec();
      return;
    }

    // Gate 2: dependencies must be merged, in this repository or in a linked one.
    const blockers = [
      ...localDeps.filter((n) => !completedSet.has(n)).map((n) => `#${n}`),
      ...externalDeps.filter((d) => !completedExternalSet.has(`${d.repo}#${d.number}`.toLowerCase()))
        .map((d) => {
          const ref = `${d.repo}#${d.number}`;
          return unreadableSet.has(ref.toLowerCase()) ? `${ref} (could not be read: check the RELEVO_LINKS_TOKEN secret and that ${d.repo} is in links)` : ref;
        }),
    ];
    if (blockers.length > 0) {
      const entering = !has(issue, 'blocked');
      decision(issue, 'block', `waiting for ${blockers.join(', ')}`, {
        labels: moveTo(issue, 'blocked'),
        comment: entering
          ? { kind: 'blocked_notice', data: { issue: issue.number, title: issue.title, blockers: blockers.join(', ') } }
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

    // A queued or blocked issue was edited after it passed the gate: it goes back for the platform, not to a build.
    if (!platform.ok) {
      needsSpec();
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
        // The text the issue had when it was claimed: `go` checks it before it writes the specification.
        issue_hash: issueHash({ title: issue.title, body: issue.body }),
        // Dependency files the issue lets the change touch (see "Protected paths").
        allow_paths: parsed.allowPaths,
        // Which platform the build is for: the agents use its profile, its folder and its targets.
        platform: platform.name,
        stack: platform.entry.stack,
        path: platform.entry.path,
        targets: platform.entry.targets,
      },
    });
  });

  const summary = {};
  decisions.forEach((d) => {
    summary[d.action] = (summary[d.action] ?? 0) + 1;
  });
  return { decisions, summary };
}

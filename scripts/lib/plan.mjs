// Decides what `go` does with every candidate issue. Pure function: data in, decisions out.
// Implements openspec/specs/go/spec.md (trigger, gates, queue, limits).
//
// Input:
//   config     effective configuration (see config.mjs)
//   issues     [{ number, title, body, state, labels: [names], assignees: [logins],
//                 milestone: { number, due_on } | null,
//                 ready_at: ISO | null,   // when the ready label was last applied
//                 ready_by: login | null, // who applied it
//                 urgent_by: login | null // who applied the urgent label, when the issue carries it }]
//   completed  issue numbers closed as completed (their pull request merged)
//   running    issue numbers with an agent run in progress
//   permissions  { login: 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' }
//   now        ms since the epoch (the clock of the plan; the tests give it)
//   (an issue may carry `limit_retry: { at, attempt, reason }`: the retry time that the comment of a usage limit gave, `at` in ms; see limit-retry.mjs)
//   retry      { issue, by } | null  the person `by` retries the `qa-failed` issue `issue`: it is planned as if `by` had made it `ready`
//
// Output: { decisions: [...], summary }, in the order the issues were processed.

import { namedFiles, parseIssueBody, sharedFiles } from './issue-parse.mjs';
import { resolveLabelNames, transition } from './labels.mjs';
import { branchName, changeId } from './branch.mjs';
import { issueHash } from './issue-hash.mjs';
import { resolvePlatform } from './platform-of.mjs';
import { EPISODE_MS } from './limit-retry.mjs';

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

export function planGo({ config, issues, completed = [], completedExternal = [], unreadable = [], repo = null, running = [], permissions = {}, retry = null, recentBuilds = null, now = Date.now() }) {
  const names = resolveLabelNames(config.labels);
  const has = (issue, key) => issue.labels.includes(names[key]);
  const open = issues.filter((i) => i.state === 'open');
  const completedSet = new Set(completed);
  const completedExternalSet = new Set(completedExternal.map((r) => r.toLowerCase()));
  const unreadableSet = new Set(unreadable.map((r) => r.toLowerCase()));
  const linked = (config.links ?? []);
  const own = repo ? repo.toLowerCase() : null;

  // The urgent label is a request that only the people who may start work can make. A label from anyone else is not
  // valid: it is removed (with a notice) and the issue is evaluated as a normal one.
  const mayTrigger = config.trust === 'public' ? MAY_TRIGGER_PUBLIC : MAY_TRIGGER;
  const hasUrgentLabel = (issue) => has(issue, 'urgent');
  const isUrgent = (issue) => hasUrgentLabel(issue) && Boolean(issue.urgent_by) && mayTrigger.has(permissions[issue.urgent_by]);

  const runningSet = new Set(running);
  open.filter((i) => has(i, 'building')).forEach((i) => runningSet.add(i.number));
  let freeSlots = Math.max(0, config.limits.concurrent_agents - runningSet.size);

  const builtBy = new Map();
  const builtIssues = new Map();
  open.filter((i) => has(i, 'built')).forEach((i) => {
    const owner = i.assignees[0];
    if (owner) {
      builtBy.set(owner, (builtBy.get(owner) ?? 0) + 1);
      builtIssues.set(owner, [...(builtIssues.get(owner) ?? []), i.number]);
    }
  });

  // What a person who waits for a free agent is told: how many runs are active and which, how many issues wait before this one,
  // and how long the recent builds took. Only what was read: the durations come from the caller (null when they could not be read;
  // fewer than three are too few to call typical) and nothing is estimated.
  const MIN_BUILDS = 3;
  // `recentBuilds` is a list of minutes or a function that reads it (called at most once, and only when an issue is queued for an agent).
  let typicalOnce;
  const typicalBuild = () => {
    if (typicalOnce !== undefined) return typicalOnce;
    let list = null;
    try {
      list = typeof recentBuilds === 'function' ? recentBuilds() : recentBuilds;
    } catch {
      list = null;
    }
    const sorted = Array.isArray(list) ? list.filter((m) => Number.isFinite(m) && m >= 0).sort((a, b) => a - b) : [];
    const mid = sorted.length / 2;
    typicalOnce = sorted.length >= MIN_BUILDS
      ? { minutes: Math.round(sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2), samples: sorted.length }
      : null;
    return typicalOnce;
  };
  let waitingForAgent = 0;

  // Valid urgent issues are considered first, so they take the free agent slots before the others; inside each group
  // the order is the time `ready` was applied.
  // A retry stands in for `ready`: the issue is `qa-failed`, the person who runs it takes the place of who applied the label.
  const isRetry = (issue) => Boolean(retry) && retry.issue === issue.number && has(issue, 'qa-failed');
  const startedBy = (issue) => (isRetry(issue) ? retry.by : issue.ready_by);

  // An issue that waits for a usage limit to reset: `queued` with a retry time that has not come. It is held: it takes no slot and says nothing.
  const holdsForLimit = (issue) => has(issue, 'queued') && Boolean(issue.limit_retry) && issue.limit_retry.at > now;
  // An issue that is retrying after a usage limit and is due. Only one such issue runs at a time: the first shows whether the quota is back.
  const retrying = (issue) => has(issue, 'queued') && Boolean(issue.limit_retry);
  let probeBusy = open.some((i) => has(i, 'building') && i.limit_retry && now - i.limit_retry.at <= EPISODE_MS);

  const candidates = open
    .filter((i) => has(i, 'ready') || has(i, 'queued') || has(i, 'blocked') || isRetry(i))
    .sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || byReadyAt(a, b));

  const decisions = [];

  // Files that issues name (see "Gate 4, files shared with another issue"): an issue that is active holds them until it is
  // merged, and so does a candidate ahead of the issue that is waiting or about to start.
  const ACTIVE_KEYS = ['building', 'built', 'in-review', 'pr-open', 'changes-requested'];
  const activeIssues = open.filter((i) => ACTIVE_KEYS.some((k) => has(i, k))).sort((a, b) => a.number - b.number);
  const byNumber = new Map(open.map((i) => [i.number, i]));
  const named = new Map();
  const filesOf = (i) => {
    if (!named.has(i.number)) named.set(i.number, namedFiles(i.body));
    return named.get(i.number);
  };
  const exclude = [...(config.queue?.append_only ?? []), ...(config.integration?.generated ?? [])];
  const waitMs = (config.limits.shared_file_wait_hours ?? 24) * 3600 * 1000;
  const nowMs = new Date(now).getTime();

  function decision(issue, action, reason, extra = {}) {
    let labels = extra.labels ?? { add: [], remove: [] };
    const out = {
      issue: issue.number,
      action,
      reason,
      labels,
      comment: extra.comment ?? null,
      assign: extra.assign ?? null,
    };
    // An urgent label that is not valid is removed in the decision of the issue, with its own notice. An issue whose
    // run is in progress is left alone.
    if (action !== 'skip' && hasUrgentLabel(issue) && !isUrgent(issue)) {
      labels = { add: labels.add, remove: [...labels.remove, names.urgent] };
      out.labels = labels;
      out.notice = {
        kind: config.trust === 'public' ? 'urgent_denied_maintainer' : 'urgent_denied',
        data: { issue: issue.number, ...(issue.urgent_by ? { actor: issue.urgent_by } : {}) },
      };
    }
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

    if (holdsForLimit(issue)) {
      decision(issue, 'skip', `the usage limit of the model account has not reset: it retries after ${new Date(issue.limit_retry.at).toISOString()}`);
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
      const specWriter = config.team.spec_writer ?? startedBy(issue);
      decision(issue, 'needs-spec', `the spec is incomplete: ${missing.join('; ')}`, {
        labels: moveTo(issue, 'needs-spec'),
        assign: [specWriter],
        comment: {
          kind: 'needs_spec',
          data: { spec_writer: specWriter, issue: issue.number, title: issue.title, missing: missing.join('; '), reason: ambiguity.length > 0 ? 'ambiguous' : 'missing' },
        },
      });
    };

    if (has(issue, 'ready') || isRetry(issue)) {
      // Trigger: only people with write access may start work.
      const by = startedBy(issue);
      const permission = by ? permissions[by] : undefined;
      const isPublic = config.trust === 'public';
      if (!by || !(isPublic ? MAY_TRIGGER_PUBLIC : MAY_TRIGGER).has(permission)) {
        decision(issue, 'denied', isPublic ? 'the ready label was not applied by a maintainer (trust is public)' : 'the ready label was not applied by someone with write access', {
          labels: dropReady(issue),
          comment: { kind: isPublic ? 'ready_denied_maintainer' : 'ready_denied', data: { issue: issue.number, actor: by ?? undefined } },
        });
        return;
      }
      if (!issue.milestone) {
        decision(issue, 'no-milestone', 'the issue has no milestone', {
          labels: dropReady(issue),
          comment: { kind: 'no_milestone', data: { issue: issue.number, actor: by } },
        });
        return;
      }
      if (!assignee) {
        decision(issue, 'no-assignee', 'the issue has no assignee', {
          labels: dropReady(issue),
          comment: { kind: 'no_assignee', data: { issue: issue.number, actor: by } },
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
          ? { kind: 'blocked_notice', data: { issue: issue.number, title: issue.title, blockers: blockers.join(', '), ...(isUrgent(issue) ? { urgent: true } : {}) } }
          : null,
      });
      return;
    }

    // Gate 4: a file that another issue names. The issues that hold files are the active ones and the candidates ahead
    // of this one that are waiting or about to start; an issue that names no file is never held. The wait is bounded.
    let sharedPassed = [];
    const mine = filesOf(issue);
    if (mine.length > 0) {
      const holders = [...activeIssues, ...decisions.filter((d) => d.action === 'start' || d.action === 'queue').map((d) => byNumber.get(d.issue)).filter(Boolean)]
        .filter((h, i, all) => h.number !== issue.number && all.findIndex((x) => x.number === h.number) === i);
      const collisions = holders.map((h) => ({ other: h.number, files: sharedFiles(mine, filesOf(h), { exclude }) })).filter((c) => c.files.length > 0);
      if (collisions.length > 0) {
        const first = { file: collisions[0].files[0], other: collisions[0].other };
        const prior = issue.shared_wait;
        const same = Boolean(prior) && prior.file === first.file && prior.other === first.other;
        const expired = same && Boolean(prior.at) && nowMs - new Date(prior.at).getTime() >= waitMs;
        if (!expired) {
          decision(issue, 'queue', `#${first.other} names ${first.file} too and is not merged`, {
            labels: moveTo(issue, 'queued'),
            comment: same
              ? null
              : { kind: 'queued_shared_files', data: { issue: issue.number, title: issue.title, file: first.file, other: first.other, hours: config.limits.shared_file_wait_hours ?? 24 } },
          });
          return;
        }
        sharedPassed = collisions.flatMap((c) => c.files.map((file) => ({ file, issue: c.other })));
      }
    }

    // Gate 3: capacity of the assignee. A valid urgent label skips this gate and no other.
    const built = assignee ? builtBy.get(assignee) ?? 0 : 0;
    const overCapacity = Boolean(assignee) && built >= config.limits.built_unreviewed_per_person;
    const urgent = isUrgent(issue);
    if (overCapacity && !urgent) {
      decision(issue, 'queue', `${assignee} already has ${built} built issues waiting for review`, {
        labels: moveTo(issue, 'queued'),
        comment: has(issue, 'queued')
          ? null
          : { kind: 'queued_capacity', data: { issue: issue.number, title: issue.title, assignee, built, limit: config.limits.built_unreviewed_per_person, built_issues: builtIssues.get(assignee).map((n) => `#${n}`).join(', ') } },
      });
      return;
    }

    // A retry after a usage limit starts alone: the others wait until it ends (the queue is evaluated when it does).
    if (retrying(issue) && probeBusy) {
      decision(issue, 'skip', 'another issue that retries after a usage limit is running or starting');
      return;
    }

    // Global limit on concurrent agents.
    if (freeSlots <= 0) {
      const active = [...runningSet].sort((a, b) => a - b);
      const typical = has(issue, 'queued') ? null : typicalBuild();
      decision(issue, 'queue', 'the limit of concurrent agents is reached', {
        labels: moveTo(issue, 'queued'),
        comment: has(issue, 'queued')
          ? null
          : {
              kind: 'queued_agents',
              data: {
                issue: issue.number,
                title: issue.title,
                active: active.length,
                ...(active.length > 0 ? { active_issues: active.map((n) => `#${n}`).join(', ') } : {}),
                ahead: waitingForAgent,
                ...(typical ? { typical_minutes: typical.minutes, typical_samples: typical.samples } : {}),
              },
            },
      });
      waitingForAgent += 1;
      return;
    }

    // A queued or blocked issue was edited after it passed the gate: it goes back for the platform, not to a build.
    if (!platform.ok) {
      needsSpec();
      return;
    }

    freeSlots -= 1;
    runningSet.add(issue.number);
    if (retrying(issue)) probeBusy = true;
    decision(issue, 'start', 'all gates passed', {
      labels: moveTo(issue, 'building'),
      start: {
        branch: branchName(issue.number, issue.title),
        change_id: changeId(issue.number, issue.title),
        base: config.branches.base,
        assignee,
        // Who the issue goes back to when a check before the build finds that it cannot succeed.
        spec_writer: config.team.spec_writer ?? issue.ready_by ?? null,
        title: issue.title,
        qa_retries: config.qa.retries,
        run_max_turns: config.limits.run_max_turns,
        run_max_minutes: config.limits.run_max_minutes,
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
        // Only when the urgent label let the issue start over the assignee's capacity: the hand-off message says so.
        ...(overCapacity && urgent ? { urgent: true, built_waiting: built + 1 } : {}),
        // Only when the wait for a shared file ended by its bound: the hand-off message lists the files.
        ...(sharedPassed.length > 0 ? { shared_files: sharedPassed } : {}),
      },
    });
  });

  // A retry of an issue that is not `qa-failed` (or is not open) changes nothing.
  if (retry && !decisions.some((d) => d.issue === retry.issue)) {
    decisions.push({
      issue: retry.issue,
      action: 'skip',
      reason: 'only an open issue labelled qa-failed can be retried',
      labels: { add: [], remove: [] },
      comment: null,
      assign: null,
    });
  }

  const summary = {};
  decisions.forEach((d) => {
    summary[d.action] = (summary[d.action] ?? 0) + 1;
  });
  return { decisions, summary };
}

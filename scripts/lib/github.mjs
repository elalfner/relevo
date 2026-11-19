// GitHub adapter for `go`: reads the state the planner needs and turns decisions into `gh` commands.
// The GitHub client is injected (`gh(args) -> stdout`) so everything here is testable without a network.
// Not yet exercised against the live API: verify in the first pilot.

import { execFileSync } from 'node:child_process';
import { resolveLabelNames } from './labels.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { renderMessage } from './messages.mjs';
import { lastSharedWait } from './shared-wait.mjs';
import { retryState } from './limit-retry.mjs';

/** The real client: runs the GitHub CLI and returns its output. */
export function realGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * The client for linked repositories. It is the ordinary client, except that the token of the process (`GH_TOKEN`)
 * is replaced by `GH_LINKS_TOKEN` when that is set: a read-only token for private linked repositories. Without it
 * public repositories are still read. `run` and `env` are injectable for the tests.
 */
export function realGhLinks({ env = process.env, run = execFileSync } = {}) {
  const token = env.GH_LINKS_TOKEN;
  return (args) => run('gh', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(token ? { env: { ...env, GH_TOKEN: token } } : {}),
  });
}

function apiJson(gh, path, { paginate = false } = {}) {
  const args = ['api'];
  if (paginate) args.push('--paginate', '--slurp');
  args.push(path);
  const data = JSON.parse(gh(args));
  return paginate ? data.flat() : data;
}

function normalizeIssue(raw) {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state,
    labels: (raw.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)),
    assignees: (raw.assignees ?? []).map((a) => a.login),
    milestone: raw.milestone ? { number: raw.milestone.number, due_on: raw.milestone.due_on ?? null } : null,
    ready_at: null,
    ready_by: null,
    urgent_by: null,
    go_at: null,
    go_by: null,
    title_edited_at: null,
    local_by: null,
    shared_wait: null,
  };
}

/** When the title was last changed: the last `renamed` event of the timeline, or null when it never was. */
export function titleEditedAt(timeline) {
  const events = timeline.filter((e) => e.event === 'renamed');
  return events.length > 0 ? events[events.length - 1].created_at ?? null : null;
}

const LAST_EDITED_QUERY = 'query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { issue(number: $number) { lastEditedAt } } }';

/**
 * When the body of an issue was last edited, as GitHub reports it (`lastEditedAt` of the GraphQL API; a change of labels, comments
 * or milestone does not move it, and the title is read from the `renamed` events instead).
 * Returns { ok: true, at: ISO } after an edit, { ok: true, at: null } for an issue never edited, and { ok: false, reason } when it
 * could not be read: the caller must never take a failure for "not edited". It never throws.
 * Not yet proved against the live API with the token of a workflow run: the spike of split-ready-and-go (tasks 1.1 to 1.3) does it.
 */
export function readLastEdited({ gh, repo, number }) {
  const [owner, name] = String(repo ?? '').split('/');
  if (!owner || !name || !Number.isInteger(number)) return { ok: false, reason: 'no repository or issue to read' };
  let out;
  try {
    out = gh(['api', 'graphql', '-f', `query=${LAST_EDITED_QUERY}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `number=${number}`]);
  } catch (e) {
    return { ok: false, reason: `the request for the last edit failed: ${String(e?.message ?? e).split('\n')[0]}` };
  }
  let data;
  try {
    data = JSON.parse(out);
  } catch {
    return { ok: false, reason: 'the answer about the last edit was not JSON' };
  }
  if (Array.isArray(data?.errors) && data.errors.length > 0) return { ok: false, reason: `GitHub answered with an error: ${data.errors[0]?.message ?? 'unknown'}` };
  const issue = data?.data?.repository?.issue;
  if (!issue || typeof issue !== 'object' || !('lastEditedAt' in issue)) return { ok: false, reason: 'the answer about the last edit has no lastEditedAt' };
  const at = issue.lastEditedAt;
  if (at === null) return { ok: true, at: null };
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return { ok: false, reason: 'the last edit is not a time' };
  return { ok: true, at };
}

/** When and by whom a label was last applied, from the issue timeline. */
export function labelEvent(timeline, labelName) {
  const events = timeline.filter((e) => e.event === 'labeled' && e.label?.name === labelName);
  const last = events[events.length - 1];
  return last ? { at: last.created_at, by: last.actor?.login ?? null } : { at: null, by: null };
}

/** When and by whom the ready label was last applied. */
export const readyEvent = labelEvent;

/**
 * How long the last completed builds of the go workflow took, in minutes: the `build` job of the most recent completed runs that
 * ran one, up to `limit` builds found among the last `scan` runs (a run that only decided has no such job, and so has a run of
 * the queue, so they are skipped and do not push the builds out of the window; a skipped or cancelled job has no duration worth
 * reporting).
 * Returns null when it cannot be read (no `actions: read`, no such workflow, a network error on the list of runs, or every request
 * for the jobs failed): a queue comment says "unknown" then and the plan never fails because of it. A request for the jobs of one
 * run that fails (a transient error) only leaves that run out; the builds found in the others are kept.
 */
export function readRecentBuilds({ gh, repo, workflow = 'relevo-go.yml', limit = 10, scan = 30 }) {
  try {
    const runs = apiJson(gh, `repos/${repo}/actions/workflows/${workflow}/runs?status=completed&per_page=${scan}`).workflow_runs ?? [];
    const minutes = [];
    let failed = 0;
    for (const run of runs) {
      if (minutes.length >= limit) break;
      let jobs;
      try {
        jobs = apiJson(gh, `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`).jobs ?? [];
      } catch {
        failed += 1;
        continue;
      }
      const build = jobs.find((j) => j.name === 'build' && ['success', 'failure'].includes(j.conclusion) && j.started_at && j.completed_at);
      if (!build) continue;
      const ms = Date.parse(build.completed_at) - Date.parse(build.started_at);
      if (Number.isFinite(ms) && ms >= 0) minutes.push(Math.round((ms / 60000) * 10) / 10);
    }
    return failed > 0 && minutes.length === 0 ? null : minutes;
  } catch {
    return null;
  }
}

/**
 * Collect everything `planGo` needs. Returns { issues, completed, completedExternal, unreadable, running, permissions, recentBuilds } (the last one a function).
 * `running` is supplied by the caller (workflow runs in progress). `ghLinks` reads issues of linked repositories
 * (`config.links` only; a repository outside the list is never asked).
 */
export function gather({ gh, ghLinks = gh, repo, config, running = [], retry = null, only = null, person = null }) {
  const names = resolveLabelNames(config.labels);
  // `build-failed` issues are read only for a retry, and then only the retried one is kept.
  // The states after `built` are read too: an issue in one of them still holds the files it names until it is merged.
  const stateKeys = ['ready', 'queued', 'blocked', 'building', 'built', 'in-review', 'pr-open', 'changes-requested', ...(retry ? ['build-failed'] : [])];

  const byNumber = new Map();
  stateKeys.forEach((key) => {
    const found = apiJson(gh, `repos/${repo}/issues?state=open&per_page=100&labels=${encodeURIComponent(names[key])}`, { paginate: true });
    found.filter((i) => !i.pull_request && (key !== 'build-failed' || i.number === retry.issue)).forEach((i) => byNumber.set(i.number, normalizeIssue(i)));
  });
  // The issue named by --only is read whatever its state: a `go` label on a draft or on a `build-failed` issue is answered too,
  // and a local build of a draft is told that it needs `ready` first.
  if (Number.isInteger(only) && !byNumber.has(only)) {
    try {
      const raw = apiJson(gh, `repos/${repo}/issues/${only}`);
      if (raw && !raw.pull_request && raw.state === 'open') byNumber.set(only, normalizeIssue(raw));
    } catch {
      // An issue that cannot be read gets no decision, as before.
    }
  }
  const issues = [...byNumber.values()];

  const candidates = issues.filter((i) => [names.ready, names.queued, names.blocked].some((n) => i.labels.includes(n))
    || (retry && i.number === retry.issue && i.labels.includes(names['build-failed']))
    || i.number === only);
  candidates.forEach((issue) => {
    const timeline = apiJson(gh, `repos/${repo}/issues/${issue.number}/timeline?per_page=100`, { paginate: true });
    const { at, by } = labelEvent(timeline, names.ready);
    issue.ready_at = at;
    issue.ready_by = by;
    // The wait for a shared file that began last, from the hidden marker of its comment.
    issue.shared_wait = lastSharedWait(timeline);
    // The same timeline answers for the urgent label: who asked for the early start.
    if (issue.labels.includes(names.urgent)) issue.urgent_by = labelEvent(timeline, names.urgent).by;
    // And for the build request: who asked the cloud to build, and when.
    if (issue.labels.includes(names.go)) {
      const go = labelEvent(timeline, names.go);
      issue.go_at = go.at;
      issue.go_by = go.by;
    }
    // A change of the title after the approval withdraws it (see "The approval covers the text as it was approved").
    issue.title_edited_at = titleEditedAt(timeline);
  });

  // Who started a local build: the person who applied the `local` mark. Only `building` issues with the mark need it.
  issues.filter((i) => i.labels.includes(names.building) && i.labels.includes(names.local)).forEach((issue) => {
    try {
      issue.local_by = labelEvent(apiJson(gh, `repos/${repo}/issues/${issue.number}/timeline?per_page=100`, { paginate: true }), names.local).by;
    } catch {
      issue.local_by = null;
    }
  });

  // The retry time that a comment of a bot gave to an issue that stopped at a usage limit (see limit-retry.mjs). Only `queued` issues
  // (held until then) and `building` ones (a retry in progress) need it. A comment list that cannot be read leaves it out.
  issues.filter((i) => i.labels.includes(names.queued) || i.labels.includes(names.building)).forEach((issue) => {
    try {
      issue.limit_retry = retryState(apiJson(gh, `repos/${repo}/issues/${issue.number}/comments?per_page=100`, { paginate: true }));
    } catch {
      issue.limit_retry = null;
    }
  });

  const wanted = new Set();
  const wantedExternal = new Set();
  const linked = new Set((config.links ?? []).map((l) => l.toLowerCase()));
  candidates.forEach((i) => {
    const parsed = parseIssueBody(i.body);
    parsed.dependsOn.forEach((n) => wanted.add(n));
    parsed.dependsOnExternal.forEach(({ repo: other, number }) => {
      // The own repository written in full is a local reference; a repository outside `links` is never read.
      if (other.toLowerCase() === String(repo).toLowerCase()) wanted.add(number);
      else if (linked.has(other.toLowerCase())) wantedExternal.add(`${other}#${number}`);
    });
  });
  const completed = [];
  wanted.forEach((n) => {
    const dep = apiJson(gh, `repos/${repo}/issues/${n}`);
    if (dep.state === 'closed' && dep.state_reason === 'completed') completed.push(n);
  });
  const completedExternal = [];
  const unreadable = [];
  wantedExternal.forEach((ref) => {
    const [other, number] = ref.split('#');
    try {
      const dep = apiJson(ghLinks, `repos/${other}/issues/${number}`);
      if (dep.state === 'closed' && dep.state_reason === 'completed') completedExternal.push(ref);
    } catch {
      unreadable.push(ref);
    }
  });

  const permissions = {};
  new Set([...candidates.flatMap((i) => [i.ready_by, i.urgent_by, i.go_by]), retry?.by, person].filter(Boolean)).forEach((login) => {
    try {
      permissions[login] = apiJson(gh, `repos/${repo}/collaborators/${login}/permission`).permission ?? 'none';
    } catch {
      permissions[login] = 'none';
    }
  });

  // The recent builds are read only if a queue comment needs them (planGo calls the function), so a plan that queues nothing pays no extra request.
  return { issues, completed, completedExternal, unreadable, running, permissions, recentBuilds: () => readRecentBuilds({ gh, repo }) };
}

/** The `gh` commands that carry out one decision (labels, assignees and comment). Pure. */
export function commandsFor(decision, { repo, config }) {
  const commands = [];
  const edit = ['issue', 'edit', String(decision.issue), '--repo', repo];
  decision.labels.add.forEach((l) => edit.push('--add-label', l));
  decision.labels.remove.forEach((l) => edit.push('--remove-label', l));
  (decision.assign ?? []).forEach((a) => edit.push('--add-assignee', a));
  if (edit.length > 5) commands.push(edit);
  if (decision.comment) {
    const body = renderMessage(decision.comment.kind, decision.comment.data, config.language);
    commands.push(['issue', 'comment', String(decision.issue), '--repo', repo, '--body', body]);
  }
  if (decision.notice) {
    const body = renderMessage(decision.notice.kind, decision.notice.data, config.language);
    commands.push(['issue', 'comment', String(decision.issue), '--repo', repo, '--body', body]);
  }
  return commands;
}

/**
 * Apply decisions. `start` decisions are skipped unless `includeStart` is set: the build itself is done by
 * the skill, and only the issue it is about to build should be marked as building. Returns the commands run.
 */
export function applyDecisions(decisions, { gh, repo, config, includeStart = false }) {
  const done = [];
  // A report only informs: it changes no label and posts nothing, whatever it carries.
  decisions.filter((d) => d.action !== 'report' && (includeStart || d.action !== 'start')).forEach((d) => {
    commandsFor(d, { repo, config }).forEach((cmd) => {
      gh(cmd);
      done.push(cmd);
    });
  });
  return done;
}

/** Open pull requests currently waiting for a review from each of `logins`. Returns { login: count }. */
export function openReviewCounts({ gh, repo, logins }) {
  const counts = {};
  logins.forEach((login) => {
    const q = encodeURIComponent(`repo:${repo} is:pr is:open review-requested:${login}`);
    counts[login] = apiJson(gh, `search/issues?q=${q}&per_page=1`).total_count ?? 0;
  });
  return counts;
}

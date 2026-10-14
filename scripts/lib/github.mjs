// GitHub adapter for `go`: reads the state the planner needs and turns decisions into `gh` commands.
// The GitHub client is injected (`gh(args) -> stdout`) so everything here is testable without a network.
// Not yet exercised against the live API: verify in the first pilot.

import { execFileSync } from 'node:child_process';
import { resolveLabelNames } from './labels.mjs';
import { parseIssueBody } from './issue-parse.mjs';
import { renderMessage } from './messages.mjs';

/** The real client: runs the GitHub CLI and returns its output. */
export function realGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
  };
}

/** When and by whom the ready label was last applied, from the issue timeline. */
export function readyEvent(timeline, readyName) {
  const events = timeline.filter((e) => e.event === 'labeled' && e.label?.name === readyName);
  const last = events[events.length - 1];
  return last ? { at: last.created_at, by: last.actor?.login ?? null } : { at: null, by: null };
}

/**
 * Collect everything `planGo` needs. Returns { issues, completed, running, permissions }.
 * `running` is supplied by the caller (workflow runs in progress).
 */
export function gather({ gh, repo, config, running = [] }) {
  const names = resolveLabelNames(config.labels);
  const stateKeys = ['ready', 'queued', 'blocked', 'building', 'built'];

  const byNumber = new Map();
  stateKeys.forEach((key) => {
    const found = apiJson(gh, `repos/${repo}/issues?state=open&per_page=100&labels=${encodeURIComponent(names[key])}`, { paginate: true });
    found.filter((i) => !i.pull_request).forEach((i) => byNumber.set(i.number, normalizeIssue(i)));
  });
  const issues = [...byNumber.values()];

  const candidates = issues.filter((i) => [names.ready, names.queued, names.blocked].some((n) => i.labels.includes(n)));
  candidates.forEach((issue) => {
    const timeline = apiJson(gh, `repos/${repo}/issues/${issue.number}/timeline?per_page=100`, { paginate: true });
    const { at, by } = readyEvent(timeline, names.ready);
    issue.ready_at = at;
    issue.ready_by = by;
  });

  const wanted = new Set();
  candidates.forEach((i) => parseIssueBody(i.body).dependsOn.forEach((n) => wanted.add(n)));
  const completed = [];
  wanted.forEach((n) => {
    const dep = apiJson(gh, `repos/${repo}/issues/${n}`);
    if (dep.state === 'closed' && dep.state_reason === 'completed') completed.push(n);
  });

  const permissions = {};
  new Set(candidates.map((i) => i.ready_by).filter(Boolean)).forEach((login) => {
    try {
      permissions[login] = apiJson(gh, `repos/${repo}/collaborators/${login}/permission`).permission ?? 'none';
    } catch {
      permissions[login] = 'none';
    }
  });

  return { issues, completed, running, permissions };
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
  return commands;
}

/**
 * Apply decisions. `start` decisions are skipped unless `includeStart` is set: the build itself is done by
 * the skill, and only the issue it is about to build should be marked as building. Returns the commands run.
 */
export function applyDecisions(decisions, { gh, repo, config, includeStart = false }) {
  const done = [];
  decisions.filter((d) => includeStart || d.action !== 'start').forEach((d) => {
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

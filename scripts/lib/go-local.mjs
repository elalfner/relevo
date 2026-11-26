// Run `go` on a person's machine. Implements "A local run uses the same limits and tools as the cloud" and
// "A local run has its own working tree" of the execution-modes specification.
//
// Every process goes through an injected runner so the logic is tested without `claude`, `gh` or a network:
//   capture(cmd, args, { cwd }) -> stdout (throws when the command fails)
//   run(cmd, args, { cwd, env }) -> Promise<{ status, stdout }> without blocking (the progress is printed while it runs);
//     rejects with code ENOENT when the command is missing
// The files of the state folder, the clock and the printing are injected as well (`state`, `now`, `sleep`, `print`).

import { baseRef, localRefs } from './base-ref.mjs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeId } from './branch.mjs';
import { renderMessage } from './messages.mjs';
import { readUsage, usageLine } from './run-usage.mjs';
import { runFlags } from './run-flags.mjs';
import { WORKTREES_FOLDER, stateDir, worktreePath } from './worktree-path.mjs';

export { WORKTREES_FOLDER };
// The guard is part of the plugin, not of the project that is built, so it is found next to this file.
const GUARD = fileURLToPath(new URL('../agent-guard.mjs', import.meta.url));
const TRACKER = fileURLToPath(new URL('../tracker.mjs', import.meta.url));
// The same time limit as the cloud step of the Antigravity agent.
export const GUARD_TIMEOUT_MINUTES = 50;
// How often a line is printed when something changed.
export const PRINT_INTERVAL_MS = 15 * 1000;

const noop = () => {};
/** What a run does to its state folder when nothing real is injected: nothing, and the folder is "made". */
export const NO_STATE = { prepare: () => true, snapshot: () => null, start: noop, end: noop, totals: noop, save: noop, read: () => null };

/** The part of a snapshot that decides whether a new line is printed: the phase, the group, the tasks and the newest lens or agent record. */
export function snapshotKey(s) {
  const last = (list) => (list.length ? list[list.length - 1] : null);
  return JSON.stringify([s.phase, s.group, s.tasks, s.lenses.length, last(s.lenses), s.agents.length, last(s.agents)]);
}

/** The line to print for a snapshot; `previous` (the snapshot of the last line) tells which lens or agent record is new. */
export function progressLine(s, previous, language = 'en') {
  const data = { phase: s.phase.phase, attempt: s.phase.attempt, of: s.phase.of, minutes: s.minutes, tasks_done: s.tasks?.done, tasks_total: s.tasks?.total, group: s.group?.group, groups: s.group?.of };
  const newLens = s.lenses.length > (previous?.lenses.length ?? 0) ? s.lenses[s.lenses.length - 1] : null;
  const newAgent = !newLens && s.agents.length > (previous?.agents.length ?? 0) ? s.agents[s.agents.length - 1] : null;
  if (newLens) Object.assign(data, { event_kind: newLens.event === 'end' ? 'lens_end' : 'lens_start', event_name: newLens.lens });
  else if (newAgent) Object.assign(data, { event_kind: 'agent', event_name: newAgent.agent });
  return renderMessage('local_progress', data, language);
}

/** What the final answer of the agent says: { text, usage }. An answer that is not the JSON object is printed as it came and has no usage. */
export function readAnswer(stdout, { antigravity = false, summary = null } = {}) {
  const raw = String(stdout ?? '');
  if (antigravity) return { text: raw.trim(), usage: summary ? readUsage(summary) : null };
  try {
    const object = JSON.parse(raw.trim());
    if (object && typeof object === 'object' && !Array.isArray(object)) {
      return { text: typeof object.result === 'string' ? object.result.trim() : '', usage: readUsage(raw) };
    }
  } catch {
    // not the object: the raw output is the answer
  }
  return { text: raw.trim(), usage: null };
}

/** What a local run will do, without doing it: the worktree and the `claude` or `agy` command. Pure. */
export function planLocalRun({ issue, repoRoot, config, retry = false, resume = false }) {
  const base = config.branches.base;
  const worktree = worktreePath(repoRoot, issue);
  const state = stateDir(repoRoot, issue);
  const isAntigravity = config.agent?.build === 'antigravity';
  // A retry builds a `build-failed` issue again: `go` plans it with the planner's --retry and the issue never becomes `ready`.
  // A resume continues a `build-failed` issue from its branch: the same stand-in for `ready`, and the issue is claimed the same way.
  const prompt = `/relevo:go ${issue}${retry ? ' --retry' : ''}${resume ? ' --resume' : ''}`;
  const command = isAntigravity
    ? ['node', [
        GUARD,
        'run',
        '--prompt',
        prompt,
        '--config',
        'relevo.yml',
        '--timeout-minutes',
        String(GUARD_TIMEOUT_MINUTES),
        // outside the worktree, so a clean end can remove it and the agent finds the tree clean
        '--summary',
        join(tmpdir(), `relevo-guard-${basename(repoRoot)}-${issue}.json`),
      ]]
    : ['claude', ['-p', prompt, ...runFlags(config, { json: true })]];
  return {
    issue,
    base,
    worktree,
    state,
    git: [
      // A files project builds from its own base branch and has no remote to fetch from.
      ...(localRefs(config) ? [] : [['fetch', 'origin', base]]),
      ['worktree', 'add', '--detach', worktree, baseRef(config, base)],
    ],
    summary: isAntigravity ? command[1][command[1].indexOf('--summary') + 1] : null,
    claude: command,
    // Without this the agent may start a subagent in the background and end the run before it finishes.
    env: isAntigravity ? {} : { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' },
  };
}

/**
 * Run it. Resolves { status, worktree, removed, messages } and never rejects for an expected problem; `messages` is
 * what was printed (`print` prints each as it comes). While the agent runs, a line is printed when the phase, the group, the
 * tasks or the newest lens or agent record changes, from the state folder and not from the agent. `dryRun` returns the plan.
 */
export async function runLocal({
  issue, config, runner, dryRun = false, retry = false, resume = false, exists = () => false,
  state = NO_STATE, now = Date.now, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), intervalMs = PRINT_INTERVAL_MS, print = noop,
}) {
  const messages = [];
  const say = (m) => {
    messages.push(m);
    print(m);
  };
  if (resume && retry) return { status: 2, worktree: null, removed: false, messages: ['--resume and --retry cannot be given together: --resume continues from the branch, --retry builds from the beginning'] };
  if (!/^\d+$/.test(String(issue))) return { status: 2, worktree: null, removed: false, messages: ['give the issue number: go-local.mjs <issue>'] };

  let repoRoot;
  try {
    repoRoot = runner.capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
  } catch {
    return { status: 2, worktree: null, removed: false, messages: ['not inside a git repository'] };
  }
  const plan = planLocalRun({ issue: String(issue), repoRoot, config, retry, resume });
  const isAntigravity = config.agent?.build === 'antigravity';
  const language = config.language ?? 'en';

  if (dryRun) {
    say(`worktree: ${plan.worktree} (from ${baseRef(config, plan.base)})`);
    say(`command: ${plan.claude[0]} ${plan.claude[1].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    return { status: 0, worktree: plan.worktree, removed: false, messages };
  }
  if (exists(plan.worktree)) {
    return { status: 2, worktree: plan.worktree, removed: false, messages: [`${plan.worktree} already exists: finish or remove that run first (git worktree remove --force "${plan.worktree}")`] };
  }

  // A files project has no GitHub: nothing here needs `gh`.
  if (!localRefs(config)) {
    try {
      runner.capture('gh', ['auth', 'status'], {});
    } catch (err) {
      return { status: 2, worktree: null, removed: false, messages: [err.code === 'ENOENT' ? 'the GitHub CLI (gh) is not installed' : 'the GitHub CLI is not signed in: run `gh auth login`'] };
    }
  }

  // Nothing a local build does starts the cloud: it applies no `go` label. So the cloud is not asked about and there is no warning.

  try {
    plan.git.forEach((args) => runner.capture('git', args, { cwd: repoRoot }));
  } catch (err) {
    return { status: 1, worktree: null, removed: false, messages: [...messages, `could not prepare the worktree: ${String(err.stderr ?? err.message).trim().split('\n')[0]}`] };
  }
  say(`building #${issue} in ${plan.worktree}`);

  // The id of the change comes from the title of the issue, as the planner derives it, so that the tasks can be counted.
  let id = null;
  try {
    id = changeId(Number(issue), (localRefs(config)
      ? JSON.parse(runner.capture('node', [TRACKER, 'issue-get', String(issue), '--fields', 'title'], { cwd: repoRoot })).title
      : runner.capture('gh', ['issue', 'view', String(issue), '--json', 'title', '--jq', '.title'], { cwd: repoRoot })).trim());
  } catch {
    id = null;
  }
  // The progress folder of the build: emptied here so that it replaces the last one, outside every working tree, kept when the worktree goes.
  const stateOk = state.prepare(plan.state);
  if (stateOk) state.start(plan.state, { issue: Number(issue), changeId: id, now: now() });
  else say(renderMessage('local_progress_off', {}, language));
  const env = stateOk ? { ...plan.env, RELEVO_PROGRESS_DIR: plan.state } : plan.env;

  let finished = false;
  let last = null;
  let lastKey = null;
  const tick = () => {
    if (!stateOk) return;
    try {
      const snapshot = state.snapshot({ dir: plan.state, worktree: plan.worktree, changeId: id, now: now() });
      if (!snapshot) return;
      const key = snapshotKey(snapshot);
      if (key !== lastKey) say(progressLine(snapshot, last, language));
      lastKey = key;
      last = snapshot;
    } catch {
      // reporting never stops the build
    }
  };

  let status;
  let answer = { text: '', usage: null };
  try {
    const running = runner.run(plan.claude[0], plan.claude[1], { cwd: plan.worktree, env }).then(
      (result) => ({ result }),
      (error) => ({ error }),
    );
    running.then(() => { finished = true; });
    tick();
    while (!finished) {
      await Promise.race([running, sleep(intervalMs)]);
      if (!finished) tick();
    }
    const outcome = await running;
    if (outcome.error) throw outcome.error;
    status = outcome.result.status;
    answer = readAnswer(outcome.result.stdout, { antigravity: isAntigravity, summary: isAntigravity && plan.summary ? state.read(plan.summary) : null });
  } catch (err) {
    status = err.code === 'ENOENT' ? 127 : 1;
    const missing = config.agent?.build === 'antigravity'
      ? 'the agy or node command was not found: install the Antigravity CLI'
      : 'the claude command was not found: install Claude Code and the Relevo plugin';
    say(err.code === 'ENOENT' ? missing : `the run could not start: ${err.message}`);
  }
  tick();

  // What the agent answered, and what the run used: printed and kept in the state, never posted.
  if (answer.text) say(answer.text);
  if (answer.usage) {
    const totals = { turns: answer.usage.turns, cost: answer.usage.cost, tokens: answer.usage.tokens };
    const sentence = usageLine({ ...totals, cached: answer.usage.cached ?? null }, { language });
    if (sentence) say(sentence);
    if (stateOk) state.totals(plan.state, totals);
  }
  if (stateOk) {
    try {
      state.end(plan.state, { status, now: now() });
      state.save(plan.state, state.snapshot({ dir: plan.state, worktree: plan.worktree, changeId: id, now: now() }));
    } catch {
      // the state is a report: failing to write it never fails the build
    }
  }

  if (status === 0) {
    // A build that stopped can leave the developer's work uncommitted in the worktree; removing it would lose that work.
    let unsaved = false;
    try { unsaved = String(runner.capture('git', ['status', '--porcelain'], { cwd: plan.worktree })).trim() !== ''; } catch { unsaved = true; }
    if (unsaved) {
      say(`done, but the worktree is kept because it has changes that are not committed: ${plan.worktree}`);
      return { status: 0, worktree: plan.worktree, removed: false, messages };
    }
    try {
      runner.capture('git', ['worktree', 'remove', '--force', plan.worktree], { cwd: repoRoot });
      say('done; the worktree was removed. Look at the issue for the result.');
      return { status: 0, worktree: plan.worktree, removed: true, messages };
    } catch {
      say(`done, but the worktree could not be removed: git worktree remove --force "${plan.worktree}"`);
      return { status: 0, worktree: plan.worktree, removed: false, messages };
    }
  }
  if (isAntigravity && status === 2) say('the run guard refused to start (usage error): see its message above');
  say(`the run ended with status ${status}; the worktree is kept for inspection: ${plan.worktree}`);
  return { status, worktree: plan.worktree, removed: false, messages };
}

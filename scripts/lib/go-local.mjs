// Run `go` on a person's machine. Implements "A local run uses the same limits and tools as the cloud" and
// "A local run has its own working tree" of the execution-modes specification.
//
// Every process goes through an injected runner so the logic is tested without `claude`, `gh` or a network:
//   capture(cmd, args, { cwd }) -> stdout (throws when the command fails)
//   stream(cmd, args, { cwd, env }) -> exit status (the output goes to the terminal); throws with code ENOENT when missing

import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudBuilds } from './execution-mode.mjs';
import { runFlags } from './run-flags.mjs';
import { WORKTREES_FOLDER, worktreePath } from './worktree-path.mjs';

export { WORKTREES_FOLDER };
// The guard is part of the plugin, not of the project that is built, so it is found next to this file.
const GUARD = fileURLToPath(new URL('../agent-guard.mjs', import.meta.url));
// The same time limit as the cloud step of the Antigravity agent.
export const GUARD_TIMEOUT_MINUTES = 50;

/** What a local run will do, without doing it: the worktree and the `claude` or `agy` command. Pure. */
export function planLocalRun({ issue, repoRoot, config }) {
  const base = config.branches.base;
  const worktree = worktreePath(repoRoot, issue);
  const isAntigravity = config.agent?.build === 'antigravity';
  const command = isAntigravity
    ? ['node', [
        GUARD,
        'run',
        '--prompt',
        `/relevo:go ${issue}`,
        '--config',
        'relevo.yml',
        '--timeout-minutes',
        String(GUARD_TIMEOUT_MINUTES),
        // outside the worktree, so a clean end can remove it and the agent finds the tree clean
        '--summary',
        join(tmpdir(), `relevo-guard-${basename(repoRoot)}-${issue}.json`),
      ]]
    : ['claude', ['-p', `/relevo:go ${issue}`, ...runFlags(config)]];
  return {
    issue,
    base,
    worktree,
    git: [
      ['fetch', 'origin', base],
      ['worktree', 'add', '--detach', worktree, `origin/${base}`],
    ],
    claude: command,
    // Without this the agent may start a subagent in the background and end the run before it finishes.
    env: isAntigravity ? {} : { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' },
  };
}

/**
 * Run it. Returns { status, worktree, removed, messages } and never throws for an expected problem; `messages` is
 * what to print. `dryRun` returns the plan without running anything.
 */
export function runLocal({ issue, config, runner, workflowPresent = false, dryRun = false, exists = () => false }) {
  const messages = [];
  const say = (m) => messages.push(m);
  if (!/^\d+$/.test(String(issue))) return { status: 2, worktree: null, removed: false, messages: ['give the issue number: go-local.mjs <issue>'] };

  let repoRoot;
  try {
    repoRoot = runner.capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
  } catch {
    return { status: 2, worktree: null, removed: false, messages: ['not inside a git repository'] };
  }
  const plan = planLocalRun({ issue: String(issue), repoRoot, config });
  const isAntigravity = config.agent?.build === 'antigravity';

  if (dryRun) {
    say(`worktree: ${plan.worktree} (from origin/${plan.base})`);
    say(`command: ${plan.claude[0]} ${plan.claude[1].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    return { status: 0, worktree: plan.worktree, removed: false, messages };
  }
  if (exists(plan.worktree)) {
    return { status: 2, worktree: plan.worktree, removed: false, messages: [`${plan.worktree} already exists: finish or remove that run first (git worktree remove --force "${plan.worktree}")`] };
  }

  try {
    runner.capture('gh', ['auth', 'status'], {});
  } catch (err) {
    return { status: 2, worktree: null, removed: false, messages: [err.code === 'ENOENT' ? 'the GitHub CLI (gh) is not installed' : 'the GitHub CLI is not signed in: run `gh auth login`'] };
  }

  // The cloud may start the same issue: the variable decides.
  let variable = null;
  try {
    variable = runner.capture('gh', ['variable', 'get', 'RELEVO_CLOUD_GO'], { cwd: repoRoot }).trim();
  } catch {
    variable = null;
  }
  if (cloudBuilds({ workflowPresent, variable })) {
    say('warning: the cloud can also build this issue (the go workflow is installed and RELEVO_CLOUD_GO is not `off`); if the issue is `ready` it may already be running. Set RELEVO_CLOUD_GO to `off` in the repository variables to build only on machines.');
  }

  try {
    plan.git.forEach((args) => runner.capture('git', args, { cwd: repoRoot }));
  } catch (err) {
    return { status: 1, worktree: null, removed: false, messages: [...messages, `could not prepare the worktree: ${String(err.stderr ?? err.message).trim().split('\n')[0]}`] };
  }
  say(`building #${issue} in ${plan.worktree}`);

  let status;
  try {
    status = runner.stream(plan.claude[0], plan.claude[1], { cwd: plan.worktree, env: plan.env });
  } catch (err) {
    status = err.code === 'ENOENT' ? 127 : 1;
    const missing = config.agent?.build === 'antigravity'
      ? 'the agy or node command was not found: install the Antigravity CLI'
      : 'the claude command was not found: install Claude Code and the Relevo plugin';
    say(err.code === 'ENOENT' ? missing : `the run could not start: ${err.message}`);
  }

  if (status === 0) {
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

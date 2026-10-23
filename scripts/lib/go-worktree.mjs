// The worktree of an interactive `go` in Claude Code. Implements "An interactive Claude Code run builds in its own
// worktree" of the execution-modes specification: the skill makes the worktree here, enters it with EnterWorktree, and
// asks for its removal here when the run ends cleanly.
//
// Every process goes through an injected runner so the logic is tested without git or a network:
//   capture(cmd, args, { cwd }) -> stdout (throws when the command fails)

import { worktreePath } from './worktree-path.mjs';

/** Exit codes of `go-worktree.mjs`. `exists` and `linked` are answers, not failures: the skill reads them. */
export const EXIT = { ok: 0, failed: 1, usage: 2, exists: 3, linked: 4 };

const fail = (status, message) => ({ status, worktree: null, messages: [message] });
// git prints progress ("Preparing worktree ...") before the reason, so the reason is the `fatal:` or `error:` line, or the last one.
function firstLine(err) {
  const lines = String(err.stderr ?? err.message).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /^(fatal|error):/.test(l)) ?? lines.at(-1) ?? 'git failed';
}

function context(issue, runner) {
  if (!/^\d+$/.test(String(issue))) return { early: fail(EXIT.usage, 'give the issue number: go-worktree.mjs create|remove <issue>') };
  try {
    const repoRoot = runner.capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
    const [gitDir, commonDir] = runner
      .capture('git', ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { cwd: repoRoot })
      .trim()
      .split('\n');
    return { repoRoot, linked: gitDir !== commonDir };
  } catch {
    return { early: fail(EXIT.usage, 'not inside a git repository (or git is older than 2.31)') };
  }
}

/**
 * Make the worktree of an issue from `origin/<base>`. `linked` when the session is already in a linked worktree (the
 * build runs where it is), `exists` when the worktree of the issue is already there (the same issue twice).
 */
export function createWorktree({ issue, config, runner, exists = () => false }) {
  const ctx = context(issue, runner);
  if (ctx.early) return ctx.early;
  if (ctx.linked) {
    return fail(EXIT.linked, 'this session is already in a linked worktree: build here, no worktree is made');
  }
  const base = config.branches.base;
  const worktree = worktreePath(ctx.repoRoot, issue);
  if (exists(worktree)) {
    return {
      status: EXIT.exists,
      worktree,
      messages: [`${worktree} already exists: another run is building #${issue}, or a failed one left it. Finish it or remove it first (git worktree remove --force "${worktree}")`],
    };
  }
  try {
    // A folder deleted by hand leaves a registration that makes `worktree add` fail; prune only drops those.
    runner.capture('git', ['worktree', 'prune'], { cwd: ctx.repoRoot });
    runner.capture('git', ['fetch', 'origin', base], { cwd: ctx.repoRoot });
    runner.capture('git', ['worktree', 'add', '--detach', worktree, `origin/${base}`], { cwd: ctx.repoRoot });
  } catch (err) {
    return fail(EXIT.failed, `could not prepare the worktree: ${firstLine(err)}`);
  }
  return { status: EXIT.ok, worktree, base, messages: [] };
}

/** Remove the worktree of an issue, after a clean end. Run it from the main working tree, not from inside. */
export function removeWorktree({ issue, runner, exists = () => true }) {
  const ctx = context(issue, runner);
  if (ctx.early) return ctx.early;
  if (ctx.linked) return fail(EXIT.linked, 'leave the worktree first (ExitWorktree with keep), then remove it from the main working tree');
  const worktree = worktreePath(ctx.repoRoot, issue);
  if (!exists(worktree)) {
    // The folder may be gone while git still lists it: drop that registration so the issue can be built again.
    try {
      runner.capture('git', ['worktree', 'prune'], { cwd: ctx.repoRoot });
    } catch (err) {
      return { status: EXIT.failed, worktree, messages: [`could not prune the worktrees: ${firstLine(err)}; run git worktree prune`] };
    }
    return { status: EXIT.ok, worktree, messages: [`${worktree} is not there: nothing to remove`] };
  }
  try {
    runner.capture('git', ['worktree', 'remove', '--force', worktree], { cwd: ctx.repoRoot });
  } catch (err) {
    return { status: EXIT.failed, worktree, messages: [`could not remove ${worktree}: ${firstLine(err)}; run git worktree remove --force "${worktree}"`] };
  }
  return { status: EXIT.ok, worktree, messages: [] };
}

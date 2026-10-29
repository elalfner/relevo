// Which worktree holds a branch. Implements "A branch held by another worktree stops ... before it changes anything"
// of the review, fix and ship specifications: git refuses `git switch <branch>` when another worktree has the branch
// checked out, and its message names neither the worktree nor what to do.
//
// Every process goes through an injected runner so the logic is tested without git:
//   capture(cmd, args, { cwd }) -> stdout (throws when the command fails)

/** Exit codes of `branch-worktree.mjs`. `held` is an answer, not a failure: the skills read it. */
export const EXIT = { free: 0, held: 1, usage: 2 };

/** The worktrees in the output of `git worktree list --porcelain`: `{ path, branch }`, with no branch when detached. Pure. */
export function parseWorktrees(porcelain) {
  return String(porcelain)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const path = lines.find((l) => l.startsWith('worktree '))?.slice('worktree '.length);
      const ref = lines.find((l) => l.startsWith('branch '))?.slice('branch '.length);
      return { path, branch: ref?.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : null };
    })
    .filter((w) => w.path);
}

/**
 * Is `branch` held by a worktree other than the one this runs in? `held` with the path of that worktree, or `free`
 * when no worktree has it or only this one does. A detached worktree holds no branch.
 */
export function branchHolder({ branch, runner }) {
  if (!branch) return { status: EXIT.usage, holder: null, messages: ['give the branch: branch-worktree.mjs --branch <name>'] };
  let here;
  let worktrees;
  try {
    here = runner.capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
    worktrees = parseWorktrees(runner.capture('git', ['worktree', 'list', '--porcelain'], { cwd: here }));
  } catch {
    return { status: EXIT.usage, holder: null, messages: ['not inside a git repository'] };
  }
  const other = worktrees.find((w) => w.branch === branch && w.path !== here);
  if (!other) return { status: EXIT.free, holder: null, messages: [] };
  return {
    status: EXIT.held,
    holder: other.path,
    messages: [`the branch ${branch} is checked out in another worktree: ${other.path}. Work there, or remove that worktree (git worktree remove "${other.path}") and run this again`],
  };
}

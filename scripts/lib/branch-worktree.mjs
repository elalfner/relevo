// Which worktree holds a branch. Implements "A branch held by another worktree stops ... before it changes anything"
// of the review, fix and ship specifications: git refuses `git switch <branch>` when another worktree has the branch
// checked out, and its message names neither the worktree nor what to do.
//
// Every process goes through an injected runner so the logic is tested without git:
//   capture(cmd, args, { cwd }) -> stdout (throws when the command fails)
//
// When another worktree holds the branch it also says whether that worktree can be removed: its tree is clean and every
// commit of its branch is on the remote. Implements "A held branch says whether its worktree can be removed".
import { classifyBranchChanges } from './branch.mjs';

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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const lines = (text) => String(text).split('\n').filter((l) => l.trim());

/** Whether the porcelain entry of `path` carries a `locked` line. Pure. */
function isLocked(porcelain, path) {
  const entry = String(porcelain).split(/\n\s*\n/).find((b) => b.split('\n').includes(`worktree ${path}`));
  return Boolean(entry) && entry.split('\n').some((l) => l === 'locked' || l.startsWith('locked '));
}

/**
 * What is in the worktree at `path`, which holds `branch`: { removable, reasons, holds }. Read-only. `holds` is what the branch
 * changes against `origin/<base>` (`empty`, `spec-only`, `implementation`), or null without a base or when it cannot be read.
 */
function inspectHolder({ path, branch, base, runner, here, mainPath, porcelain }) {
  const run = (...args) => runner.capture('git', args, { cwd: here });
  const reasons = [];
  if (path === mainPath) reasons.push('it is the main working tree');
  if (isLocked(porcelain, path)) reasons.push('it is locked');
  try {
    run('fetch', '--quiet', 'origin', branch);
  } catch {
    // The remote branch we already know is used; a branch that is not there fails below.
  }
  try {
    const changed = lines(run('-C', path, 'status', '--porcelain')).length;
    if (changed > 0) reasons.push(`${plural(changed, 'uncommitted change or untracked file', 'uncommitted changes or untracked files')}`);
  } catch {
    reasons.push('could not read its tree');
  }
  try {
    const ahead = lines(run('-C', path, 'rev-list', `origin/${branch}..HEAD`)).length;
    if (ahead > 0) reasons.push(`${plural(ahead, 'commit', 'commits')} that ${ahead === 1 ? 'is' : 'are'} not on origin/${branch}`);
  } catch {
    reasons.push(`could not read origin/${branch}`);
  }
  let holds = null;
  if (base) {
    try {
      holds = classifyBranchChanges(run('diff', '--name-only', `origin/${base}...origin/${branch}`).split('\n'), branch.replace(/^feature\//, ''));
    } catch {
      holds = null;
    }
  }
  return { removable: reasons.length === 0, reasons, holds };
}

/**
 * Is `branch` held by a worktree other than the one this runs in? `held` with the path of that worktree, or `free`
 * when no worktree has it or only this one does. A detached worktree holds no branch.
 */
export function branchHolder({ branch, runner, base = null }) {
  if (!branch) return { status: EXIT.usage, holder: null, messages: ['give the branch: branch-worktree.mjs --branch <name>'] };
  let here;
  let worktrees;
  let porcelain;
  try {
    here = runner.capture('git', ['rev-parse', '--show-toplevel'], {}).trim();
    porcelain = runner.capture('git', ['worktree', 'list', '--porcelain'], { cwd: here });
    worktrees = parseWorktrees(porcelain);
  } catch {
    return { status: EXIT.usage, holder: null, messages: ['not inside a git repository'] };
  }
  const other = worktrees.find((w) => w.branch === branch && w.path !== here);
  if (!other) return { status: EXIT.free, holder: null, messages: [] };
  const found = inspectHolder({ path: other.path, branch, base, runner, here, mainPath: worktrees[0]?.path, porcelain });
  const messages = [`the branch ${branch} is checked out in another worktree: ${other.path}. Work there, or remove that worktree (git worktree remove "${other.path}") and run this again`];
  if (found.removable) messages.push(`that worktree holds nothing that is not on the remote: it can be removed with git worktree remove "${other.path}"`);
  else messages.push(`that worktree cannot be removed yet: ${found.reasons.join('; ')}`);
  if (found.holds === 'spec-only' || found.holds === 'empty') messages.push('the branch holds only the specification: there is nothing to review or correct in it; delete the remote branch and build the issue again');
  return { status: EXIT.held, holder: other.path, ...found, messages };
}

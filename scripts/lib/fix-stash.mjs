// The stash that keeps the work of a fix that QA rejected.
// Implements "Unfinished work is saved, not left in the tree" of openspec/specs/fix/spec.md.

const LINE_RE = /^(stash@\{\d+\}):\s+(?:On [^:]*|WIP on [^:]*):\s+(relevo-fix #(\d+) iteration (\d+))\s*$/;

export function stashMessage(issue, iteration) {
  return `relevo-fix #${Number(issue)} iteration ${Number(iteration)}`;
}

/** Newest stash of the issue from `git stash list` output: { ref, message, iteration }, or null. */
export function findStash(listOutput, issue) {
  for (const line of String(listOutput).split('\n')) {
    const m = line.match(LINE_RE);
    if (m && Number(m[3]) === Number(issue)) return { ref: m[1], message: m[2], iteration: Number(m[4]) };
  }
  return null;
}

// Would merging the base branch into a feature branch conflict? Asked without touching any tree or index, so it can
// run anywhere. `git merge-tree --write-tree` (git 2.38 and later) does the merge in memory.
//
// Returns { result: 'clean' | 'conflict' | 'unknown', files }. `unknown` means this git cannot probe or the probe
// failed for another reason; a caller must treat it as "not known", never as "clean".

/**
 * run   (...args) => { status, stdout } for git; it must not throw on a non-zero exit
 * base, branch   refs to merge, e.g. `origin/main` and `origin/feature/12-x`
 */
export function probeMerge(run, base, branch) {
  let out;
  try {
    out = run('merge-tree', '--write-tree', '--name-only', '--no-messages', base, branch);
  } catch {
    return { result: 'unknown', files: [] };
  }
  if (out.status === 0) return { result: 'clean', files: [] };
  // Exit 1 is a merge with conflicts; any other status (129 for an option an old git does not know) is no answer.
  if (out.status !== 1) return { result: 'unknown', files: [] };
  const [, ...rest] = String(out.stdout ?? '').split('\n');
  const files = [];
  for (const line of rest) {
    if (line === '') break;
    files.push(line);
  }
  return { result: 'conflict', files };
}

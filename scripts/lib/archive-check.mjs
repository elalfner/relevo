// The spec archive is committed after approval, so it may touch nothing but the specifications folder.
// Implements "Archive the specification just before merging" of openspec/changes/relevo-v1/specs/ship/spec.md.

/**
 * paths   every path changed in the working tree by the archive (from `git status --porcelain`)
 * Returns { ok, outside }.
 */
export function checkArchiveChanges(paths, specsDir = 'openspec') {
  const prefix = `${specsDir.replace(/\/+$/, '')}/`;
  const outside = paths.filter((p) => !p.startsWith(prefix));
  if (paths.length === 0) return { ok: false, outside: [], empty: true };
  return { ok: outside.length === 0, outside };
}

/** Paths from `git status --porcelain` output, including both sides of a rename. */
export function pathsFromPorcelain(output) {
  return String(output)
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> '))
    .map((p) => p.replace(/^"|"$/g, ''));
}

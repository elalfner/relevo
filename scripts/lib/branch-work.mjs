// Tells a branch that holds implementation from one that holds only the specification.
// Implements "A branch without implementation is not corrected" of openspec/specs/fix/spec.md.

/**
 * paths      every path that differs from the base branch
 * changeDir  e.g. "openspec/changes/31-summary"
 * Returns { implementation, files }: files are the paths outside the change folder.
 */
export function hasImplementation(paths, changeDir) {
  const prefix = `${changeDir.replace(/\/+$/, '')}/`;
  const files = paths.filter((p) => !p.startsWith(prefix));
  return { implementation: files.length > 0, files };
}

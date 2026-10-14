// Safe staging: commits must name the files they include. Never "add everything".

const FORBIDDEN_ARGS = new Set(['.', '*', ':/', '-A', '--all', '-a', '-u', '--update', '--patch', '-p', '-i', '--interactive']);

/**
 * Validate a list of paths to stage and return the arguments for `git add`.
 * Throws if the list is empty or tries to stage everything.
 */
export function explicitStageArgs(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('staging needs an explicit list of files; refusing to stage nothing or everything');
  }
  paths.forEach((p) => {
    if (typeof p !== 'string' || p.trim() === '') throw new Error('staging paths must be non-empty strings');
    if (FORBIDDEN_ARGS.has(p) || p.startsWith('-')) {
      throw new Error(`refusing to stage "${p}": name the files explicitly instead of staging everything`);
    }
    if (p.split('/').includes('..')) throw new Error(`refusing to stage "${p}": path leaves the repository`);
  });
  return ['add', '--', ...paths];
}

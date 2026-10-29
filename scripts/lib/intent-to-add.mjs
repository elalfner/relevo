// Makes the new files of the developer visible to `git diff` without staging their content, so QA can review the
// work in progress against the base branch. Implements "QA reviews the work in progress" of the go specification.

import { BASE_PATTERNS, isRestricted } from './restricted-paths.mjs';
import { explicitStageArgs } from './staging.mjs';

/**
 * Mark `paths` with `git add --intent-to-add`. Files that git ignores and files that do not exist are skipped, not errors.
 *   git(args) -> stdout; throws when git exits with an error
 *   exists(path) -> boolean
 * A restricted file is left out, by its name, so QA never gets its content in a diff.
 * Returns { marked, ignored, missing, restricted }.
 */
export function intentToAdd({ git, exists, paths, list = BASE_PATTERNS }) {
  explicitStageArgs(paths); // refuses "." and "-A", and an empty list
  const ignoredByGit = (path) => {
    try {
      git(['check-ignore', '-q', '--', path]);
      return true;
    } catch {
      return false; // exit 1 means "not ignored"
    }
  };
  const marked = [];
  const ignored = [];
  const missing = [];
  const restricted = [];
  paths.forEach((path) => {
    if (isRestricted(path, list)) restricted.push(path);
    else if (!exists(path)) missing.push(path);
    else if (ignoredByGit(path)) ignored.push(path);
    else marked.push(path);
  });
  if (marked.length > 0) git(['add', '--intent-to-add', '--', ...marked]);
  return { marked, ignored, missing, restricted };
}

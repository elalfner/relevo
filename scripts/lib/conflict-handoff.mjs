// Which conflicted files may be handed to the developer agent. Implements "Synchronise with the base branch first" of the
// review specification: a conflict inside the folder of the platform or the change folder goes to the developer agent;
// one that touches anything else, or a path no unattended run may change, stops the review as before.

import { checkProtected } from './protected-paths.mjs';
import { checkRestricted, restrictedList } from './restricted-paths.mjs';
import { checkScope } from './platform-scope.mjs';

/**
 * paths         the conflicted files (as `git diff --name-only --diff-filter=U` gives them)
 * within        the folder of the platform of the issue (`.` or null: the whole repository)
 * change        the change id: its specification folder, GLOSSARY.md and docs/adr/ are allowed too
 * allow         the entries of the issue's `Allow-paths:` line (a dependency file in conflict needs one)
 * rulesFile, platformPaths   as in checkProtected
 *
 * Returns { ok, paths, outside: [{ path, reason }] }. `ok` is true when every conflicted file may go to the agent.
 */
export function conflictHandoff(paths, { within = null, change = null, allow = [], rulesFile = null, platformPaths = [], restricted = restrictedList() } = {}) {
  const list = [...new Set((paths ?? []).filter(Boolean))];
  const outside = [];
  checkScope(list, { within: within ?? '.', change, allow }).violations.forEach((v) => outside.push({ path: v.path, reason: `outside the platform (${v.rule})` }));
  checkProtected(list, { allow, rulesFile, platformPaths }).violations.forEach((v) => {
    if (!outside.some((o) => o.path === v.path)) outside.push({ path: v.path, reason: v.tier === 'hard' ? `a protected path (${v.rule}) that no unattended run changes` : 'a dependency file that the issue does not allow in Allow-paths:' });
  });
  checkRestricted(list, restricted).violations.forEach((v) => {
    if (!outside.some((o) => o.path === v.path)) outside.push({ path: v.path, reason: 'a restricted file that no run reads or changes' });
  });
  return { ok: outside.length === 0, paths: list, outside };
}

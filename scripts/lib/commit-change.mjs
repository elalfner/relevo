// One safe way to commit: name the files, check protected paths, scan the diff, and only then commit.
// Implements "Safe commits" of the go specification and "Protected paths" of the security specification.
//
// `git(args) -> stdout` is injected so the logic can be tested; the command-line wrapper runs the real git.

import { checkScope } from './platform-scope.mjs';
import { checkProtected, formatViolations } from './protected-paths.mjs';
import { BASE_PATTERNS, checkRestricted, formatRestricted } from './restricted-paths.mjs';
import { formatFindings, scanDiff } from './scan.mjs';
import { explicitStageArgs } from './staging.mjs';

const restrictedViolations = (paths, list) => checkRestricted(paths, list).violations.map((v) => ({ ...v, tier: 'restricted' }));

/**
 * Stage `paths`, check them and commit only them.
 *   message    the commit message
 *   paths      the files or folders to commit, named one by one (never "." or "-A")
 *   allow      globs from the `Allow-paths:` line of the issue (dependency files only)
 *   rulesFile  the project rules file (`qa.rules_from`), which is never changed
 *   platformPaths  the folders of the platforms below the root, whose skill folders are never changed either
 *   within     the folder of the platform of the issue: files outside it are refused (`.` or null: no limit)
 *   change     the change id, whose specification folder may always be committed
 *   restricted the list of restricted files (`restrictedList(config)`); one in the paths ends in "restricted file in the diff"
 * Returns { ok, commit, findings, violations }. When something is found nothing is committed and the named paths
 * are unstaged again (files that were staged for other reasons stay staged).
 */
export function commitChange({ git, message, paths, allow = [], rulesFile = null, platformPaths = [], within = null, change = null, restricted = BASE_PATTERNS }) {
  if (!String(message ?? '').trim()) throw new Error('give a commit message');
  const addArgs = explicitStageArgs(paths);

  // A path that is protected, or restricted, is refused before anything is staged.
  const named = checkProtected(paths, { allow, rulesFile, platformPaths });
  const namedRestricted = restrictedViolations(paths, restricted);
  if (namedRestricted.length > 0) return { ok: false, commit: null, findings: [], violations: [...namedRestricted, ...named.violations.filter((v) => v.tier === 'hard')] };
  if (named.violations.some((v) => v.tier === 'hard')) return { ok: false, commit: null, findings: [], violations: named.violations };

  git(addArgs);
  const unstage = () => git(['reset', '-q', '--', ...paths]);

  // The folders named above may hold protected files: check what is really staged under them.
  const staged = git(['diff', '--cached', '--name-only', '--', ...paths]).split('\n').filter(Boolean);
  // A restricted file under a named folder is found by its name, and its content is never scanned or printed.
  const stagedRestricted = restrictedViolations(staged, restricted);
  if (stagedRestricted.length > 0) {
    unstage();
    return { ok: false, commit: null, findings: [], violations: stagedRestricted };
  }
  const violations = [
    ...checkProtected(staged, { allow, rulesFile, platformPaths }).violations,
    ...checkScope(staged, { within, change, allow }).violations,
  ];
  const findings = scanDiff(git(['diff', '--cached', '-U0', '--', ...paths]));
  if (violations.length > 0 || findings.length > 0) {
    unstage();
    return { ok: false, commit: null, findings, violations };
  }
  if (staged.length === 0) throw new Error('nothing to commit: none of the named paths has changes');

  // `--` with paths commits only those paths, so files staged for another reason are left alone.
  git(['commit', '-q', '-m', message, '--', ...paths]);
  return { ok: true, commit: git(['rev-parse', '--short', 'HEAD']).trim(), findings: [], violations: [] };
}

/** The lines to print when a commit was refused. Never contains a secret. */
export function refusalText({ findings, violations }) {
  const lines = [];
  const restricted = violations.filter((v) => v.tier === 'restricted');
  const others = violations.filter((v) => v.tier !== 'restricted');
  if (restricted.length > 0) lines.push(formatRestricted(restricted));
  if (others.length > 0) lines.push(formatViolations(others));
  if (findings.length > 0) lines.push(formatFindings(findings));
  return lines.join('\n');
}

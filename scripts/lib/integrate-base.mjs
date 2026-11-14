// Brings the base branch into a build before the hand-off. Implements "The base branch is integrated before the hand-off"
// of openspec/specs/go/spec.md.
//
// The merge is probed first, in memory (`probeMerge`). A clean merge is made; a conflict in generated files only is
// resolved by running the project's regenerate command; a conflict in any other file stops here, with the working tree
// as it was. Git and the shell are injected, so the whole thing is testable in a throwaway repository.

import { probeMerge } from './merge-probe.mjs';
import { matchesGlob } from './protected-paths.mjs';

/** Split conflicted files into the generated ones (they match a glob of `generated`) and the others. */
export function classifyConflicts(files, generated = []) {
  const list = [...new Set((files ?? []).filter(Boolean))];
  const isGenerated = (f) => generated.some((g) => matchesGlob(f, g));
  return { generated: list.filter(isGenerated), other: list.filter((f) => !isGenerated(f)) };
}

/**
 * run          (...args) => { status, stdout, stderr } for git, from the root of the repository; must not throw on a non-zero exit
 * runCommand   (command) => { status, stderr } runs the regenerate command from the folder of the platform
 * base         ref of the base branch, e.g. `origin/dev`
 * generated    globs of generated files, regenerate  the command that regenerates them
 *
 * Returns { outcome: 'unchanged' | 'merged' | 'regenerated' | 'conflict' | 'failed', files, message }.
 *   unchanged    the base has nothing the branch lacks; nothing was done
 *   merged       the base was merged without a conflict
 *   regenerated  the conflicted files were all generated, regenerated and the merge committed
 *   conflict     a file that is not generated conflicts; `files` lists it (and only it); the tree is as before
 *   failed       the merge or the command could not complete; the tree is as before; `message` says why
 */
export function integrateBase({ run, runCommand, base, generated = [], regenerate = null }) {
  const stdout = (r) => String(r?.stdout ?? '');
  if (run('merge-base', '--is-ancestor', base, 'HEAD').status === 0) return { outcome: 'unchanged', files: [], message: 'the base branch has nothing new' };

  const abort = () => run('merge', '--abort');
  const probe = probeMerge(run, base, 'HEAD');
  if (probe.result === 'conflict') {
    const { other } = classifyConflicts(probe.files, generated);
    if (other.length > 0) return { outcome: 'conflict', files: other, message: 'the base branch conflicts in files that are not generated' };
  }
  if (probe.result === 'clean') {
    const merged = run('merge', '--no-edit', base);
    if (merged.status === 0) return { outcome: 'merged', files: [], message: 'the base branch was merged' };
    abort();
    return { outcome: 'failed', files: [], message: `git merge failed: ${String(merged.stderr ?? '').trim().slice(0, 200)}` };
  }

  // A conflict in generated files, or a probe that could not run: merge without committing and look at what conflicts.
  const attempt = run('merge', '--no-commit', '--no-ff', base);
  if (attempt.status === 0) {
    const committed = run('commit', '--no-edit');
    if (committed.status === 0) return { outcome: 'merged', files: [], message: 'the base branch was merged' };
    abort();
    return { outcome: 'failed', files: [], message: 'git could not commit the merge' };
  }
  const unresolved = stdout(run('diff', '--name-only', '--diff-filter=U')).split('\n').filter(Boolean);
  const { generated: gen, other } = classifyConflicts(unresolved, generated);
  if (unresolved.length === 0 || other.length > 0) {
    abort();
    return unresolved.length === 0
      ? { outcome: 'failed', files: [], message: `git merge failed: ${String(attempt.stderr ?? '').trim().slice(0, 200)}` }
      : { outcome: 'conflict', files: other, message: 'the base branch conflicts in files that are not generated' };
  }
  if (!regenerate) {
    abort();
    return { outcome: 'failed', files: gen, message: 'integration.regenerate is not set, so the generated files cannot be regenerated' };
  }
  // Take our side so the command starts from a valid file, regenerate, and stage what the command changed among the generated files.
  gen.forEach((f) => run('checkout', '--ours', '--', f));
  const command = runCommand(regenerate);
  if (command.status !== 0) {
    abort();
    return { outcome: 'failed', files: gen, message: `the regenerate command failed: ${String(command.stderr ?? '').trim().slice(0, 200)}` };
  }
  const touched = new Set([...gen, ...stdout(run('diff', '--name-only')).split('\n').filter(Boolean).filter((f) => generated.some((g) => matchesGlob(f, g)))]);
  run('add', '--', ...touched);
  if (stdout(run('diff', '--name-only', '--diff-filter=U')).trim() !== '') {
    abort();
    return { outcome: 'failed', files: gen, message: 'files are still in conflict after the regenerate command' };
  }
  const committed = run('commit', '--no-edit');
  if (committed.status !== 0) {
    abort();
    return { outcome: 'failed', files: gen, message: 'git could not commit the merge' };
  }
  return { outcome: 'regenerated', files: gen, message: 'the generated files were regenerated and the base branch merged' };
}

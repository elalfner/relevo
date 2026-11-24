// The checks of a files project: what one person on this machine needs, and nothing of GitHub. `runChecks` of doctor.mjs
// judges everything it can; this keeps the results that apply to a project with no remote, adds the three that only a local project
// has, and so never reports as a failure or a warning something such a project cannot have (a remote, labels, rulesets, secrets, workflows).
// Implements "Doctor checks a local project by what it needs" (change local-tracker).

// Exact ids or prefixes (ending in a dot) of the results that apply.
const KEEP = ['tools.node', 'tools.openspec', 'tools.git', 'skills.', 'config.', 'openspec.root', 'evidence.ignored', 'platform.', 'interface.rules-file',
  'qa.', 'agents.', 'restricted.denials', 'restricted.settings', 'restricted.versioned', 'restricted.antigravity.settings'];
const applies = (id) => KEEP.some((k) => (k.endsWith('.') ? id.startsWith(k) : id === k));
const pass = (id, message) => ({ id, status: 'pass', message });
const fail = (id, message, fix) => ({ id, status: 'fail', message, fix });
const warn = (id, message, fix) => ({ id, status: 'warn', message, fix });

/**
 * @param {object[]} all  the results of runChecks
 * @param {{ isRepo: boolean, base: string, baseHasCommit: boolean, issuesDir: boolean, configCommitted?: boolean }} local
 */
export function localChecks(all, local) {
  const results = all.filter((r) => applies(r.id));
  results.push(local.isRepo
    ? pass('repo.local', 'this folder is a git repository')
    : fail('repo.local', 'this folder is not a git repository', 'run /relevo:init --local'));
  if (local.isRepo) {
    results.push(local.baseHasCommit
      ? pass('repo.base-branch', `the base branch ${local.base} exists and has a commit`)
      : fail('repo.base-branch', `the base branch ${local.base} does not exist or has no commit, so a build has nothing to start from`, `make a first commit on ${local.base} (/relevo:init --local does it for a new repository)`));
  }
  // A build runs in a worktree made from the base branch: without relevo.yml committed there, its scripts do not know it is a files project.
  if (local.isRepo && local.baseHasCommit) {
    results.push(local.configCommitted
      ? pass('config.committed', `relevo.yml is committed on ${local.base}, so a build sees it in its worktree`)
      : fail('config.committed', `relevo.yml is not committed on ${local.base}: a build runs in a worktree made from it and would not find the configuration`, `git add relevo.yml && git commit -m "chore: set up Relevo"`));
  }
  results.push(local.issuesDir
    ? pass('issues.dir', '.relevo/issues/ exists')
    : warn('issues.dir', '.relevo/issues/ does not exist; /relevo:issue creates it with the first issue, and the folder is committed with it', 'run /relevo:init --local, or write the first issue with /relevo:issue'));
  return results;
}

export const localHeader = 'Relevo doctor: a local project (tracker files), so GitHub, labels, rulesets, secrets and workflows are not checked';

// Answers the two `git` calls of `resumeState` (lib/resume-check.mjs) from the GitHub REST API, so that a job with no checkout (the
// `decide` job of the go workflow) can ask the same check that a run asks with git. Read-only.
//
//   git(['rev-parse', '--verify', '-q', 'refs/remotes/origin/<branch>'])        -> the branch exists, or the call throws (absent)
//   git(['log', '--format=...', 'origin/<base>..origin/<branch>'])               -> the commits over the base, newest first,
//                                                                                   as `sha \x1f subject \x1f body \x1e`
//
// `gh(args) -> stdout` is injected (`realGh` in lib/github.mjs). A branch that cannot be read is never taken for a resumable one: a
// failure other than "not found" on the first call lets the second call fail, which `resumeState` reports as `existing`.

const REF = /^[A-Za-z0-9._/-]+$/;
const plain = (name) => typeof name === 'string' && REF.test(name) && !name.includes('..');

export function restGit({ gh, repo }) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error('restGit needs repo as owner/name');
  return (args) => {
    if (args[0] === 'rev-parse') {
      const branch = String(args[args.length - 1] ?? '').replace(/^refs\/remotes\/origin\//, '');
      if (!plain(branch)) throw new Error('not a plain branch name');
      try {
        gh(['api', `repos/${repo}/git/ref/heads/${branch}`]);
      } catch (error) {
        // Only a branch that is not there is absent; any other failure is left for the next call to report.
        if (/404|Not Found/i.test(String(error?.message ?? '') + String(error?.stderr ?? ''))) throw error;
      }
      return '';
    }
    if (args[0] === 'log') {
      const range = /^origin\/([^.]+(?:\.[^.]+)*)\.\.origin\/(.+)$/.exec(String(args[args.length - 1] ?? ''));
      if (!range || !plain(range[1]) || !plain(range[2])) throw new Error('not a plain range of branches');
      const [, base, branch] = range;
      const result = JSON.parse(gh(['api', `repos/${repo}/compare/${base}...${branch}?per_page=100`]));
      const commits = Array.isArray(result.commits) ? result.commits : [];
      // The comparison pages its commits: judging a part of the branch could take a foreign commit for absent.
      if (typeof result.total_commits === 'number' && result.total_commits !== commits.length) throw new Error('the comparison returned only a part of the commits');
      return [...commits].reverse().map((c) => {
        const message = String(c?.commit?.message ?? '');
        const cut = message.indexOf('\n');
        const subject = cut === -1 ? message : message.slice(0, cut);
        const body = cut === -1 ? '' : message.slice(cut + 1);
        return `${c.sha}\x1f${subject}\x1f${body}\x1e`;
      }).join('');
    }
    throw new Error(`restGit does not answer "git ${args[0]}"`);
  };
}

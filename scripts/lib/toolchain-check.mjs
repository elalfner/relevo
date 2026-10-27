// Which of the tools that a profile lists are not on the path. `probe(tool)` says whether one answers; it is injected
// so that a test does not need the tools. An empty list checks nothing.

/**
 * What every Relevo job needs on the runner whatever the stack: a GitHub-hosted runner has them, a self-hosted one may not.
 * They are checked with the tools of the profile, so a runner without one stops before the agent, like one without Flutter.
 */
export const RUNNER_TOOLS = ['git', 'gh', 'jq', 'node'];

/** The tools that are missing, in the order of the profile and without repeats. */
export function missingTools(tools, probe) {
  const seen = new Set();
  return (tools ?? []).filter((tool) => {
    if (seen.has(tool)) return false;
    seen.add(tool);
    return !probe(tool);
  });
}

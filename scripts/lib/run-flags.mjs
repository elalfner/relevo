// The limits and the closed tool lists of an unattended run, written once. Implements "The limits of a run are
// written once" of the go specification: the local run (`go-local.mjs`) uses this function and a test compares its
// values with the `claude_args` of templates/workflows/relevo-go.yml, which people copy and so keeps literal values.

export const ALLOWED_TOOLS = 'Bash,Read,Write,Edit,Glob,Grep,Task';
export const DISALLOWED_TOOLS = 'WebFetch,WebSearch,Bash(curl:*),Bash(wget:*)';

/** The `claude -p` arguments that bound a run: turns, cost, and the closed lists of tools. */
export function runFlags(config) {
  return [
    '--max-turns', String(config.limits.run_max_turns),
    '--max-budget-usd', String(config.limits.run_max_cost),
    '--allowedTools', ALLOWED_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
  ];
}

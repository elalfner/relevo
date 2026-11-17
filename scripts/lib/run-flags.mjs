// The limits and the closed tool lists of an unattended run, written once. Implements "The limits of a run are
// written once" of the go specification: the local run (`go-local.mjs`) uses this function and a test compares its
// values with the `claude_args` of templates/workflows/relevo-go.yml, which people copy and so keeps literal values.

export const ALLOWED_TOOLS = 'Bash,Read,Write,Edit,Glob,Grep,Task';
export const DISALLOWED_TOOLS = 'WebFetch,WebSearch,Bash(curl:*),Bash(wget:*)';

/**
 * The `claude -p` arguments that bound a run: turns, cost, and the closed lists of tools. `json` asks for the final answer as
 * one JSON object, which a local run reads for what it used; the workflow does not ask for it, so its flags do not change.
 */
export function runFlags(config, { json = false } = {}) {
  return [
    ...(json ? ['--output-format', 'json'] : []),
    '--max-turns', String(config.limits.run_max_turns),
    '--max-budget-usd', String(config.limits.run_max_cost),
    '--allowedTools', ALLOWED_TOOLS,
    '--disallowedTools', DISALLOWED_TOOLS,
  ];
}

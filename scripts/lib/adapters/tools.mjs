// The tools of an agent, said in the words of the tool that will run it. Claude Code's subagents have every tool
// unless told otherwise (`disallowedTools`); Antigravity's have none beyond a small base unless a list is given, so
// the list is built here. A Claude tool with no entry stops the render: a wrong name can hang a subagent.

/** What a subagent of Claude Code can use when nothing restricts it, as far as Relevo's agents rely on it. */
export const CLAUDE_AGENT_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

/**
 * Claude tool -> the Antigravity tools that do the same. Names are the ones the CLI reports in the `init` event of
 * `agy -p --output-format stream-json` (checked by tests/adapter-antigravity.test.mjs when RELEVO_AGY_CHECK=1).
 * An empty list means the tool has no counterpart and is left out on purpose.
 */
export const ANTIGRAVITY_TOOLS = {
  Read: ['view_file', 'list_dir'],
  Write: ['write_to_file'],
  Edit: ['replace_file_content', 'multi_replace_file_content'],
  NotebookEdit: [],
  Bash: ['run_command'],
  Grep: ['grep_search'],
  Glob: ['find_by_name']
};

export class UnmappedToolError extends Error {
  constructor(tool) {
    super(`the Claude tool "${tool}" has no entry in the Antigravity tool table (scripts/lib/adapters/tools.mjs)`);
    this.tool = tool;
  }
}

const names = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);

/** The Claude tools an agent ends up with, from its `tools` (a list) or from everything minus `disallowedTools`. */
export function claudeToolsOf(meta) {
  if (meta.tools !== undefined) return names(meta.tools);
  const denied = new Set(names(meta.disallowedTools));
  return CLAUDE_AGENT_TOOLS.filter((t) => !denied.has(t));
}

/** The Antigravity tool names for an agent, without repeats, in a stable order. */
export function antigravityToolsOf(meta) {
  const out = [];
  for (const tool of claudeToolsOf(meta)) {
    if (!(tool in ANTIGRAVITY_TOOLS)) throw new UnmappedToolError(tool);
    for (const t of ANTIGRAVITY_TOOLS[tool]) if (!out.includes(t)) out.push(t);
  }
  const denied = names(meta.disallowedTools);
  for (const tool of denied) if (!(tool in ANTIGRAVITY_TOOLS)) throw new UnmappedToolError(tool);
  return out;
}

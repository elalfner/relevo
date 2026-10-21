// One workflow for every agent. The shared workflow marks the parts that are about the agent with comment lines
//   # relevo:<name> begin   ...   # relevo:<name> end
// and templates/agents/<agent>-step.yml holds, for an agent other than Claude, the lines that replace each block. Nothing
// else of the workflow changes, so a change to the gates, the queue or the reports is made once.

export const BLOCKS = ['credential', 'agent-step'];

const mark = (name, kind) => new RegExp(`^\\s*# relevo:${name} ${kind}\\s*$`);

/** The lines between the markers of a block, or null when the text has none; throws on a repeated or unbalanced one. */
export function blockRange(lines, name) {
  const begins = lines.flatMap((l, i) => (mark(name, 'begin').test(l) ? [i] : []));
  const ends = lines.flatMap((l, i) => (mark(name, 'end').test(l) ? [i] : []));
  if (begins.length === 0 && ends.length === 0) return null;
  if (begins.length !== 1 || ends.length !== 1 || ends[0] < begins[0]) throw new Error(`the block "${name}" must have one begin line followed by one end line`);
  return { begin: begins[0], end: ends[0] };
}

/** { name: [lines] } of the blocks that a file of an agent defines. */
export function blocksOf(text) {
  const lines = String(text).split('\n');
  const out = {};
  for (const name of BLOCKS) {
    const r = blockRange(lines, name);
    if (r) out[name] = lines.slice(r.begin + 1, r.end);
  }
  return out;
}

/**
 * The workflow for an agent. `claude` is the workflow as it is. Another agent gets the blocks of its file in place of
 * the ones the workflow marks; a marked block the file does not define is an error, not a silent leftover of Claude.
 */
export function agentWorkflow(workflow, build, blocksText) {
  if (build === undefined || build === 'claude') return workflow;
  if (!blocksText) throw new Error(`no file of blocks for the agent "${build}"`);
  const blocks = blocksOf(blocksText);
  const lines = workflow.split('\n');
  for (const name of BLOCKS) {
    const r = blockRange(lines, name);
    if (!r) continue;
    if (!blocks[name]) throw new Error(`the agent "${build}" does not define the block "${name}" that this workflow marks`);
    lines.splice(r.begin + 1, r.end - r.begin - 1, ...blocks[name]);
  }
  return lines.join('\n');
}

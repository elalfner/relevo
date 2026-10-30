// One workflow for every agent. The shared workflow marks the parts that are about the agent with comment lines
//   # relevo:<name> begin   ...   # relevo:<name> end
// and templates/agents/<agent>-step.yml holds, for an agent other than Claude, the lines that replace each block. Nothing
// else of the workflow changes, so a change to the gates, the queue or the reports is made once.

import { BASE_PATTERNS, claudeSettings } from './restricted-paths.mjs';

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

// The denials of restricted files in the step of Claude. They sit between `# relevo:restricted` markers inside the
// agent step and are written again from the list at every render, so a new entry of `restricted_paths` shows up in the
// next `init`. For another agent the whole agent step is replaced and the markers are gone, so this changes nothing.
const WORKSPACE = '${{ github.workspace }}';

/** The lines between the markers: a comment that says what they are and the `settings` input with the denials. */
export function restrictedLines(list = BASE_PATTERNS, indent = '          ') {
  const json = JSON.stringify(claudeSettings(list, { root: WORKSPACE }), null, 2).split('\n');
  return [
    '# Files that no agent reads (docs/security.md): Read denials for the file tools, and the sandbox read denials, which apply',
    '# only where a person enables the sandbox: it is NOT enabled here. Written from the base list and `restricted_paths` of',
    '# relevo.yml by /relevo:init, so do not edit this block by hand.',
    '# The action merges this input into the user-level settings of the runner, outside the repository, one top-level key',
    '# at a time: that is why it carries the whole `permissions` and `sandbox` objects.',
    'settings: |',
    ...json.map((l) => `  ${l}`),
  ].map((l) => `${indent}${l}`);
}

/** The workflow with the denials between its `relevo:restricted` markers written from `list`; no markers, no change. */
export function withRestricted(workflow, list = BASE_PATTERNS) {
  const lines = workflow.split('\n');
  const r = blockRange(lines, 'restricted');
  if (!r) return workflow;
  const indent = /^\s*/.exec(lines[r.begin])[0];
  lines.splice(r.begin + 1, r.end - r.begin - 1, ...restrictedLines(list, indent));
  return lines.join('\n');
}

/**
 * Do the denials in a workflow match the list? 'current' when the block between the markers is what `withRestricted` would
 * write, 'stale' when it differs (the list changed and `init` was not run again), 'missing' when the Claude step has no
 * block (a workflow copied before the denials existed), null when there is nothing to judge: no workflow, another agent's
 * step (its markers are replaced) or a block that is unbalanced.
 */
export function restrictedBlockState(workflow, list = BASE_PATTERNS) {
  if (typeof workflow !== 'string' || workflow === '') return null;
  try {
    if (blockRange(workflow.split('\n'), 'restricted') === null) return workflow.includes('anthropics/claude-code-action') ? 'missing' : null;
    return withRestricted(workflow, list) === workflow ? 'current' : 'stale';
  } catch {
    return null;
  }
}

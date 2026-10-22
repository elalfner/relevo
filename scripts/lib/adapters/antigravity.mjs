// Renders Relevo as a native Antigravity plugin: plugin.json, the skills, the agents and a copy of what the scripts
// need. Pure: it returns the text files and what to copy, and the caller writes them. What is changed, and why, was
// seen on Antigravity CLI 1.4.4 (docs/pilot-findings.md): the script path variable is not substituted, an agent needs
// its own tool list, `relevo:dev` is not a valid agent name, and a subagent call does not block.
import { antigravityToolsOf } from './tools.mjs';

export const PLUGIN_NAME = 'relevo';
export const COPIED_DIRS = ['scripts', 'stacks', 'templates'];
export const COPIED_FILES = ['LICENSE', 'NOTICE'];

// The skill `go` tells the agent to wait for each subagent. In Antigravity the call returns at once and the result
// arrives later as a message, so the wait has to be said in other words. The heading is looked for exactly: if the
// source changes it, the render fails instead of keeping a sentence that is wrong here.
const FOREGROUND_HEADING = '## Subagents run in the foreground';
const FOREGROUND_FOR_ANTIGRAVITY = `${FOREGROUND_HEADING}

Call \`relevo-dev\` and \`relevo-qa\` with \`invoke_subagent\`, one at a time. In Antigravity, subagents run in the background and the report arrives later as a message. After calling \`invoke_subagent\`, do NOT poll with \`manage_subagents\` or loop in any way; simply output that you are waiting for the subagent's report and end your turn without further tool calls. Antigravity will automatically reactivate you when the subagent finishes. Once reactivated with the subagent report, verify it, terminate the subagent using \`manage_subagents\` (\`Action: "kill"\`, \`ConversationIds: ["<subagent_id>"]\`) to free context, and proceed to the next step. If you cannot get a report or the subagent fails, take the failure path.
`;

const WHERE_RUNS_HEADING = '## Where it runs';
const WHERE_RUNS_FOR_ANTIGRAVITY = (pluginDir) => `${WHERE_RUNS_HEADING}

In the cloud the workflow starts this skill with the decision already made. A person can also start it on their machine: \`node ${pluginDir}/scripts/go-local.mjs <issue>\` runs it in a separate git worktree, with the same limits and tool lists as the workflow, and removes the worktree when it ends cleanly. Started by hand without that script, it needs a clean working tree (the preflight below stops otherwise).

**When \`$ARGUMENTS\` has \`--local\`**, do not build in this session: run \`node ${pluginDir}/scripts/go-local.mjs <issue>\`, show what it prints, and stop. The build happens in the process that script starts, in its own worktree and with the closed tool lists, which a plain session does not have.

**In an interactive Antigravity chat session** (started by hand without \`--decision\` and without \`--local\`), do not switch branches or build directly in this workspace root (multiple chat tabs share this workspace and will collide). Instead, isolate the build in an ephemeral worktree:
1. Call \`invoke_subagent\` with \`TypeName: "self"\`, \`Role: "relevo-builder"\`, and \`Workspace: 'share'\`, passing the build instructions for the issue.
2. Call \`schedule\` with \`DurationSeconds: 1200\` and \`TimerCondition: "<builder_conversation_id>"\` as a watchdog timer.
3. Yield your turn without further tool calls. If the builder completes, the timer cancels early and you are reactivated with its report. If the timer fires, the builder timed out.
4. Call \`manage_subagents\` with \`Action: "kill"\` and \`ConversationIds: ["<builder_conversation_id>"]\` to destroy the ephemeral worktree and clean up session state.
5. If the builder succeeded, report the outcome here; if it timed out or failed, take the failure path. The repository root remains clean on its base branch.
`;

const TOOL_WORDS = { Read: 'view_file', Write: 'write_to_file', Edit: 'replace_file_content' };

const q = (s) => JSON.stringify(String(s));

/** The path of the plugin is written into a shell command, so it must not need quoting. */
function checkPluginDir(dir) {
  if (!dir || !/^\//.test(dir) && !/^[A-Za-z]:[\\/]/.test(dir)) throw new Error(`the plugin folder must be an absolute path, got "${dir}"`);
  if (/[\s"'`$&;|<>()\\]/.test(dir.replace(/^[A-Za-z]:\\/, ''))) {
    throw new Error(`the plugin folder "${dir}" has a space or a shell character, which the commands in the skills cannot carry; choose another folder`);
  }
}

/** The text of a skill, an agent or a reference, as Antigravity needs it. */
export function adaptText(text, { pluginDir }) {
  let out = String(text).split('${CLAUDE_PLUGIN_ROOT}').join(pluginDir);
  out = out.replace(/relevo:(dev|qa)(?![\w-])/g, 'relevo-$1');
  for (const [from, to] of Object.entries(TOOL_WORDS)) out = out.split(`\`${from}\``).join(`\`${to}\``);
  if (out.includes(FOREGROUND_HEADING)) {
    const re = new RegExp(`${FOREGROUND_HEADING}\\n\\n[^\\n]*\\n`);
    if (!re.test(out)) throw new Error(`"${FOREGROUND_HEADING}" is no longer followed by one paragraph: update the Antigravity renderer`);
    out = out.replace(re, FOREGROUND_FOR_ANTIGRAVITY);
  }
  if (out.includes(WHERE_RUNS_HEADING)) {
    const re = new RegExp(`${WHERE_RUNS_HEADING}\\n\\n[\\s\\S]*?(?=\\n\\n## OpenSpec commands)`);
    if (!re.test(out)) throw new Error(`"${WHERE_RUNS_HEADING}" block could not be matched: update the Antigravity renderer`);
    out = out.replace(re, WHERE_RUNS_FOR_ANTIGRAVITY(pluginDir).trimEnd());
  }
  return out;
}

function skillFile(skill, ctx) {
  const { meta } = skill;
  const lines = ['---', `name: ${meta.name ?? skill.name}`, `description: ${q(meta.description)}`];
  if (meta['argument-hint'] !== undefined) lines.push(`argument-hint: ${q(meta['argument-hint'])}`);
  if (String(meta['disable-model-invocation']) === 'true') lines.push('disable-model-invocation: true');
  lines.push('---', '');
  return { path: `skills/${skill.name}/SKILL.md`, content: `${lines.join('\n')}\n${adaptText(skill.body, ctx).replace(/^\n+/, '')}` };
}

function agentFile(agent, ctx) {
  const name = `${PLUGIN_NAME}-${agent.name}`;
  const tools = antigravityToolsOf(agent.meta);
  const head = ['---', `name: ${name}`, `description: ${q(agent.meta.description)}`, `tools: [${tools.join(', ')}]`, '---', ''];
  return { path: `agents/${name}.md`, content: `${head.join('\n')}\n${adaptText(agent.body, ctx).replace(/^\n+/, '')}` };
}

/**
 * source: the result of readSource. ctx.pluginDir: the absolute folder where the plugin will live.
 * Returns { files: [{ path, content }], copy: { dirs, files } } with paths relative to the plugin folder; `copy`
 * says what to take from the package unchanged.
 */
export function renderAntigravity(source, ctx) {
  checkPluginDir(ctx.pluginDir);
  const m = source.manifest;
  const manifest = { name: PLUGIN_NAME, displayName: m.displayName ?? 'Relevo', version: source.version, description: m.description, author: m.author };
  const files = [{ path: 'plugin.json', content: `${JSON.stringify(manifest, null, 2)}\n` }];
  for (const skill of source.skills) {
    files.push(skillFile(skill, ctx));
    for (const f of skill.files) {
      files.push({ path: `skills/${skill.name}/${f.path}`, content: f.path.endsWith('.md') ? adaptText(f.content, ctx) : f.content });
    }
  }
  for (const agent of source.agents) files.push(agentFile(agent, ctx));
  return { files, copy: { dirs: COPIED_DIRS, files: COPIED_FILES } };
}

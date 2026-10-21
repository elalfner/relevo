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

Call \`relevo-dev\` and \`relevo-qa\` with \`invoke_subagent\`, one at a time. The call returns at once and the report arrives later as a message: wait for it, do the next step only after it, and never end your turn while a subagent is running. This session is unattended, so a final answer such as "I'll wait for its report" ends the run with the issue stuck on \`building\` and nothing posted. If you cannot get a report, take the failure path.
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

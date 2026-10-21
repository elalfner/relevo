// `relevo init`: set up Relevo for the tools a team uses, in the project or on the machine, and `relevo update` for the
// plugins that were rendered. Claude Code keeps being installed by `claude plugin` (see cli.mjs); another tool gets a
// plugin rendered from the same sources (see adapters/). Everything that talks to the outside is injected.
import { execute } from './cli.mjs';
import { findRecords, installAntigravity } from './adapters/install.mjs';

export const TOOLS = [
  { value: 'claude', label: 'Claude Code: the plugin, which updates itself and adds no files to the repository' },
  { value: 'antigravity', label: 'Antigravity: the IDE, the App and the CLI, with a plugin rendered for them' }
];
export const INIT_SCOPES = ['project', 'machine'];

/** Parses what follows `init`: { tools, scope, yes, force } or { error }. `user` is accepted for `machine`. */
export function parseInitArgs(rest) {
  const out = { command: 'init', tools: null, scope: null };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const take = (name) => (arg === name ? rest[++i] : arg.slice(name.length + 1));
    if (arg === '--tools' || arg.startsWith('--tools=')) out.tools = String(take('--tools') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--scope' || arg.startsWith('--scope=')) out.scope = take('--scope');
    else if (arg === '--yes' || arg === '-y') out.yes = true;
    else if (arg === '--force') out.force = true;
    else return { error: `unknown option "${arg}"` };
  }
  if (out.scope === 'user') out.scope = 'machine';
  if (out.scope !== null && !INIT_SCOPES.includes(out.scope)) return { error: `the scope of init must be project or machine` };
  if (out.tools) {
    const unknown = out.tools.filter((t) => !TOOLS.some((x) => x.value === t));
    if (unknown.length) return { error: `unknown tool "${unknown[0]}"; the tools are ${TOOLS.map((t) => t.value).join(', ')}` };
    if (out.tools.length === 0) return { error: '--tools needs at least one tool' };
  }
  return out;
}

/** Like resolveScope of cli.mjs, with the choices project and machine. */
export function resolveInitScope({ given = null, interactive = false, inRepo = false }) {
  if (given) return { scope: given };
  const preferred = inRepo ? 'project' : 'machine';
  if (interactive) return { ask: true, preferred };
  const why = inRepo ? 'this folder is inside a git repository, so the project is used' : 'this folder is not inside a git repository, so the machine is used';
  return { scope: preferred, reason: `no --scope given and no terminal: ${why}` };
}

export function initScopeChoices({ cwd, inRepo }) {
  return [
    { value: 'project', label: `Project (${cwd})${inRepo ? '' : ' [not a git repository]'}: files in the repository, shared with your team` },
    { value: 'machine', label: 'Machine: every project of this machine' }
  ];
}

/** The top folder of the git repository of the current folder, or null. */
export function repoRoot(run) {
  const r = run('git', ['rev-parse', '--show-toplevel']);
  return r.code === 0 && r.output.trim() ? r.output.trim() : null;
}

const NEXT_STEP = 'Next: /relevo:init (the skill) sets up the labels and the rules of the repository; it is a separate step from this command.';

/** Sets up each tool, in order, and stops at the first failure. Returns { code, lines }. */
export function runInit({ tools, scope, force = false }, deps) {
  const lines = [];
  for (const tool of tools) {
    lines.push(`== ${TOOLS.find((t) => t.value === tool).label.split(':')[0]}`);
    const r =
      tool === 'claude'
        ? execute({ command: 'install', scope: scope === 'machine' ? 'user' : 'project' }, deps)
        : installAntigravity({ packageRoot: deps.packageRoot, scope, root: deps.root, home: deps.home, run: deps.run, has: deps.has, force });
    lines.push(...r.lines);
    if (r.code !== 0) return { code: r.code, lines };
  }
  lines.push(NEXT_STEP);
  return { code: 0, lines };
}

/**
 * Updates Claude Code as before and renders again the plugins that `init` made. With neither, it says what it always
 * said. The code is the worst of the parts, and each part says what it did.
 */
export function runUpdate({ scope = null, force = false }, deps) {
  const records = findRecords({ root: deps.root, home: deps.home });
  if (records.length === 0) return execute({ command: 'update', scope }, deps);
  const lines = [];
  let code = 0;
  if (deps.has('claude')) {
    lines.push('== Claude Code');
    const r = execute({ command: 'update', scope }, deps);
    lines.push(...r.lines);
    code = r.code;
  }
  for (const rec of records) {
    lines.push(`== Antigravity (${rec.scope})`);
    const r = installAntigravity({ packageRoot: deps.packageRoot, scope: rec.scope, root: deps.root, home: deps.home, run: deps.run, has: deps.has, force, update: true });
    lines.push(...r.lines);
    code = code || r.code;
  }
  return { code, lines };
}

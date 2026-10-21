// The commands behind `relevo`. They only drive `claude plugin`, so Claude Code stays the one place that installs
// and updates a plugin; nothing here writes a file. `run` and `has` are injected so a test can use a fake `claude`.

export const MARKETPLACE = 'elalfner/relevo';
export const MARKETPLACE_NAME = 'relevo';
export const PLUGIN_ID = 'relevo@relevo';
export const SCOPES = ['user', 'project', 'local'];

export const USAGE = [
  'usage: relevo <command> [--scope user|project|local]',
  '',
  '  install   add the marketplace and install the plugin (default scope: user)',
  '  update    update the marketplace and the plugin',
  '  doctor    check this repository (the same as /relevo:doctor)',
  '  version   print the version of this package',
  '',
  'user: every project of this machine. project: this repository, shared through .claude/settings.json. local: this repository, only you.'
].join('\n');

/** Parses the arguments; { error } when they are not valid. */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') return { command: 'help' };
  if (!['install', 'update', 'doctor', 'version'].includes(command)) return { error: `unknown command "${command}"` };
  let scope = 'user';
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--scope') { scope = rest[i + 1]; i += 1; } else if (arg.startsWith('--scope=')) scope = arg.slice(8);
    else return { error: `unknown option "${arg}"` };
  }
  if (!SCOPES.includes(scope)) return { error: `the scope must be one of ${SCOPES.join(', ')}` };
  return { command, scope };
}

/** The `claude` invocations of a command, in order. */
export function steps(command, scope) {
  if (command === 'install') {
    return [
      { label: 'add the marketplace (only .claude-plugin/ is downloaded)', args: ['plugin', 'marketplace', 'add', MARKETPLACE, '--scope', scope, '--sparse', '.claude-plugin'] },
      { label: 'install the plugin', args: ['plugin', 'install', PLUGIN_ID, '--scope', scope] }
    ];
  }
  if (command === 'update') {
    return [
      { label: 'update the marketplace', args: ['plugin', 'marketplace', 'update', MARKETPLACE_NAME] },
      { label: 'update the plugin', args: ['plugin', 'update', PLUGIN_ID, '--scope', scope] }
    ];
  }
  return [];
}

/**
 * Runs a command. Returns { code, lines }: the lines to print and the exit code. Stops at the first failing step
 * and says which one, so the person knows what was already done.
 */
export function execute({ command, scope }, { run, has, version, doctorScript }) {
  const lines = [];
  if (command === 'version') return { code: 0, lines: [version] };
  if (command === 'doctor') {
    const r = run(process.execPath, [doctorScript]);
    return { code: r.code, lines: [r.output.trimEnd()] };
  }
  if (!has('claude')) {
    return { code: 1, lines: ['Claude Code is required and "claude" was not found on the path.', 'Install it (https://code.claude.com/docs) and run this command again; nothing was changed.'] };
  }
  const list = steps(command, scope);
  for (let i = 0; i < list.length; i += 1) {
    const step = list[i];
    lines.push(`[${i + 1}/${list.length}] ${step.label}`);
    const r = run('claude', step.args);
    if (r.output.trim()) lines.push(r.output.trimEnd());
    if (r.code !== 0) {
      lines.push(`The step "${step.label}" failed${i > 0 ? `; the steps before it were done (${list.slice(0, i).map((s) => s.label).join(', ')})` : ''}. Fix the cause and run the command again: it is safe to repeat.`);
      return { code: r.code || 1, lines };
    }
  }
  const where = { user: 'for this machine', project: 'for this repository (declared in .claude/settings.json, so commit it to share it)', local: 'for this repository, only for you' }[scope];
  lines.push(command === 'install'
    ? `Relevo is installed ${where}. Restart Claude Code and run /relevo:doctor.`
    : 'Relevo is up to date. Restart Claude Code to apply it.');
  return { code: 0, lines };
}

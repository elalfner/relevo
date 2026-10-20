// The OpenSpec commands each part of Relevo may use. Implements "OpenSpec commands come from a closed list" of the
// go specification. A test (tests/openspec-commands.test.mjs) compares this table with the text of the skill and the
// agents, so a command cannot be added to a prompt without being added here, on purpose.
//
// Commands are written the way `openspecSubcommand` normalises them:
//   `--version`, `list`, `new change`, `status`, `validate`, `instructions apply`, `instructions <artifact>`.

export const OPENSPEC_COMMANDS = {
  go: ['--version', 'list', 'new change', 'status', 'instructions <artifact>', 'instructions apply', 'validate'],
  // The developer and QA only read the state of the change; they never create or archive anything.
  dev: ['status', 'instructions apply'],
  qa: ['status', 'instructions apply'],
  // `think` and `issue` only read: the specifications and the changes that exist.
  think: ['list', 'show', 'status'],
  issue: ['list', 'show'],
  // `review` only finds the change folder.
  review: ['list'],
};

/** Subcommands that no unattended run may use, whatever the list says. */
export const NEVER = ['init', 'archive', 'update', 'sync'];

/**
 * Normalise what follows `openspec` in a command into the form used by the table.
 * `['instructions', 'apply', '--change', 'x']` -> `instructions apply`; `['instructions', 'specs']` -> `instructions <artifact>`.
 * Returns null when there is nothing to normalise.
 */
export function openspecSubcommand(tokens) {
  const [first, second] = tokens.filter(Boolean);
  if (!first) return null;
  if (first === '--version' || first === '-V') return '--version';
  if (first === 'new') return second === 'change' ? 'new change' : 'new';
  if (first === 'instructions') {
    if (!second || second.startsWith('-')) return 'instructions';
    return ['apply', 'archive'].includes(second) ? `instructions ${second}` : 'instructions <artifact>';
  }
  return first;
}

/** Is the command (the tokens after `openspec`) allowed for `part` (`go`, `dev`, `qa`, `think`, `issue` or `review`)? */
export function isAllowed(part, tokens) {
  const sub = openspecSubcommand(tokens);
  return Boolean(sub) && (OPENSPEC_COMMANDS[part] ?? []).includes(sub);
}

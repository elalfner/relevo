# Design

## Context

`scripts/lib/cli.mjs` parses the arguments, builds the `claude plugin` invocations (`steps`) and runs them with injected `run` and `has`. `parseArgs` defaults the scope to `user`, for `install` and `update`. Observed on Claude Code 2.1.305 with the plugin installed at the user and the project scope: `claude plugin update relevo@relevo` with no scope updated the installation of the current project; `--scope project` reported it up to date; `--scope local` failed because it was not installed there. `claude plugin list --json` lists each installation with its scope and project path.

## Goals / Non-Goals

**Goals:**
- The person who forgets `--scope` is asked, and the safe answer is preselected.
- No dependency, and nothing that can hang a script.

**Non-Goals:**
- Prompting for anything but the scope.
- Installing at two scopes in one run.
- Reading `claude plugin list` to say where it is installed; a possible improvement.

## Decisions

- **Resolve the scope in one pure function.** `resolveScope({ given, interactive, inRepo })` returns the scope to use or the instruction to ask: given wins; interactive asks with `default` = project in a repository and user outside one; non-interactive returns the default and a reason string that the command prints. `parseArgs` stops defaulting and returns `scope: null` when none is given.
- **Own selector, no library.** `scripts/lib/select.mjs`: a function that takes the choices, the default index, an input stream and an output stream, draws the list, reads `keypress` events (up, down, Enter, Esc, Ctrl-C, and the digits 1 to 3 as a shortcut) and resolves the chosen value or null. A test drives it with a simulated stream. Alternatives: `@clack/prompts` or `@inquirer/prompts` (a dependency tree in a package whose value is that it is small and has none).
- **Interactive means both ends are terminals.** `process.stdin.isTTY && process.stdout.isTTY`; with either redirected it behaves as non-interactive.
- **A git repository is found with `git rev-parse --is-inside-work-tree`**, run in the current folder, through the same injected `run`; when `git` is missing the answer is "not a repository".
- **`update` without a scope passes none.** The verified behaviour of Claude Code picks the installation of the current project; a scope given by the person is passed.
- **Messages.** The list shows the folder for the project option (`/path/to/repo`), and after the install the command prints `Scope: project (.claude/settings.json of /path/to/repo)`.

## Risks / Trade-offs

- A terminal emulator that does not send the standard key sequences leaves the digits and Enter as the way to choose; the list says so in its last line.
- `git` can be missing on a machine that has `claude`; then the default falls back to the machine, which is the old behaviour, and says why.
- Raw mode must be restored on every exit path, including Ctrl-C and an exception; a test checks that it is.

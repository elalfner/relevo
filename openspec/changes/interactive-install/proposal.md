# Proposal

## Why

`relevo install` installs for the machine unless the person remembers `--scope project`. The project scope is what a repository that uses Relevo wants (the plugin is declared in `.claude/settings.json`, so a teammate is offered it, and it costs the always-on tokens only where it is used), and a person who forgets the flag gets the other one silently. Asking is better than a flag to remember: a short list in the terminal, chosen with the arrows, with the project preselected. Looking at `relevo update` for this change also found a bug: it passes `--scope user` by default, so a plugin installed at the project scope is not the one it updates; `claude plugin update` without a scope already picks the installation of the current project.

## What Changes

- `relevo install` without `--scope`, in a terminal, shows a list: **Project** (with the folder that will get `.claude/settings.json`), **Machine** and **Only me, in this project**; the arrows move, Enter confirms, Ctrl-C and Esc cancel and change nothing. The project is preselected.
- Without a terminal (a script, CI) and without `--scope`, it never waits: it uses the project when the folder is inside a git repository and the machine when it is not, and says so in one line, with why.
- When the folder is not inside a git repository, the list preselects the machine and the project option says it is not a repository.
- `--scope` still skips everything, as now.
- `relevo update` passes a scope only when the person gives one; without it, `claude plugin update` picks the installation of the current project (verified on Claude Code 2.1.305, with the plugin installed at both scopes).
- The installed message names the scope it used and what it wrote. The usage text and the pages (README, Install, Get started; English and Spanish) say the list exists.
- Out of scope: a prompt for anything else, and installing the plugin at more than one scope in one run (`/relevo:init` declares the project scope when the plugin is installed for the machine).

## Capabilities

### New Capabilities

### Modified Capabilities
- `plugin-distribution`: the command asks for the scope and defaults to the project.

## Impact

- `scripts/lib/cli.mjs` (scope resolution, the update default), a small selector `scripts/lib/select.mjs` with no dependency, `scripts/cli.mjs`, their tests (with a simulated keyboard and a fake `claude`), the three pages and the changelog.
- No new dependency: the selector is about forty lines on `readline` and the raw keypress events.

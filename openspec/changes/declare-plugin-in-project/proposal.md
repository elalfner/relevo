# Proposal

## Why

A person who installs Relevo for the machine (the default of `claude plugin install`, and of the install a newcomer may run by habit) works, but the repository does not say it uses Relevo: a teammate who clones it is not offered the plugin and finds no `/relevo:` commands. The remedy is one more install at the project scope, which records the plugin in `.claude/settings.json` so it is committed with the repository. Today nothing reminds the person, and `init`, which already sets the repository up for Relevo, does not do it. Checked on Claude Code 2.1.305: installing at the machine scope and then at the project scope in the same folder is accepted, leaves both installations enabled and writes the declaration that has to be committed.

## What Changes

- `/relevo:init` plans one more line: declare the plugin in the project. When the repository's `.claude/settings.json` already declares the Relevo marketplace and enables the plugin the line is "ok"; otherwise it is an install the person confirms, with its exact command shown, like the OpenSpec install: `claude plugin marketplace add elalfner/relevo --scope project --sparse .claude-plugin && claude plugin install relevo@relevo --scope project`. The new `.claude/settings.json` is left for the person to commit, like the other new files.
- `/relevo:doctor` warns when the repository does not declare the plugin, says what a teammate misses, and gives the fix. It warns, not fails: a person who works alone and installed for the machine is fine.
- The pages of the commands (`init`, `doctor`) and Get started say it; English and Spanish.
- Out of scope: an interactive `relevo install` that asks the scope, which is a separate change; and changing what `claude plugin install` does by default, which Relevo cannot.

## Capabilities

### New Capabilities

### Modified Capabilities
- `init-doctor`: init plans the declaration of the plugin in the project; doctor warns when it is missing.

## Impact

- `scripts/lib/doctor.mjs` (a fact and a check), `scripts/lib/init.mjs` (a plan item), `skills/init/SKILL.md` if it lists the installs, the commands and Get started pages, the changelog and the tests.
- A repository gets a new tracked file, `.claude/settings.json`, or a few lines in the one it has; the plan says so and nothing is written without a yes.

# Design

## Context

`gatherFacts` of `scripts/lib/doctor.mjs` reads the repository through probes (`exists`, `read`) and both `doctor` and `init` build on its facts. `planInit` lists installs as items with `install: true` and an exact `command`; the skill shows each command and runs it only after a yes, and `applyPlan` skips them. The plugin cannot install itself the first time, but once it is installed, `init` runs inside Claude Code and may run the official commands. Observed on Claude Code 2.1.305: after `claude plugin install relevo@relevo` at the user scope, `claude plugin marketplace add ... --scope project` answers that the marketplace is already on disk and is now declared in project settings, and `claude plugin install ... --scope project` succeeds; `claude plugin list` shows both scopes enabled, and `.claude/settings.json` holds `extraKnownMarketplaces` (with the sparse path) and `enabledPlugins`.

## Goals / Non-Goals

**Goals:**
- A repository that uses Relevo says so, whatever scope the first person installed with.
- The person sees and confirms the exact command; nothing is written by hand.

**Non-Goals:**
- Editing `.claude/settings.json` ourselves.
- An interactive scope choice in the `relevo` command.
- Judging `.claude/settings.local.json` or the user settings: only what is committed reaches teammates.

## Decisions

- **Use the official commands, as one install item.** The item's command is the two `claude plugin` commands joined by `&&`, so the person confirms one exact line, as for the other installs. Writing the JSON ourselves would duplicate what Claude Code does and could disagree with it in the next version.
- **One new fact, `pluginDeclared`.** From `.claude/settings.json`: `{ declared: true }` when `extraKnownMarketplaces.relevo` exists and `enabledPlugins["relevo@relevo"]` is true; `{ declared: false }` when the file is missing or lacks them; `{ unreadable: true }` when the JSON does not parse. Doctor and init share it.
- **Doctor warns.** A person who works alone and installed for the machine is correct; the warning matters for a team. It names what a teammate misses.
- **Init's line for an unreadable file is manual.** Rewriting a broken file could lose what is in it.
- **The file is left uncommitted**, with the same sentence as the other new files in the plan.

## Risks / Trade-offs

- Running the install for the project when the plugin is also installed for the machine gives two enabled installations. Claude Code accepts it and shows both; a duplicate is harmless and the person can remove the user-scope one.
- A repository that is not Relevo's but is used to try the commands gets a declaration it did not want; the line is only an offer and a no is respected.
- The check reads the committed settings file by name; a project that keeps its settings elsewhere is told to declare it anyway. It is a warning.

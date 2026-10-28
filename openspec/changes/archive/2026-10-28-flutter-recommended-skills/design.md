# Design

## Context

See proposal.md for the motivation. What exists today:

- `doctor` has four levels (pass, fail, warn, note); a note is information that asks for no action. It already lists Claude Code's plugins (`claude plugin list --json`) and the Antigravity plugins `init` rendered (`f.adapters`).
- `init` plans install items that carry an exact command, and runs each one only after a yes. Declining a required one leaves a dependency missing; there is no optional install yet.
- The commands to install skills live in a code table (`SKILL_INSTALL` in `scripts/lib/doctor.mjs`), not in the profiles. `requires_skills` and the role lists of a profile name skills that Relevo resolves from `.agents/skills` or `.claude/skills` on the base branch and hands to an agent.
- What the Flutter team publishes, read from `flutter/agent-plugins` on 2026-10-28: the marketplace `dart-flutter` with the plugin `dart-flutter` (it installs the skills and the Dart MCP server `dart mcp-server`); the `skills/` folder holds the 10 `flutter-*` skills and the `dart-*` ones (`dart-lang/skills` is their source, and the docs give a command for each repository); no skill has a `scripts/` folder, two have `examples/*.dart`.
- The Antigravity IDE installs the same integration from its settings and the page does not say where it puts the files, so no check can see it.

## Goals / Non-Goals

**Goals:**

- Tell a Flutter team, per tool, that it works better with the official skills, and offer the install without ever requiring it.
- Keep every shipped behavior intact: nothing fails, blocks or changes exit status because these skills are missing.

**Non-Goals:**

- Handing these skills to `dev` and `qa`, or resolving them in `go`: Claude Code and Antigravity load skills by name and description, and the plugin skills are not in a folder Relevo reads.
- Editing the project's rules file, `.agents/mcp_config.json` or `.claude/settings.json`.
- Changing the cloud workflows to install the plugin on the runner.
- A recommendation mechanism for the other stacks.

## Decisions

**The recommendation lives in code, not in the profile.** A table next to `SKILL_INSTALL` maps the stack `flutter` to its routes: for each tool, the detection (a plugin id, a skill-folder prefix) and the install commands. Alternative: a new header key such as `recommends_skills` in `stacks/flutter.md`. Rejected: the plugin of Claude Code is not a skill name, the commands and the detection differ per tool, and a new key would need parsing, merging with the repository's layer and tests for something the agents never read. The profile stays as it is, and a requirement says it carries no required skill.

**Two routes, one per way a tool loads skills.** Claude Code: the plugin `dart-flutter@dart-flutter` (it also brings the MCP server). Antigravity: `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes`. The Flutter docs give the same command for `dart-lang/skills` too, but a run in a scratch folder on 2026-10-28 showed that the first repository already installs the Dart skills (the same `dart-*` folders as `dart-lang/skills`), so the second command adds nothing and is not offered. A skill folder starting with `flutter-` under `.agents/skills` or `.claude/skills` counts as installed for any tool, because the folders are what the skills command writes and what both tools read.

**Which tools count as in use.** Claude Code is always checked when `claude` can list its plugins; when it cannot, nothing is reported. Antigravity is checked when `f.adapters` is not empty or `agent.build` is `antigravity`. The IDE route cannot be detected, so the Antigravity note says it exists and says `doctor` cannot see it, instead of claiming the skills are missing.

**The note is a note.** It uses the existing `note` level, so the report lists it under NOTES and the exit status ignores it. The passed state is reported too, so a team that installed the skills sees them acknowledged.

**Optional installs in `init`.** The plan items for the recommendation are marked optional. They use the same confirmation as any install, but declining does not add the "still missing, `go` will not run" sentence that a required install carries. Anything that is not a command (IDE screen, MCP entry, rules) is a manual item, because `init` never writes a rules file or a configuration file of another tool.

**Rules stay manual.** The Flutter guide says plugins do not load rules by themselves and tells the person to copy the ones they want into the project's rules file. Relevo does not decide which rules a project adopts, and the project's rules file wins over any skill.

**Scope of the Claude Code install.** `init` offers the commands exactly as the Flutter docs give them, which install for the user (`claude plugin install` defaults to `--scope user`, checked with `claude plugin install --help`). `--scope project` would declare the plugin in the repository so that a teammate who clones it is prompted; it is a documented option, not the offered command, because it writes `.claude/settings.json` and a recommendation is not worth a file to commit.

## Risks / Trade-offs

- [The repository or the plugin is renamed again] → The commands live in one table and in the docs; a wrong command makes a note stale, not a run fail. The table records the date it was checked.
- [A subagent of Relevo (`dev`, `qa`) may not see the skills of a plugin] → Not verified. The recommendation promises "works better with" only for the session; task 1.3 checks it once and the docs say what was found, without a claim that was not tested.
- [The Antigravity IDE install is invisible to `doctor`] → The note says so and the pass state is not shown for it.
- [The plugin does not reach the cloud runner] → The docs say which route travels; the workflows are untouched.
- [`npx skills add` writes `.agents/skills/` and creates or updates `skills-lock.json` at the root (seen in the scratch run), and both are protected paths for an unattended run] → A person runs it on a branch; the lock file it writes records the hashes of the skills it installed, which is what `doctor` compares.

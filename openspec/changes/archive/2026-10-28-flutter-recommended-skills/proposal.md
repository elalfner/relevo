# Proposal

## Why

The Flutter profile ships no skill, and `doctor` and `init` say nothing about the official Dart and Flutter skills that the Flutter team publishes (`flutter/agent-plugins`, also installed by the plugin `dart-flutter`, which brings the Dart MCP server). A team that uses them gets better code from the agents, but Relevo neither tells it nor helps it install them. They must not be required: the profile works without them, and the way to install them differs by tool (a Claude Code plugin, a skills folder for the Antigravity CLI, a settings screen in the Antigravity IDE).

## What Changes

- **`doctor` notes the recommended skills** for a repository with a `flutter` platform, once per coding agent the repository uses: Claude Code, and Antigravity when the repository has an Antigravity plugin or builds with it. The result is a pass when the skills are there and a note, never a warning or a failure, when they are not. The note carries the install commands. It reports nothing for a tool it cannot check.
- **`init` offers the installs**, optional and one command at a time, with the same confirmation it asks for any install: the two `claude plugin` commands for Claude Code, and the `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes` command for the Antigravity CLI (it installs the Flutter and the Dart skills together). What is not a command is listed as a manual step: the Antigravity IDE screen, the `.agents/mcp_config.json` entry for the Dart MCP server, and copying the official rules to the project's rules file. `init` writes none of them.
- **A missing recommended skill never blocks anything**: it does not change the exit status of `doctor`, it is not a `requires_skills` entry, and `go`, `review` and `ship` ignore it.
- **The stacks page** (`docs/stacks.md`, `docs/stacks.es.md`) explains the two routes, that nothing is required, that the plugin of Claude Code does not travel to the cloud runner while a skills folder committed to the repository does, and that the official rules are copied by hand.
- The profile `stacks/flutter.md` does not change, and Relevo does not pass these skills to the `dev` and `qa` agents: Claude Code and Antigravity discover skills by name and description.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: new requirements for the `doctor` note, for the rule that a recommended skill never blocks, and for the optional installs and manual steps of `init`.
- `documentation`: a new requirement for what the stacks page says about the recommended Flutter skills.

## Impact

- `scripts/lib/doctor.mjs` (a check for the recommendation, and the facts it reads: the plugins Claude Code lists, the skills folders, whether the repository uses Antigravity).
- `scripts/lib/init.mjs` (optional install items and manual items; the wording of declining).
- `skills/init/SKILL.md` and `skills/doctor/SKILL.md` (a sentence each).
- `docs/stacks.md`, `docs/stacks.es.md`, `CHANGELOG.md`.
- Tests: `tests/doctor.test.mjs`, `tests/init.test.mjs`, `tests/skill-init-doctor.test.mjs`, and the documentation checks.
- No change to the profile, to `relevo.yml`, to the workflows, to the agents or to `skills-lock.json`.

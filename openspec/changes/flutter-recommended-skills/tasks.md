# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 Read the shape of `claude plugin list --json` (a plugin's `id` is `name@marketplace`, with `scope`, and `projectPath` for the project scope; the marketplace manifest names the plugin `dart-flutter` in marketplace `dart-flutter`) without installing the plugin on the machine; the shape goes into the test fixtures of task 2.1
- [x] 1.2 Ran `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes` in a scratch folder: the skills land under `.agents/skills/` (the 10 `flutter-*` and the `dart-*` ones, with `examples/*.dart` and no `scripts/`) and `skills-lock.json` is written at the root; `dart-lang/skills` adds nothing, so its command is not offered
- [x] 1.3 In a session of Claude Code with the plugin installed, start the `relevo:dev` agent and ask it to list the Flutter skills it can see; verify and write the answer in the docs section of task 4.1 (a plain statement that it was or was not seen, never a claim that was not tested)

## 2. Doctor

- [x] 2.1 Add the table of recommendations for `flutter` (per tool: detection and install commands, with the date they were checked) next to `SKILL_INSTALL` in `scripts/lib/doctor.mjs`, and gather the facts: the `dart-flutter` entries of `claude plugin list --json` at the user scope or the project scope of this repository (`null` when it cannot list), the folders starting with `flutter-` under `.agents/skills` and `.claude/skills`, and whether Antigravity is in use (`f.adapters` not empty or `agent.build` is `antigravity`); verify with unit tests on injected facts
- [x] 2.2 Report `recommended.flutter.claude` and `recommended.flutter.antigravity` as pass or note, never warn or fail, once per repository and only when a platform has stack `flutter`; verify with tests for every scenario of the requirement "Doctor notes the recommended Dart and Flutter skills" in `tests/doctor.test.mjs`
- [x] 2.3 Verify that a repository whose other checks pass and whose recommended skills are missing gets `exitCode` 0 and one note, and that the profile of `flutter` still has empty `requires_skills` and role lists (`tests/stack-profiles-shipped.test.mjs`)
- [x] 2.4 Add one sentence about the recommendation to `skills/doctor/SKILL.md` and verify `tests/skill-init-doctor.test.mjs` passes

## 3. Init

- [x] 3.1 In `scripts/lib/init.mjs`, plan the optional installs for a Flutter platform: the two `claude plugin` commands when the plugin is not found and `claude` can list, the `npx skills add flutter/agent-plugins` command when Antigravity is in use and no `flutter-` folder exists, and an `ok` line when found; mark them optional and verify with tests in `tests/init.test.mjs` for offered, already installed and not applicable
- [x] 3.2 Plan the manual items (Antigravity IDE screen, `.agents/mcp_config.json` entry for `dart mcp-server`, copying the official rules to the project's rules file) and verify that `planInit` writes no file for them
- [x] 3.3 Describe in `skills/init/SKILL.md` that these installs are optional, that declining says the recommendation stays open and not that `go` will not run, and verify `tests/skill-init-doctor.test.mjs` passes

## 4. Documentation

- [x] 4.1 Add the section on the recommended skills of Flutter to `docs/stacks.md` and `docs/stacks.es.md` with the table of routes, the cloud runner note, the rules and MCP notes, `--scope project` as an option, and the result of task 1.3; verify with `tests/docs-claims.test.mjs` and by reading that both pages carry the same commands
- [x] 4.2 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Added: the note and the optional installs; Known limits: the IDE route is not detectable, the plugin does not reach the cloud runner) and verify the file keeps the changelog format

## 5. Whole change

- [x] 5.1 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.

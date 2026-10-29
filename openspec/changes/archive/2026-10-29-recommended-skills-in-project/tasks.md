# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 Read the `SKILL.md` of the three candidate skills and of the other `flutter-*` and `dart-*` ones, fix the default set (names and sizes, no scripts, no imposed architecture or package, under 20 KB per role) and write it in the spec scenario "The set" of `platforms` if it differs; verify with a script that adds up the sizes from `flutter/agent-plugins`
- [x] 1.2 In a scratch folder outside the repository, run `npx skills add flutter/agent-plugins --skill <the set> --agent claude-code --copy --yes` from the root and from a subfolder, and write down where the skill folders and `skills-lock.json` land and whether they are real files; verify by listing the folders, and record the result in the "Risks" of `design.md`
- [ ] 1.3 In a real cloud run of `go` on a repository with a Flutter platform whose path is not `.`, with the skills under `<path>/.claude/skills`, check that `dev` and `qa` receive the paths of the set; and note whether a subagent discovers a nested skill by name without being given its path; record what was and was not seen in `design.md` and, if the answer matters, move the destination to the root before 3.x

## 2. Profile and `skills.disable`

- [x] 2.1 Add the default set under `skills.dev` and `skills.qa` of `stacks/flutter.md`, leaving `requires_skills`, `issue` and `review` empty; verify with `tests/stack-profiles-shipped.test.mjs` (set, empty lists, size under 20 KB per role, no scripts)
- [x] 2.2 In `scripts/lib/stack-profile.mjs`, parse `skills.disable` in the repository's profile only (an error in the plugin's), apply it after the merge to every role list, keep a required skill and report the entry as ignored, and report an entry that matches nothing; verify with the scenarios of "The profile can be extended by the repository but not weakened" in `tests/stack-profile.test.mjs`
- [x] 2.3 Make `scripts/stack-profile.mjs` print what was switched off and what was ignored, and verify with a test of its output

## 3. Resolution and protection by platform

- [x] 3.1 Pass the platform's path to `resolveRoleSkills` and `scripts/role-skills.mjs`, look in `<path>/.claude/skills`, `<path>/.agents/skills` and then the root, and mark in the output which skills the plugin's profile listed; verify with the scenarios of "Skills are looked up in the folder of the platform first" in `tests/role-skills.test.mjs`
- [x] 3.2 Make `scripts/lib/protected-paths.mjs` protect `.claude/skills/`, `.agents/` and `skills-lock.json` under the path of every declared platform, with `scripts/lib/commit-change.mjs` and `scripts/lib/platform-scope.mjs` passing the platforms, and nothing new for `path: .`; verify with the scenarios of "The skill folders of a platform are protected at any depth" in `tests/protected-paths.test.mjs` and `tests/agent-guard.test.mjs`
- [x] 3.3 Make `doctor` compare each skill folder with the `skills-lock.json` of the folder that holds it (platform folder or root); verify with the scenarios of "The lock file next to the skills is the one checked" in `tests/doctor.test.mjs`
- [x] 3.4 Make `doctor` report a skill of the plugin's profile that is left out as a note with its install command, a skill the repository listed as a warning as before, and a disabled skill as neither; verify with the scenarios of "A default skill that is not installed is a note" in `tests/doctor.test.mjs`

## 4. Doctor and init

- [x] 4.1 In `scripts/lib/doctor.mjs`, make `recommendedSkillFacts` count only committed folders (`.claude/skills` for Claude Code, `.agents/skills` for Antigravity, at the root or in a Flutter platform's folder), ignore the home folder and the user-scope plugin except to word the note, and report `recommended.flutter.claude` and `recommended.flutter.antigravity` as the scenarios of "Doctor notes the recommended Dart and Flutter skills" say; verify with a test for each scenario in `tests/doctor.test.mjs`
- [x] 4.2 Keep a recommended skill from blocking, and verify with `tests/doctor.test.mjs` that a repository whose other checks pass gets exit status 0 and one note, and that `go` still runs with the skills missing
- [x] 4.3 In `scripts/lib/init.mjs`, plan one optional install per Flutter platform folder (naming each missing skill, `--agent claude-code --copy --yes`, plus `--agent universal` for Antigravity), stop offering the plugin, and list committing the folder and `skills-lock.json` as a manual step; verify with the scenarios of "Init offers the recommended Dart and Flutter skills as optional installs" in `tests/init.test.mjs`, including two platforms and `path: .`
- [x] 4.4 Make each install run from the platform folder (the plan's command starts with `cd <path> &&`; the skill, not `applyPlan`, runs it after a yes to that command alone), and verify with tests that the command carries the folder, that `applyPlan` runs and writes nothing for an install, and that a declined install changes nothing else
- [x] 4.5 Update `skills/init/SKILL.md` and `skills/doctor/SKILL.md` with the new behaviour and verify `tests/skill-init-doctor.test.mjs` passes

## 5. Documentation

- [x] 5.1 In `docs/stacks.md` and `docs/stacks.es.md`, rewrite the section on the recommended Flutter skills (command and destination, the plugin as an optional extra for working locally, cloud runner, what `dev` and `qa` receive, `skills.disable`, rules and MCP) and add the difference between a required and a recommended skill with `supabase` as the example; verify with `tests/docs-claims.test.mjs` and by reading that both pages carry the same commands
- [x] 5.2 Remove the repeated bullet "The commands QA runs never rewrite your code" from both stacks pages and verify each page has it once (a check in `tests/docs-claims.test.mjs`)
- [x] 5.3 Add the entry under `## [Unreleased]` in `CHANGELOG.md`: Added (the default set, `skills.disable`, protection by platform), Changed (a plugin on a machine no longer counts as installed; `init` no longer offers the plugin), Known limits (the Antigravity IDE route is not detectable); verify the file keeps its format

## 6. Whole change

- [x] 6.1 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
- Laravel (Laravel Boost) and Vue go in a separate change.
- Task 1.3 was not done: on 2026-10-29 the change was archived without a real cloud run. The stacks page and the changelog say that a cloud run with these skills was not tried, and that whether a subagent discovers a skills folder nested in a platform by name is not known; `dev` and `qa` read the skills through the paths Relevo gives them.

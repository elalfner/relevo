# Tasks

## 1. Claude Code counts both folders

- [x] 1.1 In `scripts/lib/doctor.mjs`, make `recommendedSkillFacts` look for the skills of the set, for Claude Code, under `.claude/skills` and `.agents/skills` in the folder of the platform and at the root, keeping `.agents/skills` alone for Antigravity; verify with the scenarios "Only `.agents/skills` and Claude Code", "Skills split between the two folders", "Skills in the home folder" and "Skills committed to the repository" of "Doctor notes the recommended Dart and Flutter skills" in `tests/doctor.test.mjs`, rewriting the test that expected a note for the first one
- [x] 1.2 Verify in `tests/init.test.mjs`, from the same facts, that the plan lists the Claude Code line as done and offers no install when the skills are under `.agents/skills`, and still offers it when they are under neither folder
- [x] 1.3 Correct the text that says `.agents/skills` counts for Antigravity only: the line of `CHANGELOG.md` under `## [Unreleased]`, and any sentence of `docs/stacks.md`, `docs/stacks.es.md` and `skills/doctor/SKILL.md` that says so (find them with `grep -rn "agents/skills" docs skills CHANGELOG.md`); verify with `tests/docs-claims.test.mjs` and `tests/skill-init-doctor.test.mjs`

## 2. One note per cause

- [x] 2.1 In `scripts/lib/doctor.mjs`, skip the note `skills.default.<platform>.<skill>` for a stack that has an entry in `RECOMMENDED`, keeping it for a stack without one, and make sure the note of the stack names every missing skill; verify with the scenarios "Default skill missing", "One note for a monorepo" and "Stack with no note of its own" of "A default skill that is not installed is a note" in `tests/doctor.test.mjs`, including the exit status staying 0 and no warning
- [x] 2.2 Verify with the `doctor` of the branch, read-only, on the two repositories that showed the faults: the repository with the skills under `.agents/skills` reports a pass for Claude Code, and the monorepo reports one note for the stack; record what was seen in the pull request

## 3. Whole change

- [x] 3.1 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.

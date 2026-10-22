# Tasks

## 1. Local Antigravity run starts through the guard

- [x] 1.1 In `scripts/lib/go-local.mjs` (`planLocalRun`), build the Antigravity command as `node <repo>/scripts/agent-guard.mjs run --prompt "/relevo:go <issue>" --config relevo.yml --timeout-minutes 50 --summary <tmp file outside the worktree>`, without `--` or `agy -p`. Verify by running the command of the plan in a shell with `--agy` pointing at a stub: it must not exit 2.
- [x] 1.2 Update the Antigravity scenario in `tests/go-local.test.mjs` to the new arguments, and add a test that spawns the real `scripts/agent-guard.mjs` with the planned arguments plus a stub `--agy` and asserts exit 0. Verify with `node --test tests/go-local.test.mjs`, and check that the test fails against the old command.
- [x] 1.3 Make `runLocal` keep the worktree and print its path when the guard exits 2 (usage). Verify with a test using the fake runner and `streamStatus: 2`.

## 2. Review returns to base only where it can

- [x] 2.1 Reword step 9 of `skills/review/SKILL.md`: switch only in the main checkout and when no other worktree holds the base branch, otherwise say where the branch stays; a failed switch never changes the verdict. Verify with `node --test tests/skill-review.test.mjs`.
- [x] 2.2 Extend `tests/skill-review.test.mjs` to assert the condition and the no-failure sentence are in the skill, and that the Antigravity render still carries them.

## 3. Changelog and `.agents/`

- [x] 3.1 In `CHANGELOG.md` under Unreleased, record the local Antigravity run (`go-local` with `agent.build: antigravity`), the isolated interactive run (self builder, watchdog, kill), the review base-branch step and its condition, and remove the "starts `claude`" known limit. Verify by reading the section and running `node --test`.
- [x] 3.2 Stop versioning the generated OpenSpec files of Antigravity: `git rm --cached` of `.agents/skills/openspec-*`, `.agents/skills/.openspec-target` and `.agents/workflows`, and ignore those paths in a new `.gitignore` (the skills installed with `npx skills`, which `skills-lock.json` tracks, and `.agents/plugins/` stay tracked). Verify with `git status` (files deleted from the index, still on disk) and that `node --test` still passes.
- [x] 3.3 Run the full suite (`npm test`) and `openspec validate fix-antigravity-local-run`.

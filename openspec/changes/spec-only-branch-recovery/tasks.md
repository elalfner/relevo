# Tasks

## 1. The check of a branch without implementation

- [x] 1.1 In `tests/branch-work.test.mjs`, add a test with a branch that holds exactly `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md` and `specs/a/spec.md` of the change: the script exits 1 with the change given as `31-summary`, as `openspec/changes/31-summary` and as `openspec/changes/31-summary/`; add tests that `--change ""` and `--change openspec/changes/` exit 2 and that code beside the specification still exits 0 listing only that code; run them and see the path cases fail
- [x] 1.2 `scripts/branch-work.mjs`: normalise `--change` (strip a leading `openspec/changes/` and trailing slashes; exit 2 with the usage text when it is empty or still contains `/`); verify the tests of 1.1 and the existing ones pass
- [x] 1.3 `skills/fix/SKILL.md`: say that `--change` takes the folder name (`<issue>-<slug>`), and keep the test `tests/skill-fix.test.mjs` for the command text passing

## 2. The profile before the specification

- [x] 2.1 In `tests/skill-go.test.mjs`, test that the skill runs `stack-profile.mjs` before the commit `docs: specification for #<issue>` and that the failure `profile not resolved` is taken before it; run it and see it fail
- [x] 2.2 `skills/go/SKILL.md`: move the resolution of the profile (and `role-skills.mjs`) from step 4 to the end of step 2, say that nothing is committed or pushed when it fails and that step 4 uses the same output; verify the test of 2.1 passes

## 3. The failure comment of a specification-only branch

- [x] 3.1 In `tests/next-step.test.mjs` and `tests/messages.test.mjs`, add tests: `delete-branch` with a branch names `git push origin --delete <branch>` in English and Spanish; without a branch the text is the current one; a `build_failed` with `branch_state` `pushed` and `recovery` `delete-branch` has no `/relevo:fix`; kept work and implementation keep `fix`/`kept`; run them and see them fail
- [x] 3.2 `scripts/lib/next-step.mjs` and `scripts/lib/messages.mjs`: pass the branch to the `delete-branch` hint; verify the tests of 3.1 pass
- [x] 3.3 In `tests/skill-go.test.mjs`, test that the failure path runs `branch-state.mjs` after a push that created the branch and gives `recovery` `delete-branch` for `spec-only`; `skills/go/SKILL.md`: add that rule to steps 2 and 4 of the failure path; verify it passes

## 4. The refused retry

- [x] 4.1 In `tests/go-plan-output.test.mjs` (or a new test of the refusal), with a repository whose remote branch holds only files of the change, test that the refusal names `git push origin --delete <branch>` and the retry, and does not contain `/relevo:fix`; with a branch that holds code, or a branch that cannot be read, the current message stays and nothing is deleted; run them and see them fail
- [x] 4.2 `scripts/go-plan.mjs`: on the refusal, fetch the base and the branch and classify it with `classifyBranchChanges`; word the refusal after the result, falling back to the current message on any failure; update the `--retry` comment of the header; verify the tests of 4.1 pass

## 5. Check the whole

- [x] 5.1 Run `npm test` and `openspec validate --all`, and check that `qa.rules_from` and the workflows of the example repository are not in the diff

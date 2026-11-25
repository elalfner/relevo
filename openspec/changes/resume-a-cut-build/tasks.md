# Tasks

## 1. The branch check inside the planner

- [x] 1.1 In `tests/resume-check.test.mjs`, add tests for a REST adapter that answers the `git log` call of `resumeState` from the commits of a branch over the base (subject and body, newest first): the same fixtures give the same `state` and `reason` through the adapter and through a fake `git`, for a limit tip, a checkpoint tip, a rejection tip, a foreign commit, a changed hash and a branch that cannot be read; run them and see them fail
- [x] 1.2 `scripts/lib/resume-check.mjs` (or a sibling module): the adapter, with the branch and base names validated as `resumeState` already does; verify the tests of 1.1 pass and that an unreadable branch returns `existing` with the reason, never `resume`

## 2. The planner and the flag

- [x] 2.1 In `tests/plan.test.mjs`, `tests/go-plan-output.test.mjs` and `tests/plan-files.test.mjs`, add tests: `--resume` on a `build-failed` issue with a resumable branch is planned as `start` with the gates of a retry and claims `building`; on an issue that is not `build-failed` or has no branch it refuses with the messages of the spec; with an `existing` answer it refuses without a claim and names the reason and the step; with a branch that cannot be read it builds nothing; a files project resumes its local branch; run them and see them fail
- [x] 2.2 `scripts/lib/plan.mjs`, `scripts/go-plan.mjs`: the `--resume` mode next to `--retry` (needs `--only <n>`), the check before the claim for a local run and through the adapter for the `decide` job, and `planFiles` taking `resume`; verify the tests of 2.1 pass
- [x] 2.3 In `tests/plan.test.mjs`, add tests that the `go` label on a `build-failed` issue is planned as a resume when the branch is resumable (the gates of a retry, `go_by` as the person) and answers `go_use_fix` when it is not; `scripts/lib/plan.mjs` makes the `refusal` and `isGoRetry` logic use the answer of the check instead of `has_branch` alone; verify the tests pass and that a `has_branch` of `null` still builds nothing
- [x] 2.4 In `tests/go-local.test.mjs`, assert that `go-local.mjs <issue> --resume` passes `--resume --claim` to the planner and prints the message of a refusal; `scripts/go-local.mjs`: the flag and its usage line; verify the test passes

## 3. The refusals and the stall

- [x] 3.1 In `tests/retry-refusal.test.mjs`, add tests: a refused `--retry` on a resumable branch names `/relevo:go <n> --resume`; on code the check refuses it keeps `/relevo:fix <n>` with the line about the defect; a specification-only branch and an unreadable one do not change; the refusals of `--resume` per reason (changed text, QA rejection, foreign commit, specification only, unreadable) name the step that fits; run them and see them fail
- [x] 3.2 `scripts/lib/retry-refusal.mjs`: one place for these texts, with the delete command where the spec asks for it; verify the tests of 3.1 pass
- [x] 3.3 In `tests/limit-retry.test.mjs` (or a new `tests/stalled-resume.test.mjs`), add tests for the stalled marker: it is built from the three numbers only, read from the last `build_failed` comment of a bot only, ignored in a comment of anyone else, replaced by a newer comment, and lifts when one limit of the config is higher than the recorded one; a resume that finished one task writes no marker; run them and see them fail
- [x] 3.4 `scripts/lib/failure-comment.mjs` and a small reader next to `limit-retry.mjs`: build and read the marker, and let the planner refuse a `--resume` or `go` label while it stands, naming the limits to raise; verify the tests of 3.3 pass

## 4. The next step and the comments

- [x] 4.1 In `tests/next-step.test.mjs`, `tests/messages.test.mjs` and `tests/messages-language.test.mjs`, add the expectations: the reason `resume` for `run limit reached` with `branch_state: kept` (command `/relevo:go {n} --resume`, tasks done, the cloud label named, no mention of QA rejecting), `kept` unchanged for a QA rejection, `partial` unchanged, the variant `stalled` (no command, hint with the limits and the split), and both languages for each; run them and see them fail
- [x] 4.2 `scripts/lib/next-step.mjs` (the variant and its entry in `NEXT_STEP_REASONS`) and `scripts/lib/messages.mjs` (the choice of the variant, the progress line, the stalled text and its marker, English and Spanish); verify the tests of 4.1 pass and that every state and reason still has an entry

## 5. The skills

- [x] 5.1 In `tests/skill-go.test.mjs` (or the test that reads `skills/go/SKILL.md`), assert that the skill documents `--resume`, runs the planner with it, and records the tasks done at the start of a resumed run and compares them at the failure path; in `tests/skill-fix.test.mjs`, assert that `fix` tells the person about `--resume` for a limit commit or a checkpoint and not for a QA rejection; run them and see them fail
- [x] 5.2 `skills/go/SKILL.md`: the `--resume` argument (what it needs, what it refuses), the record of the tasks done at the start of a resumed run, and the `stalled` outcome at the failure path with the class `limit`; `skills/fix/SKILL.md`: the note and the question before it corrects; verify the tests of 5.1 pass
- [x] 5.3 `templates/workflows/relevo-go.yml`: pass the resume decision through the `decide` job only if it needs an input the template does not have, and otherwise only its header comment; verify `tests/workflow-go.test.mjs` (or the test of the template) passes and that no permission, job or label is added

## 6. The words and the documentation

- [x] 6.1 `GLOSSARY.md`: resume, retry and fix, each with the words to avoid and no implementation detail; verify `tests/plugin-structure.test.mjs` still passes and read the file against the format of the glossary
- [x] 6.2 `docs/commands.md`, `docs/execution.md`, `docs/guide.md` and their `.es.md` pages: `--resume`, the label that resumes, the three words apart, how to start over when a branch exists, and the stalled stop; verify the structure test that keeps both languages in step passes and that the commands in the pages run as written against `--dry-run`
- [x] 6.3 `CHANGELOG.md`: an entry under Unreleased that says what changed for a person who sees a build stop at a limit and that a repository gets the label behaviour by raising `RELEVO_VERSION`; known limits: a runner that stopped answering, and `--restart`

## 7. Check

- [x] 7.1 Run `npm test` and `openspec validate --all` (the steps of the CI) and see both pass
- [ ] 7.2 In the sandbox, from this branch as the memory describes (a pinned sha, `npm pack` of the folder), cut a build at a limit and resume it with `--resume`, then check that a QA rejection still points to `fix`; write what was seen in the change before archiving

## Workflow follow-up

- Archive the change after the CI passes, and run `npm test` and `openspec validate --all` again after the archive, since open changes can go stale.
- The version bump and the release are a later step: update `.claude-plugin/plugin.json` and the changelog entry on `dev` first, then tag on `main`.

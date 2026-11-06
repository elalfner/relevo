# Tasks

## 1. Groups and checkpoints

- [x] 1.1 Add `scripts/lib/task-groups.mjs` and `scripts/task-groups.mjs` (groups per section of `tasks.md`, one group for three pending tasks or fewer, a task outside a section in a group of its own); test with sample files; verify `node --test tests/task-groups.test.mjs` passes
- [x] 1.2 In `scripts/lib/wip-commit.mjs` add the checkpoint subject and `isOwnCommit`; make `isWipCommit` recognise a checkpoint; update `tests/wip-commit.test.mjs`; verify it passes
- [x] 1.3 In `scripts/lib/rescue-work.mjs` accept a `subject` and `trailers`, read `issue_hash` from the decision, and replace the "exists on the remote" refusal by the fast-forward rule; update `tests/rescue-work.test.mjs` for both; verify it passes
- [x] 1.4 Add `scripts/checkpoint.mjs` (calls the rescue core with the checkpoint subject and the `Issue-hash` trailer) and test it in temporary repositories: a first checkpoint, a second one on top, a group with no change and a refusal (the push that fails is covered by the tests of the rescue core they share); verify `node --test tests/checkpoint.test.mjs` passes

## 2. Resume

- [x] 2.1 Add `scripts/lib/resume-check.mjs` and `scripts/resume-check.mjs` (`absent`, `resume`, `existing` with the reason); test: all Relevo commits, a commit of a person, a different hash, a missing trailer, a QA rejection at the tip, no branch; verify `node --test tests/resume-check.test.mjs` passes
- [x] 2.2 Update `skills/go/SKILL.md`: step 2 resumes or stops, step 3 skips the writing on a resume, step 4 launches the developer per group and checkpoints, step 6 ends with the `feat:` commit (`--allow-empty` when nothing remains), the failure path and the limit commit carry the `Issue-hash`; update `skills/fix/SKILL.md`; verify `tests/skill-go.test.mjs` and `tests/skill-fix.test.mjs` pass

## 3. Docs and close

- [x] 3.1 Update `docs/execution.md`, `docs/guide.md` and their `.es.md` versions, and extend the 0.14.5 entry of the CHANGELOG with its known limits; verify the docs tests pass
- [x] 3.2 Run the full suite (`node --test tests/`) and `openspec validate checkpoints-and-resume --strict`; verify both are clean

## Workflow follow-up

- Commit on the working branch (check `git branch --show-current` first), push to update the pull request, and archive the change after the review.

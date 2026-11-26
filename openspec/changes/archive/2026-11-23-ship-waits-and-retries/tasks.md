# Tasks

## 1. The wait for running checks in the unattended ship

- [x] 1.1 In `tests/ship-unattended.test.mjs`, add tests with a fake clock: checks pending then passing keeps the label and merges; a check that fails while waiting stops and names it; pending checks plus a conflict or a missing approval stop at once without waiting; pending checks past the limit stop with the reason that says applying the label again retries; run them and see them fail
- [x] 1.2 `scripts/lib/ship-unattended.mjs`: one deadline computed at the start of the run; in `check()`, wait and decide again while the only reason is pending checks; the wait after the archive and the mergeability wait use the same deadline; verify the tests of 1.1 pass and the existing wait tests still pass
- [x] 1.3 Add a test that the waits of a run, added together, never pass the shared limit (a wait before the archive shortens the wait after it); verify it passes

## 2. The second attempt at the merge

- [x] 2.1 In `tests/ship-unattended.test.mjs`, add tests: a refusal that says the base branch was modified followed by a qualifying reading merges; the second reading shows a conflict and the run stops with that reason; two refusals stop with GitHub's message and the retry line; any other refusal (protection, permission) is not retried; run them and see them fail
- [x] 2.2 `scripts/lib/ship-unattended.mjs`: on the refusal that names the moved base, call `check(baseline)` again, apply the label rules and try the merge once more; verify the tests of 2.1 pass

## 3. The messages

- [x] 3.1 In `tests/messages.test.mjs` and `tests/messages-language.test.mjs`, add the expectations: the stop for checks that did not finish within the limit and the stop for a merge refused twice say that applying the label again retries; a conflict, an approval on older code and a failed archive do not say it; run them and see them fail
- [x] 3.2 `scripts/lib/ship.mjs` and `scripts/lib/messages.mjs`: the reasons and the line about applying the label again, in English and Spanish; verify the tests of 3.1 pass

## 4. The local ship

- [x] 4.1 In `tests/skill-ship.test.mjs`, assert that step 1 waits for the checks with a limit when they are the only reason and that step 5 tries the merge a second time when the base branch moved; run it and see it fail
- [x] 4.2 `skills/ship/SKILL.md`: the wait with `gh pr checks ... --watch --fail-fast` and the second merge attempt, keeping the written confirmation as it is; verify the skill test passes

## 5. The template and the documentation

- [x] 5.1 `templates/workflows/relevo-ship.yml`: the header comment says that the run may wait for the checks of the approved head before archiving, within the same limit; the time limit of the job does not change; verify `tests/workflow-ship.test.mjs` passes
- [x] 5.2 `docs/execution.md`, `docs/commands.md`, `docs/guide.md` and their `.es.md` pages: what the label does when checks are still running or the base moved, and which stops say that applying the label again helps; verify `tests/docs-claims.test.mjs` passes

## 6. Check

- [x] 6.1 Run `npm test` and `openspec validate --all` and verify both pass

# Tasks

## 1. The check

- [x] 1.1 Add fixtures of deltas and main specifications under `tests/fixtures/delta-check/` (an ADDED header that exists with other text, one with the same text, one that differs only in case or spacing, a MODIFIED header that is gone, a MODIFIED block that drops a scenario, a REMOVED name that is absent, a REMOVED variant, a rename with the old name missing, a rename with the new name present, a rename whose old name exists, a capability with no main specification, a header removed and added again by two operations) and `tests/delta-check.test.mjs` asserting the verdict and the clashes of each; run it and see it fail
- [x] 1.2 `scripts/lib/delta-check.mjs` and `scripts/delta-check.mjs`: read the delta of the change folder and the main specification (from the working tree or from a git ref), apply the archive's rules in its order, print one line per clash or JSON with `--json`, exit 1 on a clash, write nothing; verify the tests of 1.1 pass
- [x] 1.3 Add a test that runs the real `openspec archive` over a copy of each fixture and checks that its verdict (archived or aborted) equals the script's; verify it passes, or correct the script where it differs
- [x] 1.4 Add a test that the script leaves every file of the repository as it found it

## 2. The review

- [x] 2.1 In `tests/skill-review.test.mjs`, assert that the review runs the script after the synchronisation and before the person tests, that a clash leaves the issue `built` and names `/relevo:fix`, and that no clash says nothing; run it and see it fail
- [x] 2.2 `skills/review/SKILL.md`: step 1 runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/delta-check.mjs --change <folder> --base origin/<base>` after the merge of the base and before QA re-runs, and the stop with its message; verify the skill test passes

## 3. The ship

- [x] 3.1 In `tests/ship-unattended.test.mjs`, add tests: a clash stops before `archive()`, removes the label, pushes nothing and comments the header and that applying the label again does not help; no clash archives as before; an already archived change skips the check; run them and see them fail
- [x] 3.2 `scripts/lib/ship-unattended.mjs` and `scripts/lib/messages.mjs`: run the script before the archive, the new stop kind in English and Spanish; verify the tests of 3.1 pass
- [x] 3.3 In `tests/skill-ship.test.mjs`, assert that the local ship runs the check in step 1, before the confirmation, and stops with the clash; then `skills/ship/SKILL.md` step 1; verify the test passes
- [x] 3.4 `templates/workflows/relevo-ship.yml`: add `scripts/delta-check.mjs` to the scripts the job requires from the package; update `tests/workflow-ship.test.mjs`; verify it passes

## 4. The documentation

- [x] 4.1 `docs/commands.md`, `docs/execution.md` and their `.es.md` pages: the review and the ship check the specification against the base, and what a clash says; verify `tests/docs-claims.test.mjs` passes

## 5. Check

- [x] 5.1 Run `npm test` and `openspec validate --all` and verify both pass

# Tasks

## 1. The marker in the usage comment

- [x] 1.1 Add `usageMarker(usage, { subscription })` to `scripts/lib/run-usage.mjs`, leaving out the figures the log does not report, and verify `tests/usage.test.mjs` covers "Log with usage" and "Log with partial usage" (turns without cost) and that the marker and the sentence carry the same figures
- [x] 1.2 Make `scripts/run-usage.mjs` print the sentence, a blank line and the marker, and nothing when there is no usage, and verify a test runs the script on a log with usage, on a log without it ("Log without usage") and with `--subscription` (`notional` true)
- [x] 1.3 Verify the build job posts the output as it is: a test in `tests/workflow-go.test.mjs` finds the `gh issue comment "$ISSUE" --body "$line"` step unchanged, and `node --test` passes without any change to `templates/workflows/relevo-go.yml`

## 2. Reading and adding up the markers

- [x] 2.1 Add `parseUsageMarker(comment)` to `scripts/lib/run-usage.mjs`: it accepts only a comment of type `Bot` with one marker whose JSON is an object of finite numbers, and verify tests reject a person's comment with a marker, a malformed marker, two markers and a marker with a string for a number
- [x] 2.2 Add `sumUsage(runs)` with the number of runs and the sums of turns, cost and tokens over the runs that report each, and the count of runs whose cost is notional, and verify tests with all notional, some notional and none
- [x] 2.3 Add `gatherUsage({ gh, repo, now })` to `scripts/lib/status-data.mjs`: one paged read of `issues/comments?since=` for seven days, the creation date checked against the window, and an empty result on a failed read; verify tests with a fake client cover "Digest with usage", "Runs without a marker" and a read that throws

## 3. The digest line

- [x] 3.1 Pass `usage` through `gatherStatus` and `buildStatus`, and add the usage line to `renderDigest` in English and Spanish, after the alerts and never before the early return for nothing waiting; verify `tests/status.test.mjs` covers "Digest with usage", "No usage to report" (the digest is the same as before) and "Nothing waiting but usage exists" (nothing is posted)
- [x] 3.2 Make `scripts/digest.mjs` accept `usage` in the `--input` state file and read it live otherwise, and verify the existing digest CLI test passes and a new one shows the line from a state file; update the title and the assertion of "Daily digest - only who waits on what and the alerts" in `tests/status.test.mjs`, which the new requirement replaces
- [x] 3.3 Verify the notional wording: a digest whose counted costs are all notional says so, and one with some says how many of the runs, in both languages

## 4. Documentation and release notes

- [x] 4.1 Document the usage line in `docs/execution.md` and `docs/execution.es.md` ("What a cloud run reports") and in `docs/commands.md` and `docs/commands.es.md` (the daily digest): the seven days, that runs without a marker are not counted, and that the project must raise `RELEVO_VERSION`; verify `tests/docs-claims.test.mjs` passes
- [x] 4.2 Add the entry under `[Unreleased]` in `CHANGELOG.md` (Added: the marker and the line; Upgrading: raise `RELEVO_VERSION` in `relevo-go.yml` and `relevo-digest.yml`; Known limits: runs before the marker are not counted) and verify `tests/changelog.test.mjs` passes
- [x] 4.3 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged and the CI passes.
- Run `npm test` and `openspec validate --all` after archiving, because open changes can go stale.

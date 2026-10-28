# Tasks

## 1. The stages of an issue

- [ ] 1.1 Add `scripts/lib/stages.mjs` with `stagesOfIssue(events, names)`: it pairs the `labeled` events in order of `id` as the table of the design says, ignores `unlabeled` and the overlay labels, and ends an attempt without a sample on any other event; verify `tests/stages.test.mjs` covers "A build rejected by QA", "Built again after a failure", "Time stopped on a side exit", a gate that goes `ready` then `queued` then `building`, `labeled` arriving before `unlabeled` as in #34, a close as `not_planned` or without a reason, `reopened`, and the whole path to a close as `completed`
- [ ] 1.2 Add `summarizeStages(samples)` and `formatDuration(ms)` to the same file: the median in the fixed order with the count, the mean of the two middle values for an even count, and the stages without a sample left out; verify tests cover "Digest with stage times" (4, 6 and 9 minutes give 6 with the count 3), "A stage with no sample", no samples at all, and the thresholds of seconds, minutes, hours and days with their rounding

## 2. The line of the digest

- [ ] 2.1 Pass `stages` through `buildStatus` and add the line to `renderDigest` in English and Spanish, after the line of usage and after the early return for nothing waiting; verify `tests/status.test.mjs` covers "Digest with stage times", "No stage finished" (the digest is the same as before, with and without usage), "Nothing waiting but stage times exist" (nothing is posted) and the order of the two lines

## 3. Reading the events

- [ ] 3.1 Add `gatherStages({ gh, repo, config, now })` to `scripts/lib/status-data.mjs`: the stream newest first with the stop rule and the cap of 30 pages, the candidates (issues that are not pull requests with a state label or a close in the window), the read of each candidate and the cap of 100, and the filter of the samples that ended inside the window; verify tests with a fake client cover "A stage that began before the week", "A stage that finished before the week", pull requests left out, the stop at the first page that ends before the window, the two caps, and the number of calls
- [ ] 3.2 Make a read that fails give no samples and one line on stderr, and verify the test "The events cannot be read" (the digest is posted without the line and with the rest unchanged) and that nothing in `status.mjs` or `status-data.mjs` uses a word of a write, so the read-only test of the status still passes ("Reading the times")
- [ ] 3.3 Add the option `withStages` to `gatherStatus` and make `scripts/digest.mjs` pass it and accept `stages` in the `--input` state file; verify that `gatherStatus` without the option makes no call to the events, and a test runs the script from a state file and shows the line, and shows no digest for stage times alone

## 4. Documentation and release notes

- [ ] 4.1 Document the line in `docs/commands.md` and `docs/commands.es.md` (the daily digest, next to the usage) and in `docs/execution.md` and `docs/execution.es.md`: the five stages, that only the normal path counts, the median with its count, the seven days, and that the project raises `RELEVO_VERSION` to get it; verify `tests/docs-claims.test.mjs` passes
- [ ] 4.2 Add the entry under `[Unreleased]` in `CHANGELOG.md` (Added: the line; Known limits: a stage with no sample is not shown, and the events are read as GitHub gives them; Upgrading: raise `RELEVO_VERSION` in `relevo-digest.yml`) and verify `tests/changelog.test.mjs` passes
- [ ] 4.3 Run `npm test` and `openspec validate --all` and verify both pass

## 5. Real data

- [ ] 5.1 Run `node scripts/digest.mjs --repo <the sandbox repository> --config <its relevo.yml> --dry-run` and verify by hand against the events of one issue that the stages of the line are the ones it shows (for example the gate and the build of a build seen in the pilot); record the line and the check in `docs/pilot-findings.md`

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged and the CI passes.
- Run `npm test` and `openspec validate --all` after archiving, because open changes can go stale.

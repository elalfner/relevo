# Tasks

## 1. Read the quota and the reset time from the log

- [x] 1.1 In `scripts/lib/run-usage.mjs` add `quotaOf(text)` (windows with first and last utilisation, reset time) and `limitReset(text)` (credible future time or `null`); make `readUsage` return `usage.quota`. Verify in `tests/usage.test.mjs`: two windows, a malformed figure, no events, a plain-text log, reset as seconds, milliseconds and ISO, a reset in the past or beyond 8 days gives `null`, API-key log gives no quota.
- [x] 1.2 Add the quota phrases to `USAGE_TEXT` in English and Spanish, add the quota sentence to `usageLine` and `quota` to `usageMarker`; `parseUsageMarker` ignores it. Verify in `tests/usage.test.mjs` (sentence, marker, absence) and `tests/messages-language.test.mjs` (both languages, same placeholders).
- [x] 1.3 Make `scripts/usage-limit.mjs` print the reset time (ISO) on its standard output when it has one, keeping the exit code. Verify with a test that runs the script on a log with and without a reset.

## 2. The retry decision

- [x] 2.1 Add `scripts/lib/limit-retry.mjs` (marker format and parsing that counts only bot comments, the 24-hour episode, back-off table, bound of 3, the decision `retry`/`stop` including the work-kept rule) and `scripts/limit-retry.mjs` (reads the log, the comments by `gh` or `--comments <file>`, the rescue state; prints one JSON line; never fails the step). Verify in `tests/limit-retry.test.mjs`: known reset, unknown reset with 30 min, 2 h and 5 h, the fourth hit stops, an old marker restarts the count, a marker by a person is ignored, rescue `unsafe`, `not_pushed` and `existing` stop, `kept` and `nothing` retry, a bad marker is ignored.
- [x] 2.2 Add the messages `usage_limit_retry` (new kind) and the situation `usage_limit_stopped` of `run_no_outcome` to `scripts/lib/messages.mjs` in English and Spanish, with the hidden marker, the UTC time, the "unknown, back-off" wording and the kept branch. Verify in `tests/messages.test.mjs` and `tests/messages-language.test.mjs` (kind in both languages, placeholders, English fallback).

## 3. The queue holds, retries one at a time and staggers

- [x] 3.1 In `scripts/lib/github.mjs` read the retry marker of `queued` and `building` issues (`limit_retry`), and in `scripts/lib/plan.mjs` hold a queued issue before its time (`skip`, no slot, no comment), take `now` as a parameter, and start at most one retrying issue per evaluation and none while another retrying issue is `building`. Verify in `tests/limit-hold.test.mjs`: before and after the time, a person's `ready` overrides, three due issues start one, a building retry blocks the others, urgent does not skip the hold, no marker changes nothing.
- [x] 3.2 In `scripts/lib/requeue.mjs` and `scripts/requeue.mjs` print `stagger_seconds`. Verify in `tests/limit-hold.test.mjs` (none for 0 or 1 start, 60 for a few, reduced so the dispatch is at most 5 minutes) and `tests/requeue.test.mjs` (the script prints it).

## 4. The workflows

- [x] 4.1 In `templates/workflows/relevo-go.yml` change the step "Report a run that ended without an outcome": on a usage limit run `limit-retry.mjs`, return the issue to `queued` and render `usage_limit_retry`, or stop as before with `usage_limit_stopped`; list the new script in the install check. In `templates/workflows/relevo-queue.yml` sleep `stagger_seconds` between dispatches. Verify in `tests/workflow-go.test.mjs` and `tests/workflow-comments.test.mjs`: the step never adds `qa-failed` on a retry, the script is installed, the queue loop sleeps, and `tests/workflow-pins.test.mjs` still passes.
- [x] 4.2 Run the repository's check for workflows (`openspec validate --all`, `npm test`) and confirm that no pinned action changed (no new action is added).

## 5. Documentation and changelog

- [x] 5.1 Update `docs/execution.md`, `docs/guide.md` and their Spanish versions (the retry, the bound, the quota line, the stagger, what to test) and add one entry under Unreleased in `CHANGELOG.md` without a version bump. Verify with `tests/docs-claims.test.mjs`, `tests/changelog.test.mjs` and `npm test`.

## 6. Integration

- [x] 6.1 Run `npm test` and `openspec validate usage-limit-retry --strict`; replay a recorded log with a rate-limit event through `usage-limit.mjs`, `limit-retry.mjs` and `render-message.mjs` in both languages and check the output by reading it.
- [x] 6.2 Open the draft pull request against `dev` listing what was not verified and what to test by hand (a real limit log, the field of the reset time, the retry in a sandbox).

## Workflow follow-up

- The maintainer tests first. Do not archive or merge until they say so.

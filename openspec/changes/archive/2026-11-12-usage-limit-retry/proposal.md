# Proposal

## Why

In a pilot, three builds that had queued behind `concurrent_agents` started together when a slot freed and all ended at minute 0 with "the usage limit of the model account was reached". The comment told a person to remove `relevo:qa-failed` and apply `relevo:ready` "later"; nobody said when, and nothing retried. The execution log already carries the quota (the weekly window was at 75 % at the start of one build, and a large build moved it about two points), but no comment shows it. Issue #118, part of #115 (C1: a retry loop is bounded and does not burn the quota it waits for; C2: no security guard is weakened; C3: no work is discarded).

## What Changes

- A run stopped by the account quota no longer ends in `qa-failed`. The issue goes back to `queued` with a hidden, machine-readable retry time, and one comment says when it will retry (or, when the log does not say when the window resets, that it retries after a back-off and that the time is a guess).
- The reset time is read only from the rate-limit event of the execution log. When the log has none, or it is not credible, nothing is invented: the retry uses a back-off of 30 minutes, then 2 hours, then 5 hours, and the comment says so.
- The planner (used by the queue and by the `decide` job of `go`) holds a queued issue until its retry time, and starts at most one issue that is retrying after a limit at a time, so the first retry shows whether the quota is back before the rest start.
- The retry is bounded: after 3 retries that again end at a usage limit the issue goes to `qa-failed` and the comment asks a person. A run whose work could not be kept does not retry, because a rerun would discard it.
- When a slot frees and several queued issues start, the queue dispatches them 60 seconds apart instead of all at once.
- The usage comment adds a quota line (window, utilisation at the start and at the end of the run, and the reset time when the log has it) and the hidden marker carries the same under `quota`. With no such data (an API-key repository has no weekly window) nothing is added.
- Every new text goes through the message catalog in English and Spanish, with the language test.

## Capabilities

### New Capabilities
- `usage-limit-retry`: what happens to an issue whose run ended at a usage limit: the return to the queue with a retry time, the hold, the bound, the one-at-a-time retry and the stagger.

### Modified Capabilities
- `execution-modes`: the report of a usage limit now says when the issue will retry instead of telling a person to relabel it; the usage comment shows the quota window and its utilisation when the log has them.

## Impact

`scripts/lib/run-usage.mjs` (read the quota and the reset time), `scripts/run-usage.mjs`, `scripts/usage-limit.mjs` (prints the reset time), new `scripts/limit-retry.mjs` and `scripts/lib/limit-retry.mjs`, `scripts/lib/plan.mjs` (hold, one retry at a time), `scripts/lib/github.mjs` (reads the retry marker of queued and building issues), `scripts/lib/requeue.mjs` and `scripts/requeue.mjs` (stagger), `scripts/lib/messages.mjs` (new kinds and phrases), `templates/workflows/relevo-go.yml` (the "ended without an outcome" step) and `relevo-queue.yml` (the stagger in the dispatch loop; kept small because #128 and #129 also edit them), docs (`docs/execution.md`, `docs/guide.md` and their Spanish versions), tests, `CHANGELOG.md` (unreleased). The version is not changed. Out of scope: plans and billing, the defaults of `concurrent_agents`, a quota line for an API-key repository.

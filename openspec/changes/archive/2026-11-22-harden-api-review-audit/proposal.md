# Proposal

## Why

The review of issue 89 (declared `api` adapter, stack `nhost`, log `compose:`) ran into five gaps in the tool. The audit of the log ended in `REVIEW INCONCLUSIVE` because `docker compose logs` overflowed the default 1 MiB buffer of `spawnSync` (`ENOBUFS`), a verdict that cannot be waived, so the review had no way out. The preflight of a declared adapter does not look at the checkout, so two runs of about eight minutes failed on a missing `.env` and missing `node_modules`. A `review-state.json` of another issue survived into a new review unnoticed. The Compose instance in use belonged to another worktree and branch, and nothing said so. And after `reset-log`, an empty window is `REVIEW PASSED` on the strength of runs recorded before the window moved.

## What Changes

- **The compose log is read per service**, with a buffer large enough for a service's log, so one heavy service no longer hides the others. A service that still cannot be read is named in the report with the reason, and when the reason is the buffer, the report says that `reset-log` shortens the window and what it costs (the runs recorded so far stop proving the new window, so the suite runs again).
- **The preflight of a declared adapter checks the checkout** without reading any file: when `npm` is in `needs` and `package.json` exists, `node_modules` must exist; when `.env.example` (or `.env.sample`) exists, `.env` must exist. A missing one is not a stop: it is named and the person decides before any test runs.
- **The review state records the change it belongs to.** `init` refuses to overwrite the state of another change, and a new `owner` command, run before resuming, says whether the state on disk is for this change and this kind of review.
- **The preflight and `init` say where the Compose project runs**: they read the working directory that Compose recorded for the running project and warn when it is not the checkout under review. It never stops the review and never changes the instance.
- **`reset-log` closes the runs recorded so far for the purpose of a quiet pass**: the audit of an `api` review whose window was reset is `REVIEW INCONCLUSIVE` until a run is recorded after the reset. Runs from before still count when they failed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the audit of the `api` log (per-service read, named unreadable source), the recorded run that proves a quiet log (only a run since the window started), the preflight of a declared adapter (checkout, Compose directory), and the state that belongs to one change.

## Impact

- Code: `scripts/lib/api-log.mjs`, `scripts/lib/api-preflight.mjs`, `scripts/api-preflight.mjs`, `scripts/lib/review-state.mjs`, `scripts/lib/logaudit.mjs`, `scripts/review-state.mjs`; their tests.
- Documentation: `skills/review/SKILL.md` (resume step, preflight step), `docs/stacks.md` and `docs/stacks.es.md`.
- Out of scope: the `FATAL` that a test harness provokes (its own change, `declare-expected-fatals`), the duration of the project's suite, what `test:core` prints, and any file of the project under review.
- Breaks: an `api` review whose log was reset and that has no run since now ends `REVIEW INCONCLUSIVE` where it ended `REVIEW PASSED`; the person records a run after the reset.

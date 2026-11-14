# Design

## Context

See proposal.md for the motivation. What exists today:

- `reachedUsageLimit(text)` (`scripts/lib/run-usage.mjs`) tells a usage limit from another failure: a final error result whose text matches a pattern, or a `rate_limit_event` whose `rate_limit_info.status` does not start with `allowed`. `usage-limit.mjs` wraps it.
- The step "Report a run that ended without an outcome" of `relevo-go.yml` always sets `qa-failed`; for a limit it renders the `run_no_outcome` message with the situation `usage_limit` (or `kept`).
- The step before it, "Keep the work of a run that was cut", commits and pushes the work as `wip: stopped by limit (#N)` with the hash of the issue text. `resume-check.mjs` accepts a branch whose tip is that commit, so a later `go` run resumes from it.
- The queue (`requeue.mjs`) and the `decide` job use `gather` and `planGo`. A `queued` issue is a candidate every evaluation and starts when a slot is free. The queue job dispatches `relevo-go.yml` for every startable issue in a loop. A `requeue` job starts the queue after every build.
- Evidence about the log: `rate_limit_event` entries are written through a healthy run; the repository's tests and `docs/pilot-findings.md` show `rate_limit_info.status`, `rateLimitType` (`five_hour`) and `utilization` (a fraction, 0.01 to 0.02 in a healthy run). The issue reports a weekly window at 75 % and overage disabled. A one-turn run with a subscription token in the sandbox (the log of a healthy run, status `allowed_warning`) confirmed the shape: `rate_limit_info` has `status`, `rateLimitType`, `utilization` (a fraction), `resetsAt` (seconds since the epoch), `overageStatus`, `overageDisabledReason`, `isUsingOverage`, and `unifiedWindows`, with every window of the account (`five_hour`, `seven_day`) and its own `utilization`, `resetsAt` and `status`. **No log of a real usage-limit stop (a `rejected` event) is in this repository**: that the top-level `resetsAt` or a rejected entry of `unifiedWindows` carries the reset of the blocked window is not confirmed.

## Goals / Non-Goals

**Goals:**
- A limit hit returns the issue to the queue by itself, bounded, without discarding work and without a guard weakened.
- The retry time is real or marked as a guess; never invented.
- The quota is visible before and after a run when the log has it.

**Non-Goals:**
- Reading the reset time from free text ("resets 3pm"), which depends on the locale and wording of a CLI message.
- A quota line from anything but the execution log, or a figure for an API-key repository.
- Changing `concurrent_agents`, adding a setting to `relevo.yml`, or touching `skills/go/SKILL.md` and the agents (the work in progress of another change).

## Decisions

### D1. The log is read by a tolerant function that never invents
`quotaOf(text)` returns the windows (name, utilisation as a percent, reset time) from `rate_limit_event` entries: the windows of `unifiedWindows` and, for the one it lacks, the top-level `rateLimitType`; the first event that reports a window gives "before", the last gives "after". A field that is missing, not a number or out of range is left out. A window with no utilisation is not shown. `limitReset(text)` returns, for the last event whose status is not `allowed*`, the latest reset time among the windows that are not allowed (the top-level window and each rejected entry of `unifiedWindows`: the account runs again when the last one resets), accepted as seconds or milliseconds since the epoch or as an ISO string, and only when it is in the future and no more than 8 days away; otherwise `null`. Why: the format is undocumented, and a wrong "retry at" is worse than a back-off that says it is a guess. Alternative: parse the text of the error message; rejected (locale, wording, and nothing in the repository shows it).

### D2. The retry time is a hidden marker in the comment, written by the final step and read by the planner
The comment carries `<!-- relevo:retry {"at":"<ISO>","attempt":n,"reason":"reset"|"backoff"} -->`. Only a comment of a bot counts (as for the usage marker), the last valid one wins, and a marker older than 24 hours counts as attempt 0 so that a limit hit weeks later does not inherit an old count. Why: it needs no new label (the label set is a documented contract), survives in the issue, and is visible to the person. Alternative: a new `relevo:waiting-limit` label; rejected because every workflow, the planner and the docs list the labels. Alternative: a file or a variable; rejected, the repository has no state store.

### D3. The state while waiting is `queued`
The final step removes `ready`/`building`/`queued` and adds `relevo:queued` (not `qa-failed`), so existing consumers (`status`, the capacity count, the queue) already know the state. The planner, for a `queued` issue whose marker time is in the future, returns `skip` with the reason and no comment, before any gate that counts slots. A person who labels the issue `ready` again overrides the wait (the hold applies to `queued` only), and the attempt count still counts for the bound.

### D4. Backoff 30 min, 2 h, 5 h; bound 3 retries
Used when the reset time is unknown or not credible. The last value is the length of the shortest window the log names (`five_hour`). After the third retry that again ends at a limit, the issue goes to `qa-failed` and the comment asks a person, so the loop is bounded (C1). The bound counts every retry, also those with a known reset time, so a wrong reset time cannot loop either. A retry that starts at a known reset adds one minute.

### D5. One retry at a time
Among the queued issues that are due and carry a retry marker, the planner starts at most one in an evaluation, and none while a `building` issue carries one (the retry of that issue is the probe). The gather step reads the marker of `queued` and `building` issues only (at most `concurrent_agents` plus the queue). The others stay queued with no comment; the `requeue` job starts the queue when the probe ends, so the next one follows without waiting for the schedule. Why: when the window resets, N held issues would otherwise all start at once, and the pilot failure repeats if the reset time was wrong (C1).

### D6. The stagger is in the queue's dispatch loop
`requeue.mjs` prints `stagger_seconds` (60, reduced so that the whole dispatch takes at most 5 minutes) and the workflow sleeps between `gh workflow run` calls. It is a delay of the dispatch, not a setting. Alternative: a `start_after` in the planner; rejected, the planner is pure and has no clock between dispatches. The queue job's timeout (10 minutes) already bounds it.

### D7. A retry never discards work (C3)
The step reads the state of the rescue step. When the comments of the issue cannot be read, the bound cannot be checked, so the issue also goes to `qa-failed` (the loop fails closed). The issue returns to the queue only when the rescue state is `kept` or `nothing` (the work is on the branch and the next run resumes from it, or there was none). For `unsafe`, `not_pushed`, `existing` and an empty state (the rescue step did not report, so it is not known that the work is safe) the issue goes to `qa-failed` with the existing usage-limit message, which already names what was not kept. No guard changes: the rescue still goes through `commit-change`, and the retry runs the same `go` with the same checks.

### D8. The decision is made by one script, the words by the catalog
`limit-retry.mjs` reads the execution log, the comments of the issue (through `gh` or a file) and the rescue state, and prints one JSON line `{action:"retry"|"stop", at, reason, attempt, max, window}`. The workflow step sets the labels and posts `render-message.mjs usage_limit_retry` or the new situation `usage_limit_stopped` of `run_no_outcome`. Time and quota windows are formatted by the catalog functions (UTC, `YYYY-MM-DD HH:MM UTC`) in both languages.

### D9. Quota in the comment
`usage.quota` = `[{window, before, after, resets?}]` (percent, integers). The sentence: "Quota: the 5-hour window went from 2 % to 3 %; the weekly window went from 75 % to 77 %." with the reset time when known. Window names are catalog phrases for `five_hour`, `seven_day` and a generic one for the rest (the type is quoted). The marker carries `quota`; `parseUsageMarker` and the digest ignore it, as for `agents`. No windows → no phrase, no key.

## Risks / Trade-offs

- [The reset of a `rejected` event is not where the code looks] → the field and unit are confirmed on an `allowed_warning` event; a reset is used only when it is a credible future time, otherwise the back-off runs and the comment says it is a guess. A real `rejected` event is not verified: listed in the PR.
- [Overage] → the log has `overageStatus`, `overageDisabledReason` and `isUsingOverage`, but the quota phrase does not mention overage; the maintainer decides whether it should (the issue mentions it as context, not as a scenario).
- [A retry at the reset hits the limit again] → one at a time, 3 at most, back-off.
- [The 30-minute queue schedule delays a retry past its time] → the comment says "after", and the build of the probe or any queue event starts it sooner.
- [An old marker is read as a new episode] → the 24-hour window.
- [A person edits the marker] → only a bot's comment counts.
- [relevo-go.yml and relevo-queue.yml are edited by #128 and #129 later] → the edits here are one step body and one loop.

## Migration Plan

Installed workflows carry the old step until the maintainer upgrades them (`doctor` reports a template that is older). The new scripts live in the package at the pinned `RELEVO_VERSION`, so the workflow step must list `limit-retry.mjs` in its install check; an older workflow keeps working (it ends in `qa-failed` as before). No label or setting is added.

# Design

## Context

See proposal.md - Why. What shapes the approach, read from the repository and from real events of the sandbox:

- The digest is built in `digest.mjs` from `gatherStatus` (reads GitHub through one injected client) and `buildStatus` / `renderDigest` (pure). The usage line added the same way: an option of `gatherStatus` (`withUsage`), a list passed to `buildStatus`, a line in `renderDigest`, and the `--input` state file for the tests.
- GitHub keeps one event per label change of every issue, closed ones included. `GET repos/{repo}/issues/events` lists them for the whole repository, **newest first**, with a numeric `id` that grows; `GET repos/{repo}/issues/{n}/events` lists those of one issue. Both carry pull request events too (`issue.pull_request` is set).
- A change of lifecycle state is two events: `labeled` for the new label and `unlabeled` for the old one. They are **not** in a fixed order and may be a second apart: in sandbox issue #34, `labeled relevo:building` (16:45:51) came before `unlabeled relevo:ready` (16:45:52), and `labeled relevo:built` (16:48:55) after `unlabeled relevo:building` (16:48:54).
- A `closed` event carries `state_reason` (`completed` or `not_planned`).
- A tool that reads the stream has to stay read-only: a test scans `status.mjs` and `status-data.mjs` for the words of a write.
- Nothing may leave the repository, and the usage line already shows that a failed read is logged and the digest still posted.

## Goals / Non-Goals

**Goals:**
- Times that agree with what a person sees on the issue, whatever the order of the events inside a second.
- A read that costs a handful of calls per digest and does not grow with the age of the repository.

**Non-Goals:**
- Showing the age of the stage an issue is in now; the alerts report a build that stopped reporting.
- Any option for the window or the statistic, and any storage of the result.
- Telling a solo review that skips a stage from one that was forgotten: a stage with no sample is simply not in the line.

## Decisions

### D1. Two reads: the stream finds the issues, each issue gives its stages

1. Read `issues/events?per_page=100&page=N` from the newest page and stop at the first page whose oldest event is older than the window, with a cap of 30 pages. From those events keep the issues (not pull requests) that have, inside the window, a `labeled` event of `building`, `built`, `in-review` or `pr-open`, or a `closed` event: only those can end a stage.
2. For each of those issues read `issues/{n}/events` (all pages) and compute its stages. Keep the ones that ended inside the window, whenever they began. At most 100 issues are read, the most recently active first; past that the rest are logged and left out.

*Alternative: read the stream far back, 30 or 60 days.* Rejected: a review that lasts longer would lose its start, and the cost grows with the repository. *Alternative: `issues?since=` for the candidates.* Rejected: it says which issues changed, not what changed, so the stream is needed anyway.

### D2. Stages are paired from `labeled` events only, in order of `id`

The current lifecycle label of an issue is the last `labeled` event of a state or exit label (`ready`, `queued`, `building`, `built`, `in-review`, `pr-open`, `needs-spec`, `blocked`, `qa-failed`, `changes-requested`); the overlays (`needs-reviewer`, `ship`, `urgent`) are ignored. `unlabeled` events are never used, because of the order shown above. The event ids give the order; the time of a stage is the difference of the two `created_at`.

```
 current label      is followed by          the stage that ends
 ready | queued     building                gate   (from the first of ready or queued)
 building           built                   build
 built              in-review               wait   (waiting for the person)
 in-review          pr-open                 device (review on a device)
 pr-open            closed, completed       peer   (review of the other person)
```

Any other event after a state ends that attempt without a sample: another label (an exit, or `building` after `built`), `closed` with another reason, and `reopened`. `ready` followed by `queued` followed by `building` is one gate that began at the `ready`. The label names come from `resolveLabelNames(config.labels)`, so renamed labels work.

*Alternative: pair `unlabeled` with `labeled`.* Rejected for the skew above.

### D3. The statistic, the unit and the line

`summarizeStages(samples)` gives, in the fixed order gate, build, wait, device, peer, `{ stage, median, count }` for the stages with at least one sample (the median of an even count is the mean of the two middle values). The duration is written in seconds under 100 s, minutes under 100 min, hours under 48 h and days above, rounded: `14 s`, `6 min`, `3 h`, `1 d`. The line is `Stages, last 7 days (median): gate 14 s (4), build 6 min (3), waiting for you 3 h (3), device review 1 d (2), peer review 2 d (1).` and its Spanish twin, after the usage line and after the early return for nothing waiting.

### D4. Where it lives

A new `scripts/lib/stages.mjs` holds the pure parts (`stagesOfIssue`, `summarizeStages`, `formatDuration`, the window constant `STAGE_DAYS = 7`). `gatherStages({ gh, repo, config, now })` goes in `status-data.mjs` with the other reads, behind the option `withStages` of `gatherStatus` that only the digest passes, so `/relevo:status` reads nothing more. `buildStatus` takes `stages` (a list of `{ stage, ms }`), `digest.mjs` takes it from the state file as it takes `usage`.

### D5. A failed read costs the line, nothing else

Any error in `gatherStages` is logged to stderr in one line and gives no samples, so the digest is posted without the line. A page cap reached or an issue limit reached is logged too and what was read is used.

## Risks / Trade-offs

- [The order of the stream is observed, not promised] → the stop rule needs the oldest event of the page, not the first; the cap of 30 pages bounds a wrong guess, and a test covers the stop.
- [Calls per digest: pages of the stream plus one per candidate issue] → about 1 + 3 for a week of a small repository, at most 30 + 100; far below the limit of the token, once a day.
- [A label renamed in `relevo.yml` during the window] → the events with the old name are not state labels any more; the stages around the rename are lost, no wrong number is shown.
- [A closed event without `state_reason` (old events)] → read as not completed; the window is seven days, far from the age at which GitHub did not record it.
- [A median of one sample looks like a trend] → the count is always shown beside it.
- [`closed` as completed with no `pr-open` before it, for example a manual close] → ends no stage.

## Migration Plan

- No workflow changes: the digest workflow already has `issues: write`, which includes reading events, and its scripts come from the pinned package. A project gets the line when it raises `RELEVO_VERSION` to the release that has it.
- The changelog entry says so. Rollback is a release without the option: the digest simply loses the line.

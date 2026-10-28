# Proposal

## Why

The specification promises that the daily digest includes the aggregate usage of the runs ("Cost control" in `security`), but the digest does not, and the `status` specification says the digest contains only who is waiting on what and the alerts. The two disagree and the code follows neither: the usage of each run is a sentence in a comment on its issue, so nobody can add it up and the team lead cannot see what the cloud builds cost.

## What Changes

- The usage comment of a run also carries a hidden, machine-readable marker with the turns, the cost, the tokens and whether the cost is notional. The visible sentence does not change.
- `status` reads those markers and the daily digest gains a line of aggregate usage (runs, turns, cost, tokens) for the last seven days. Runs without a marker, such as those made before this change, are not counted and are not guessed from the text of the comment.
- The digest requirement is corrected: it contains who is waiting on what, the alerts and, when there is any, the aggregate usage. A digest with nothing waiting still posts nothing.
- Out of scope: merging the usage comment with the result comment, the time spent in each stage, an estimate of the time left, and any change to the visible text of the usage sentence.

## Capabilities

### New Capabilities

### Modified Capabilities
- `execution-modes`: the usage comment of a cloud run also carries a hidden marker with the figures.
- `status`: the daily digest includes the aggregate usage of the runs when the markers have any.

## Impact

- `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs`: emit the marker with the comment.
- `scripts/lib/status-data.mjs`, `scripts/lib/status.mjs`: read the markers and render the usage line of the digest.
- `docs/commands.md`, `docs/execution.md` (and their Spanish versions): what the digest line means.
- `security` needs no delta: its "Cost control" requirement already says the digest includes aggregate usage, and this change makes the code match it.
- No new service and nothing leaves the repository, in line with "No telemetry from Relevo's tooling".

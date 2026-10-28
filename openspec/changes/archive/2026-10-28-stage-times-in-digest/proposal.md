# Proposal

## Why

The team can see what is waiting on whom and what the cloud runs cost, but not where the time of an issue goes: how long it waits for the gate, how long the agent takes, how long it sits built before its assignee looks at it, and how long a review lasts. Without that, a slow flow looks the same as a normal one until someone complains, and nothing says which stage to fix.

## What Changes

- The daily digest ends with one line that gives, for each stage of the lifecycle, the median time of the stages that finished in the last seven days and how many they were. For example: `Stages, last 7 days (median): gate 14 s (4), build 6 min (3), waiting for you 3 h (3), review 1 d (2).`
- The five stages are `ready` or `queued` to `building`, `building` to `built`, `built` to `in-review`, `in-review` to `pr-open`, and `pr-open` to the issue closed as completed.
- Only a stage that ends on the normal path is timed. A build rejected by QA, an issue sent back to the spec writer, a block or a request for changes is not a stage and does not count; an issue built more than once adds one build per success.
- A stage without any sample is left out of the line instead of showing zero, which is what happens in a solo review where stages are skipped. With no sample at all the digest has no such line.
- The times are read from the events GitHub already keeps for the issues, so nothing is stored and no marker is added. A read that fails leaves the digest without the line, as for the usage.
- Out of scope: showing the times in `/relevo:status`, the age of the stage an issue is in now (the alerts already report a build that stopped reporting), an estimate of the time left inside the progress comment of a run, and any option to change the window or the statistic.

## Capabilities

### New Capabilities

### Modified Capabilities
- `status`: the daily digest includes the line of stage times, and says which stages are timed, which are not, and where the times come from.

## Impact

- `scripts/lib/status-data.mjs`: read the label events of the repository, newest first and stopping at the window, and the timeline of the issues whose stage began before it.
- `scripts/lib/status.mjs` (and a new small library for the pairing of events): compute the stages and render the line in English and Spanish.
- `scripts/digest.mjs`: pass the times to the digest, also from a state file for the tests.
- `docs/commands.md`, `docs/execution.md` (and their Spanish versions): what the line means and what it leaves out.
- No new service, no marker and nothing leaves the repository, in line with "No telemetry from Relevo's tooling". The digest workflow already has `issues: write`, which includes reading events.

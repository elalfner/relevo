# Proposal

## Why

`/relevo:status` hides the reads that fail. When `gh` refuses one (the pilot saw HTTP 403 on the Actions path from a cloud session), the report is still printed as if it were complete, and for a person with nothing to do it says "Nothing is waiting on you." The report can then be wrong in a way the person cannot see: if the repository variable that pauses the cloud cannot be read, the status assumes the cloud builds and leaves out the ready issues the person should build by hand; if the comparison with the base branch cannot be read, a branch behind the base looks up to date. Three reads fail silently today: the go workflow file, the pause variable, and the comparison of a pull request's branch with its base. Only the reads of linked repositories already say `could not be read`.

## What Changes

- `gatherStatus` records each read that failed and why (the first line of the error), for those three reads, and returns them as `unread`.
- The report lists them under "Could not read", with what each affects, and says the rest may be incomplete. When there is nothing waiting on the person and something could not be read, the line "Nothing is waiting on you." is followed by "(from what could be read)". The JSON output carries `unread`.
- A read that fails on a 404 for the workflow file still means "the workflow is not installed": that is an answer, not a failure.
- The commands page says it; English and Spanish. The digest keeps its behaviour.
- Out of scope: retrying a read, and changing which reads status makes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `status`: the report says what it could not read.

## Impact

- `scripts/lib/status-data.mjs`, `scripts/lib/status.mjs`, their tests, the commands pages and the changelog. No new reads, no change to what a successful report says.

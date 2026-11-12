# Proposal

## Why

The real-run verification of #167 (sandbox, comment "Check 2" and "Check 1, observación menor") found two bot comments that say something other than what happened. Part of #115 (no guard changes: C2).

1. The `kept` rescue comment says "apply `relevo:ready` again to build from the start". What happens is that the run resumes from the last checkpoint: the resumed run began at "Tasks: 2 of 6" and did not redo the first group (`resume-check.mjs` resumes when every commit is Relevo's, the tip is a checkpoint or a limit commit, and the issue text is unchanged).
2. When `go` is launched by hand for an issue and others are queued ahead, the queue comment says "Running now: 1 (#116)" although #116 was not running yet. Read in `plan.mjs`: the figure is `runningSet`, which holds the issues running or `building` and also the issues the same evaluation has just decided to start. Both defects are real; nothing in the report is disproved.

## What Changes

- `run_no_outcome` situation `kept` (the branch of the issue): the next step says that applying `relevo:ready` again resumes from the last checkpoint and builds only the pending tasks, with the checkpoint count when it is known, and says what it does when no checkpoint exists. The case of a run that was not on the issue branch (`rescue/...`) keeps "build from the start", which is correct there because the issue branch holds nothing.
- `queued_agents`: the line `Running now` becomes `Running or starting now` (`En ejecución o por arrancar ahora`), because the count includes the issues this evaluation is about to start. The count is not changed: it is the number of slots the queued issue is waiting for, and it is read from the same set the planner uses to decide.
- Both texts stay in the catalog, rendered by `render-message.mjs`, in English and Spanish, with the language test.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `issue-lifecycle`: the queued-position comment names runs that are active or about to start.
- `go`: the comment of a run cut by the runner says what applying `ready` again does (resume), not "build from the start".

## Impact

`scripts/lib/messages.mjs`, `tests/messages.test.mjs`, `tests/messages-language.test.mjs`, `CHANGELOG.md` (unreleased). Not touched: `templates/workflows/*.yml`, `qa-aggregate.mjs`, the version, any guard. Limit: the workflow does not yet pass the checkpoint count to the renderer, so until a later change adds it the comment uses the wording for an unknown count; it is still correct.

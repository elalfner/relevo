# Proposal

## Why

Applying the `ship` label should be enough: one label, one merge. In practice the person applies it again and again until it takes. In the three repositories that use the label so far, 95 applications led to 64 merges and 31 stops, and 16 of the 19 issues that were stopped merged on a later application with nothing changed in between. Ten of those stops were not a problem with the pull request but a moment: checks of the approved head that had not finished (6), and a merge that GitHub refused because another pull request had entered the base branch a second earlier (4; it worked the second time in all four). The run reads the state once and stops, removing the label, so the person has to come back and apply it again.

## What Changes

- **The unattended ship waits for checks that are still running.** When the only reason to stop is that the checks of the approved head have not finished, the run keeps the label, looks again every so often and goes on when they pass. It stops like any other stop when a check fails, or when the time it may wait runs out.
- **One time budget for all the waiting of a run.** The wait for the checks of the approved head, for mergeability and for the checks of the archive commit share the limit the run already has, so the run still ends inside the workflow's time limit.
- **A merge refused because the base branch moved is tried once more.** The run reads the pull request again and decides again: a conflict, a missing approval or a failing check stop it as always; if the pull request still qualifies, it merges. If GitHub refuses the second time, it stops with that message.
- **The comment of a stop says whether applying the label again helps.** A wait that ran out, a merge refused twice and a state that never settled say that applying the label again retries; a conflict, an approval on older code or a failed archive say what to do first.
- **The local `/relevo:ship` does the same.** It waits for the checks of the pull request, with a limit, instead of stopping and asking the person to run it again, and it tries the merge a second time when the base branch moved.

Not in this change: shipping a pull request that has conflicts, a missing approval or a failing check; resuming a stopped run by itself with the label removed (a stop still removes the label); a second token or a new workflow; a wait without a limit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ship`: running checks are waited for, a merge refused because the base moved is retried once, and what a stop says about applying the label again.

## Impact

- `scripts/lib/ship-unattended.mjs` and its tests (`tests/ship-unattended.test.mjs`): the wait and the second merge attempt, with one shared deadline.
- `scripts/lib/ship.mjs` and `messages.mjs`: the reason for checks that never finished and the line about applying the label again, in English and Spanish.
- `skills/ship/SKILL.md` and `tests/skill-ship.test.mjs`: the local wait and the second merge attempt.
- `templates/workflows/relevo-ship.yml`: the header comment (the run may now wait for checks before archiving). The run's time limit does not change.
- `docs/` (execution, commands and guide, English and Spanish): what the label does when checks are still running.
- A repository gets the change by raising `RELEVO_VERSION` in its copy of the workflow once this is released.

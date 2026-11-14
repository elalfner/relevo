## Why

In the pilot of a real project (issue #126, part of #115) one unattended ship stopped with "GitHub has not finished checking whether the pull request can be merged: try again in a minute" and removed the `relevo:ship` label, so a person had to apply it again for a state that a short wait resolves. The same pilot raised a doubt: several pull requests merged seconds after their last CI started, and `ship` never says which commit's checks it relied on, so nobody can tell afterwards whether that was correct.

## What Changes

- The unattended ship waits and retries, a bounded number of times, when GitHub reports the mergeability of the pull request as not computed yet. The `ship` label stays on the issue while it waits. A `CONFLICTING` pull request does not wait: it stops as before.
- When the retries are used up, the run stops, removes the label, and says that GitHub never settled the state and that applying the label again retries.
- The comment of a merged unattended ship always names the commit whose checks it relied on (the merged head, or the approved head when the archive commit had none) and says what the checks of the merged commit were at the moment of the merge: finished and passing, or none of its own.
- The local `/relevo:ship` skill gets the same retry for that reason and reports the same facts.

## Capabilities

### New Capabilities

### Modified Capabilities

- `ship`: a transient mergeability state is retried before it stops a ship, and the final comment records which checks were relied on.

## Impact

- `scripts/lib/ship-unattended.mjs` (`check` and the note of the final comment), `scripts/lib/ship.mjs` (the summary carries the commit the checks come from), `scripts/lib/messages.mjs` only if the stop needs its own wording.
- `skills/ship/SKILL.md`, the header of `templates/workflows/relevo-ship.yml` (comments only), `docs/execution.md` where it describes the ship, and `CHANGELOG.md` (unreleased).
- Tests: `tests/ship-unattended.test.mjs`, `tests/ship.test.mjs`, `tests/skill-ship.test.mjs`, `tests/workflow-ship.test.mjs`.
- No new permission and no new step in the workflow (constraint C1): the wait is a sleep inside the existing script, well inside the 45-minute job timeout.
- Out of scope: changing branch protection, making CI wait for the bot's archive commit, and the CI runs of the archive commits that fail with no jobs. No version bump.

## Context

`shipDecision` (scripts/lib/ship.mjs) turns any `mergeable` other than `MERGEABLE` and `CONFLICTING` into the reason "GitHub has not finished checking...". `runUnattendedShip` calls it through `check()`, which already polls for the head of the pull request to match the local one (up to 6 tries of 10 s). GitHub computes mergeability lazily, and it returns `UNKNOWN` right after a push; the archive push makes that the normal state of the second check. The final comment names the approved head only when the checks were carried over (`NOTES.baseline`).

## Goals / Non-Goals

**Goals:** retry the transient state with a bound, keep the label meanwhile, say plainly when it never settles, and make the merge comment record the commit whose checks were relied on and the state of the merged commit's own checks.

**Non-Goals:** branch protection, making CI wait for the bot's archive commit, the archive CI runs that fail with no jobs, and verifying whether the merges seen in the pilot were premature. The comment gives that evidence for the next time.

## Decisions

### D1: The wait lives in `check()`, next to the head poll
After the head matches, `check()` reloads the pull request while `mergeable` is neither `MERGEABLE` nor `CONFLICTING`, sleeping `mergeablePollMs` (default 10 s) up to `mergeableTries` (default 9, so about 90 s) times. Both are context options like `headPollMs`, so tests use no real time. Because `check()` is used for the first read, the one after the archive and the one after a conflict recovery, all three get the retry. The label is only removed by the stop path, so waiting leaves it. Alternative: retry the whole run from the workflow; rejected, it needs a new step and would repeat the archive.

### D2: Exhaustion is a normal stop with its own reason
After the last try the run calls `stopReasons` with a sentence that says GitHub never computed the mergeability after N tries and that applying the label again retries. The existing stop path removes the label and comments, so the edge case of the issue needs no new message kind. The generic reason of `shipDecision` stays for `ship-check.mjs` and the local skill.

### D3: The summary says which commit the checks come from
`shipDecision`'s summary gains `checksOid`: the head of the pull request, or the baseline when the checks were carried over. The comment note is built from `checksFrom`, `checksOid`, the merged head and the checks state: own checks → "The checks of the merged commit X (N checks) had finished and passed when it was merged"; carried → "X, the approved head, supplied the checks: the merged commit Y changes only openspec/ and had no checks of its own when it was merged, none running and none failed". A running or failing check of the merged head never reaches the note because it stops the merge earlier; the note says so by stating the state read at the moment of the merge.

### D4: The local skill gets the same rule in prose
`ship-check.mjs` is one call and cannot wait; the skill tells the agent to rerun it a few times, about 10 s apart, when the only reason is the mergeability one, and to report the commit whose checks it relied on. Skill text is covered by `tests/skill-ship.test.mjs`.

## Risks / Trade-offs

- A pull request that GitHub never computes costs about 90 s before the stop; acceptable against the 45-minute job timeout.
- The note states what was read at the merge; checks that start after it are out of reach, as the issue says.

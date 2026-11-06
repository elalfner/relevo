## ADDED Requirements

### Requirement: A transient mergeability state is retried
When GitHub reports the mergeability of the pull request as not computed yet, the unattended ship SHALL wait and look again, a bounded number of times, before it decides, and SHALL leave the `ship` label on the issue while it waits. A pull request that GitHub reports as conflicting SHALL NOT be waited for. The wait SHALL run inside the existing workflow, with no other permission. When the state is still not computed after the last try, the run SHALL stop like any other stop: it removes the label and comments that GitHub never settled the state and that applying the label again retries.

#### Scenario: Mergeability unknown at first, computed a moment later
- **WHEN** GitHub reports the mergeability as unknown on the first reads and as mergeable on a later read within the limit
- **THEN** the run waits, keeps the label, and goes on to merge

#### Scenario: Mergeability never computed
- **WHEN** GitHub still reports the mergeability as unknown after the last try
- **THEN** nothing is merged, the label is removed, and the comment says that the state never settled and that applying the label again retries

#### Scenario: Conflicting pull request
- **WHEN** GitHub reports the pull request as conflicting
- **THEN** the run does not wait for the state and stops as before

#### Scenario: Local ship meets the same state
- **WHEN** `/relevo:ship` finds that GitHub has not computed the mergeability yet
- **THEN** it looks again after a short wait, a few times, before it stops and tells the person to try in a minute

### Requirement: The merge comment records which checks were relied on
The comment of a merged unattended ship SHALL name the commit whose checks it relied on and why: the merged head, when the checks ran on it, or the approved head, when the merged head is an archive commit with no checks of its own. It SHALL also state the checks of the merged head at the moment of the merge: finished and passing, or none of its own. A repository where no check ran SHALL keep saying so.

#### Scenario: Checks ran on the merged head
- **WHEN** the merged head has checks and all of them finished passing
- **THEN** the comment names the merged head and says that its checks had finished and passed

#### Scenario: Archive commit without checks
- **WHEN** the merged head is an archive commit with no checks of its own and the checks of the approved head were used
- **THEN** the comment names the approved head as the one relied on, and says that the merged head had no checks of its own at the moment of the merge

#### Scenario: No check at all
- **WHEN** no check ran on the code and `review.ship_without_ci` is `true`
- **THEN** the comment says that no check vouched for the code

# Spec Delta

## ADDED Requirements

### Requirement: Checks that are still running are waited for
When the only reason an unattended ship would stop is that the checks of the approved head have not finished, the run SHALL keep the `ship` label, look again at a regular interval and go on once they have finished and pass. It SHALL NOT wait for a pull request that has any other reason to stop, and SHALL stop at once when a check has failed.

#### Scenario: Checks finish while the run waits
- **WHEN** the label is applied while the checks of an approved pull request are running and they pass within the limit
- **THEN** the run keeps the label while it waits and then archives and merges as for any other ship

#### Scenario: A check fails while the run waits
- **WHEN** a check of the approved head fails while the run waits
- **THEN** the run stops, removes the label, merges nothing and names the failing check

#### Scenario: Another reason to stop besides the running checks
- **WHEN** checks are running and the pull request also has a conflict or lacks an approval on the current code
- **THEN** the run does not wait and stops with every reason

#### Scenario: Checks that never finish
- **WHEN** the checks are still running when the time the run may wait is used up
- **THEN** the run stops, removes the label, merges nothing, and the comment names the checks that were running and says that applying the label again retries

### Requirement: One time limit covers all the waiting of a run
The wait for the checks of the approved head, the wait for GitHub to compute mergeability and the wait for the checks of the archive commit SHALL share one limit, which SHALL end before the time limit of the workflow.

#### Scenario: Long waits add up
- **WHEN** the run has already waited for the checks of the approved head and then waits for the checks of the archive commit
- **THEN** the second wait ends when the shared limit is used up, not a full limit later

### Requirement: A merge refused because the base branch moved is retried once
When GitHub refuses the merge because the base branch was modified since the pull request was read, the unattended ship SHALL read the pull request again, decide again with the same rules and, if it still qualifies, try the merge a second time. It SHALL NOT try a third time.

#### Scenario: Another pull request entered the base a moment before
- **WHEN** GitHub refuses the merge with a message that the base branch was modified and the pull request still qualifies on the second reading
- **THEN** the run merges it and finishes as for any other ship

#### Scenario: The base change conflicts with the pull request
- **WHEN** the second reading shows that the pull request now has conflicts
- **THEN** the run stops with the conflict reason and merges nothing

#### Scenario: The second merge is also refused
- **WHEN** GitHub refuses the second attempt
- **THEN** the run stops, removes the label, and the comment gives GitHub's message and says that applying the label again retries

### Requirement: A stop says whether applying the label again helps
The comment of an unattended ship that stops SHALL say, for each reason, whether applying the label again can succeed without anything changing (a wait that ran out, a state that never settled, a merge refused twice) or whether something must be done first (a conflict, an approval on older code, a failed archive, a failing check).

#### Scenario: A reason that only needs time
- **WHEN** the run stops because the checks were still running after the limit
- **THEN** the comment says that applying the label again retries, and does not ask the person to change anything

#### Scenario: A reason that needs action
- **WHEN** the run stops because the pull request has conflicts
- **THEN** the comment says that the author must synchronise the branch first and does not suggest applying the label again before that

### Requirement: The local ship waits and retries on the same terms
`/relevo:ship` SHALL wait, for a bounded time, for the checks of the pull request when they are the only reason to stop, and SHALL try the merge a second time when GitHub refuses it because the base branch moved, before it tells the person to run it again.

#### Scenario: Checks still running in a session
- **WHEN** the checks of the approved pull request are running and are the only reason to stop
- **THEN** `/relevo:ship` waits for them up to the limit and goes on to ask for the confirmation once they pass

#### Scenario: The limit is used up in a session
- **WHEN** the checks are still running after the limit
- **THEN** `/relevo:ship` stops, names the checks and says that it can be run again

## ADDED Requirements

### Requirement: Unfinished work is saved, not left in the tree
When QA still rejects after the retries, `fix` SHALL save the working tree in a stash named `relevo-fix #<issue> iteration <k>`, leave the tree clean and the labels unchanged, and say how to resume. A stash of the issue SHALL be offered back on the next start. Discarding it SHALL need written confirmation.

#### Scenario: QA rejects after the retries
- **WHEN** QA still rejects after the retries on issue 42, iteration 2
- **THEN** the changes are saved in a stash named "relevo-fix #42 iteration 2", the working tree is clean, the labels are unchanged and the findings are shown

#### Scenario: Resuming
- **WHEN** `fix` starts on issue 42 and a stash named for issue 42 exists
- **THEN** it offers to restore it, and restores it and goes on from the developer step only after the person agrees

#### Scenario: Restore conflicts
- **WHEN** restoring the stash conflicts with the branch
- **THEN** `fix` stops, keeps the stash and explains which files conflict

#### Scenario: Start from scratch
- **WHEN** the person wants to discard the stash
- **THEN** it is dropped only after their written confirmation

### Requirement: A branch without implementation is not corrected
`fix` SHALL tell a branch whose only differences from the base branch are inside the change folder from one that holds implementation, and for the first SHALL stop and say to delete the remote branch and label the issue `ready` again.

#### Scenario: Branch with only the specification
- **WHEN** every file that differs from the base branch is under `openspec/changes/<change>/`
- **THEN** `fix` changes nothing and tells the person to delete the remote branch and apply `relevo:ready` again

#### Scenario: Branch with code
- **WHEN** a file outside the change folder differs from the base branch
- **THEN** `fix` goes on

### Requirement: The task list is checked around a fix
Before the developer runs, the only unchecked tasks in `tasks.md` SHALL be those of the correction section just added. After QA passes, no task SHALL be unchecked. The section SHALL include a task for a regression test, unless every correction is marked as visible only on a device.

#### Scenario: An old task is still open
- **WHEN** a task of the original build is unchecked before the developer runs
- **THEN** the check fails and names the task

#### Scenario: A correction is left open
- **WHEN** QA passes but a correction task is unchecked
- **THEN** `fix` does not commit and names the task

#### Scenario: No regression test
- **WHEN** the correction section has no test task and no correction is marked as device-only
- **THEN** the specification-first check fails and says a regression test is missing

#### Scenario: Device-only correction
- **WHEN** a correction task is marked "(device only)" because the defect shows only on a device
- **THEN** no test task is required for it

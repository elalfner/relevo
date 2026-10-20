## ADDED Requirements

### Requirement: Ship can be run again after a failed merge
`ship` SHALL skip the archive when the change is already archived on the branch and continue from the merge. When the archive leaves the pull request in conflict only inside `openspec/`, it SHALL revert the archive commit, bring in the base branch and archive again, all with normal pushes; a conflict outside `openspec/` SHALL stop it.

#### Scenario: Merge failed after the archive was pushed
- **WHEN** the change is archived on the branch and `ship` is run again
- **THEN** it skips the archive step and goes on to check and merge

#### Scenario: Conflict only in specifications
- **WHEN** after the archive the pull request conflicts only in files under `openspec/`
- **THEN** `ship` reverts the archive commit, merges the base branch into the branch, archives again and pushes normally

#### Scenario: Conflict in code
- **WHEN** the conflict includes a file outside `openspec/`
- **THEN** `ship` stops and names the files

### Requirement: The approval is for the code that will be merged
With `review.mode` `peer` or `roles`, an approval SHALL count only if it was given on the current head commit of the pull request or on the head recorded when `ship` started. A newer approval by the same person replaces an older one as before.

#### Scenario: Approval on an older commit
- **WHEN** the only approval was given on a commit that is not the head and not the recorded head
- **THEN** `ship` stops and says a new approval is needed on the current code

#### Scenario: Archive commit after the approval
- **WHEN** the approval is on the head recorded at the start and the only commit since is the archive
- **THEN** `ship` goes on

### Requirement: Ship requires the issue to be ready for it
`ship` SHALL require the issue to be in the state `pr-open` and, in any other state, SHALL name the command that is missing: `/relevo:review` for `built` and `in-review`, `/relevo:fix` for `qa-failed` and `changes-requested`.

#### Scenario: Issue not reviewed yet
- **WHEN** the issue is `built`
- **THEN** `ship` stops and says to run `/relevo:review <n>` first

#### Scenario: Issue with a pull request open
- **WHEN** the issue is `pr-open`
- **THEN** `ship` goes on to the other checks

### Requirement: The change is validated before it is archived
Before `openspec archive`, `ship` SHALL run `openspec validate` on the change and SHALL require that no task is unchecked.

#### Scenario: Task left open
- **WHEN** a task of the change is unchecked
- **THEN** `ship` stops before archiving and names the task

#### Scenario: Invalid specification
- **WHEN** `openspec validate` fails
- **THEN** `ship` stops before archiving and shows the failure

## MODIFIED Requirements

### Requirement: Who may run ship
When `review.mode` is `peer` or `roles`, the approval SHALL always come from someone other than the author (see below), and who runs `ship` depends on `review.merger`: with `approver` the person invoking it SHALL be a member of `team.members`, SHALL NOT be the author or the `team.spec_writer`, and in `roles` mode SHALL be in `team.approvers`; with `author` the author runs it after a non-author approval exists. A person who is eligible but did not approve SHALL be allowed to run it only after confirming in writing that they did not approve. When `review.mode` is `none` there is no restriction on who runs it.

#### Scenario: Approver merges, author tries to ship
- **WHEN** `review.merger` is `approver` and the author runs `ship` on their own pull request
- **THEN** it refuses and names the peer who should run it

#### Scenario: Author merges
- **WHEN** `review.merger` is `author`, a non-author approval exists and the author runs `ship`
- **THEN** it proceeds to the confirmation step

#### Scenario: Someone other than the author tries to ship when the author merges
- **WHEN** `review.merger` is `author` and a person other than the author runs `ship`
- **THEN** it refuses and names the author

#### Scenario: The spec writer tries to ship
- **WHEN** `review.merger` is `approver` and the `team.spec_writer` runs `ship`
- **THEN** it refuses and says the spec writer never merges

#### Scenario: A person outside the team tries to ship
- **WHEN** `team.members` lists people and the person running `ship` is not one of them
- **THEN** it refuses and says only members run it

#### Scenario: Eligible person who did not approve
- **WHEN** an eligible person other than the approver runs `ship`
- **THEN** the confirmation step also asks them to confirm in writing that they did not approve it

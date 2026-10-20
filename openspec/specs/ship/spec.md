# ship Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: A pull request must exist
`ship` SHALL NOT create the pull request. If none exists for the branch it SHALL stop and direct the person to `/relevo:review`.

#### Scenario: No pull request
- **WHEN** `ship` runs for an issue whose branch has no open pull request
- **THEN** it stops and names `/relevo:review`

### Requirement: Pre-merge checks
`ship` SHALL verify that the pull request is open, has no conflicts, and that required status checks are green. It SHALL scan the diff against the base branch for temporary markers and credential patterns and abort on a match.

#### Scenario: Conflicts
- **WHEN** the pull request has conflicts
- **THEN** `ship` stops and tells the author to synchronise the branch

#### Scenario: No CI configured
- **WHEN** there are no status checks
- **THEN** `ship` states that there is no objective check and continues only after the person confirms

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

### Requirement: Approval is required and human
When `review.mode` is `peer` or `roles`, `ship` SHALL require an approval from someone other than the author (in `roles` mode, from a member of `team.approvers`) and no outstanding change requests. The agent SHALL NOT approve on its own.

#### Scenario: No approval
- **WHEN** no non-author approval exists
- **THEN** `ship` stops and reports that it is waiting for review

#### Scenario: Explicit confirmation
- **WHEN** approval exists
- **THEN** `ship` shows the summary (changes, QA verdict, review verdict) and merges only after the person confirms in writing

### Requirement: No bypass of protections
`ship` SHALL NOT use administrator override, bypass rulesets, approve the pull request itself or dismiss reviews. When the platform refuses the merge, `ship` SHALL report the reason and stop.

#### Scenario: Merge refused
- **WHEN** the platform refuses the merge because a protection is not satisfied
- **THEN** `ship` reports the platform's reason, changes nothing further and does not retry with an override

### Requirement: Solo mode
When `review.mode` is `none`, `ship` SHALL require only the invoking person's explicit confirmation.

#### Scenario: Solo confirmation
- **WHEN** `review.mode` is `none` and the person confirms
- **THEN** `ship` proceeds without requiring a peer approval

### Requirement: Archive the specification just before merging
`ship` SHALL archive the change's specification on the feature branch right before merging, commit and push it, so code and specification enter the base branch in one squash commit. It SHALL verify that the archive commit modifies only the specifications directory, and abort otherwise.

#### Scenario: Archive commit touches only specs
- **WHEN** the archive commit modifies only files under the specifications directory
- **THEN** `ship` proceeds to merge

#### Scenario: Archive commit touches code
- **WHEN** the archive commit modifies any file outside the specifications directory
- **THEN** `ship` aborts before merging and reports the files

### Requirement: Squash merge and close-out
`ship` SHALL squash-merge into the base branch with a title that includes the summary and the issue number and a body that only refers to the issue, ensure the issue is closed as completed (which is the final state), remove all lifecycle labels, delete the feature branch locally and on the remote, and update the local base branch first.

#### Scenario: Merge
- **WHEN** the person confirms
- **THEN** the pull request is squash-merged, the issue is closed as completed, lifecycle labels are removed and the feature branch is deleted

#### Scenario: Base branch is not the default branch
- **WHEN** the pull request is merged into a base branch that is not the repository's default branch
- **THEN** `ship` closes the issue explicitly as completed, because GitHub only closes issues automatically when merging into the default branch

#### Scenario: Clean squash commit
- **WHEN** the pull request is squash-merged
- **THEN** the commit message holds only the title and a reference to the issue, with no list of intermediate commits and no links or attribution lines

### Requirement: Confirmation comes before any change
`ship` SHALL ask for the person's written confirmation before it archives or merges anything, and SHALL NOT bypass branch protection, required checks or required reviews.

#### Scenario: Declined
- **WHEN** the person does not confirm
- **THEN** nothing is archived, pushed or merged

#### Scenario: Checks rerun after the archive push
- **WHEN** the archive commit starts new checks or dismisses an approval
- **THEN** `ship` waits for the checks, checks again, and stops if the pull request no longer qualifies

### Requirement: Release is separate
Promoting the base branch to the release branch SHALL be a separate pull request, with a version tag, and SHALL NOT be performed by `ship`.

#### Scenario: After the last merge of a milestone
- **WHEN** `ship` completes
- **THEN** it reminds the person that releasing is a separate step

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

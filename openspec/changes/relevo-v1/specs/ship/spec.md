## ADDED Requirements

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
When `review.mode` is `peer` or `roles`, the approval SHALL always come from someone other than the author (see below), and who runs `ship` depends on `review.merger`: with `approver` the person invoking it SHALL NOT be the author; with `author` the author runs it after a non-author approval exists. When `review.mode` is `none` there is no restriction on who runs it.

#### Scenario: Approver merges, author tries to ship
- **WHEN** `review.merger` is `approver` and the author runs `ship` on their own pull request
- **THEN** it refuses and names the peer who should run it

#### Scenario: Author merges
- **WHEN** `review.merger` is `author`, a non-author approval exists and the author runs `ship`
- **THEN** it proceeds to the confirmation step

#### Scenario: Someone other than the author tries to ship when the author merges
- **WHEN** `review.merger` is `author` and a person other than the author runs `ship`
- **THEN** it refuses and names the author

### Requirement: Approval is required and human
When `review.mode` is `peer` or `roles`, `ship` SHALL require an approval from someone other than the author (in `roles` mode, from a member of `team.approvers`) and no outstanding change requests. The agent SHALL NOT approve on its own.

#### Scenario: No approval
- **WHEN** no non-author approval exists
- **THEN** `ship` stops and reports that it is waiting for review

#### Scenario: Explicit confirmation
- **WHEN** approval exists
- **THEN** `ship` shows the summary (changes, QA verdict, review verdict) and merges only after the person confirms in writing

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

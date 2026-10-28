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
- **WHEN** there are no status checks and `ship` runs in a session
- **THEN** `ship` states that there is no objective check and continues only after the person confirms

#### Scenario: No CI configured in an unattended ship
- **WHEN** there are no status checks on the approved head nor on the current head, the ship was started by the label, and `review.ship_without_ci` is not `true`
- **THEN** the run stops before archiving, and its comment says that the repository has no checks and that `/relevo:ship <n>` or `review.ship_without_ci: true` are the ways to ship it

#### Scenario: No CI accepted for unattended ships
- **WHEN** there are no status checks, the ship was started by the label, and `review.ship_without_ci` is `true`
- **THEN** the run goes on, and the final comment says that no check vouched for the code

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
`ship` SHALL ask for the person's written confirmation before it archives or merges anything, and SHALL NOT bypass branch protection, required checks or required reviews. When the ship was started by the `ship` label, the label applied by that person SHALL be the written confirmation.

#### Scenario: Declined
- **WHEN** the person does not confirm
- **THEN** nothing is archived, pushed or merged

#### Scenario: Checks rerun after the archive push
- **WHEN** the archive commit starts new checks or dismisses an approval
- **THEN** `ship` waits for the checks, checks again, and stops if the pull request no longer qualifies

#### Scenario: The label is the confirmation
- **WHEN** an eligible person applies the `ship` label to an issue whose pull request qualifies
- **THEN** the run archives and merges without asking anything else

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

### Requirement: A label starts an unattended ship
Applying the `ship` label to an issue SHALL start a ship of that issue on GitHub, without a model and without a local copy of the repository. It SHALL apply the same checks as `/relevo:ship`, judging the person who applied the label as the one who runs it, and SHALL end with the same result: archive, squash merge, issue closed, labels removed, branch deleted.

#### Scenario: Approved issue shipped by label
- **WHEN** the approver applies the `ship` label to a `pr-open` issue whose pull request is approved on the current code, has passing checks and no conflicts
- **THEN** the specification is archived on the branch, the pull request is squash-merged, the issue is closed as completed, every Relevo label is removed and the branch is deleted

#### Scenario: Label applied by an automation
- **WHEN** the `ship` label is applied by a bot or an app, not by a person
- **THEN** nothing is shipped and the label is removed

#### Scenario: Label on an issue that is not ready
- **WHEN** the `ship` label is applied to an issue that is not `pr-open`
- **THEN** nothing is changed except that the label is removed, and the comment names the missing command

### Requirement: Only the merger ships by label
In `peer` and `roles` mode, the `ship` label SHALL be honoured only from the person who ships under `review.merger`: with `approver`, a person whose approval counts for the current code and who is otherwise eligible; with `author`, the author once such an approval exists. An eligible person who did not approve SHALL be directed to `/relevo:ship <n>`, which asks them to confirm that. In `none` mode, anyone allowed to label the issue SHALL be honoured.

#### Scenario: Eligible member who did not approve
- **WHEN** `review.merger` is `approver` and a member who is eligible but did not approve applies the label
- **THEN** nothing is changed except that the label is removed, and the comment says to run `/relevo:ship <n>`, which asks them to confirm that they did not approve

#### Scenario: The author labels when the approver merges
- **WHEN** `review.merger` is `approver` and the author applies the label
- **THEN** nothing is shipped, and the comment names the approver who should do it

### Requirement: An unattended ship that stops says why
When an unattended ship stops for any reason, it SHALL remove the `ship` label, leave the lifecycle label as it was, and comment on the issue the reasons and what to do next, mentioning the person who applied the label. Nothing SHALL be merged. An unexpected error (a failed call to GitHub, for example) SHALL count as a stop whose reason is the error's message, not as a crash.

#### Scenario: Approval on older code
- **WHEN** the label is applied and the only approval is on a commit that is not the current head
- **THEN** the run stops, the label is removed, the issue stays `pr-open`, and the comment says that a new approval is needed on the current code

#### Scenario: Run fails without an outcome
- **WHEN** the run ends with an error before it merged or commented
- **THEN** a final step removes the label and comments that the ship did not finish, with a link to the log

#### Scenario: Unexpected error with a message
- **WHEN** a call to GitHub fails in a way the run did not foresee, such as a refusal of the token
- **THEN** the run removes the label and comments the message of GitHub as the reason, mentioning the person who applied the label, and merges nothing

### Requirement: The unattended ship does not run the pull request
An unattended ship SHALL NOT run any code or script from the pull request's branch. Its scripts SHALL come from the published Relevo package, and the configuration it applies SHALL be the one on the base branch.

#### Scenario: The pull request changes the team
- **WHEN** the pull request adds the person who applied the label to `team.members` in `relevo.yml`
- **THEN** eligibility is judged with the `relevo.yml` of the base branch, where that person is not a member, and the run stops

### Requirement: Checks of the approved head count for the archive commit
When the current head differs from the head recorded before the archive only by files under `openspec/` and the current head has no checks of its own, `ship` SHALL judge the checks of the recorded head. When the current head has checks, they SHALL be judged instead.

#### Scenario: Archive pushed with a token that starts no workflows
- **WHEN** the checks passed on the recorded head and the archive commit, which changes only `openspec/`, has no checks
- **THEN** `ship` treats the checks as passing and goes on to merge

#### Scenario: Head changed outside openspec
- **WHEN** a commit between the recorded head and the current head changes a file outside `openspec/`
- **THEN** the checks of the recorded head do not count

#### Scenario: Checks ran on the archive commit
- **WHEN** the archive commit has checks of its own and one fails
- **THEN** `ship` stops and names the failing check

### Requirement: Repositories that require checks ship with an App
When the base branch requires status checks, the unattended ship SHALL push, merge and close with the token of a GitHub App whose id and private key are repository secrets, so that the project's checks run on the archive commit, and SHALL wait for those checks before checking again and merging. Without those secrets it SHALL stop before archiving and say which secrets to create.

#### Scenario: Required checks and an App
- **WHEN** the base branch requires checks and the App secrets exist
- **THEN** the archive is pushed with the App token, the run waits for the checks of the archive commit, and merges once they pass

#### Scenario: Required checks without an App
- **WHEN** the base branch requires checks and the App secrets do not exist
- **THEN** the run stops before archiving, and the comment names the two secrets and the `/relevo:ship <n>` alternative

#### Scenario: Checks time out
- **WHEN** the checks of the archive commit do not finish within the run's time limit
- **THEN** the run stops without merging, and the comment says that applying the label again resumes from the merge

### Requirement: The queue learns about an unattended ship
After an unattended ship closes the issue, it SHALL start an evaluation of the queue, because a close made with the workflow token starts no other workflow and issues that depend on it would otherwise stay blocked until the next scheduled evaluation.

#### Scenario: A dependent issue is waiting
- **WHEN** an issue that is `blocked` on the shipped issue exists
- **THEN** the queue evaluation runs right after the close and unblocks it

### Requirement: A base branch whose rules the plan does not offer requires no checks
When GitHub refuses to report the rules of the base branch because of the repository's plan or visibility (403 asking to upgrade the plan or to make the repository public), the unattended ship SHALL treat the base branch as requiring no status checks. Any other failure to read the rules SHALL stop the run before anything is archived, with the message of GitHub in the comment.

#### Scenario: Private repository on a free plan
- **WHEN** the label is applied and both the rules and the protection of the base branch answer 403 asking to upgrade the plan
- **THEN** the run does not stop for that, needs no App, and judges the pull request as it does for a base branch with no required checks

#### Scenario: Refusal for permissions
- **WHEN** the rules of the base branch answer 403 for the permissions of the token
- **THEN** the run stops before archiving and the comment gives the message of GitHub, because it cannot tell whether checks are required

#### Scenario: Server error reading the rules
- **WHEN** the rules of the base branch answer a server error
- **THEN** the run stops before archiving and the comment gives the error, and applying the label again retries

#### Scenario: No rules, everything else holds
- **WHEN** the base branch has no rules available and the pull request is approved on the current code, is not a draft, has no conflicts and has green checks
- **THEN** the run archives, merges and closes the issue as it does with a base branch that requires none

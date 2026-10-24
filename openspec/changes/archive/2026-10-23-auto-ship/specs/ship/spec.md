# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
When an unattended ship stops for any reason, it SHALL remove the `ship` label, leave the lifecycle label as it was, and comment on the issue the reasons and what to do next, mentioning the person who applied the label. Nothing SHALL be merged.

#### Scenario: Approval on older code
- **WHEN** the label is applied and the only approval is on a commit that is not the current head
- **THEN** the run stops, the label is removed, the issue stays `pr-open`, and the comment says that a new approval is needed on the current code

#### Scenario: Run fails without an outcome
- **WHEN** the run ends with an error before it merged or commented
- **THEN** a final step removes the label and comments that the ship did not finish, with a link to the log

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

## ADDED Requirements

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

## MODIFIED Requirements

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

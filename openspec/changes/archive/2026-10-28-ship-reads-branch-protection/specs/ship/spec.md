## MODIFIED Requirements

### Requirement: A base branch whose rules the plan does not offer requires no checks
When GitHub refuses to report the rules of the base branch because of the repository's plan or visibility (403 asking to upgrade the plan or to make the repository public), the unattended ship SHALL treat the base branch as requiring no status checks, and SHALL NOT read its classic protection. Any other failure to read the rules SHALL stop the run before anything is archived, with the message of GitHub in the comment.

#### Scenario: Private repository on a free plan
- **WHEN** the label is applied and the rules of the base branch answer 403 asking to upgrade the plan
- **THEN** the run does not stop for that, does not read the classic protection, needs no App, and judges the pull request as it does for a base branch with no required checks

#### Scenario: Refusal for permissions
- **WHEN** the rules of the base branch answer 403 for the permissions of the token
- **THEN** the run stops before archiving and the comment gives the message of GitHub, because it cannot tell whether checks are required

#### Scenario: Server error reading the rules
- **WHEN** the rules of the base branch answer a server error
- **THEN** the run stops before archiving and the comment gives the error, and applying the label again retries

#### Scenario: No rules, everything else holds
- **WHEN** the base branch has no rules available and the pull request is approved on the current code, is not a draft, has no conflicts and has green checks
- **THEN** the run archives, merges and closes the issue as it does with a base branch that requires none

## ADDED Requirements

### Requirement: The workflow token is enough to learn the required checks
The unattended ship SHALL learn which status checks the base branch requires from its rulesets and from the summary of its classic protection that anyone who can read the branch gets, and SHALL NOT depend on a permission to administer the repository. A failure to read that summary SHALL stop the run before anything is archived.

#### Scenario: Classic protection that requires checks
- **WHEN** the label is applied, no ruleset requires checks, and the classic protection of the base branch requires the checks `build` and `lint`
- **THEN** the run counts `build` and `lint` as required, and without the App secrets it stops before archiving as it does for any base branch that requires checks

#### Scenario: Classic protection that requires no checks
- **WHEN** the label is applied, no ruleset requires checks, and the classic protection of the base branch has no required status checks or the base branch is not protected
- **THEN** the run treats the base branch as requiring no checks and does not stop for that

#### Scenario: Rulesets and classic protection together
- **WHEN** a ruleset requires the check `test` and the classic protection requires the check `build`
- **THEN** the run counts both `test` and `build` as required

#### Scenario: The branch cannot be read
- **WHEN** reading the base branch fails with an error, such as a server error or a branch that does not exist
- **THEN** the run stops before archiving and the comment gives the message of GitHub, and nothing is merged

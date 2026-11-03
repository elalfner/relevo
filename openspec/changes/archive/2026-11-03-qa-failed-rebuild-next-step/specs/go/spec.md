## ADDED Requirements

### Requirement: The failure comment does not offer fix when nothing was pushed
When `go` ends in `qa-failed` with the branch not pushed (`unsafe` or `not_pushed`) and gives no explicit recovery, the comment SHALL show the next step of the `rebuild` variant and SHALL NOT suggest `/relevo:fix <n>`. A comment for a pushed branch, for kept work and for an existing branch SHALL keep its current next step.

#### Scenario: Commit refused by the scanner
- **WHEN** QA rejected the build, the safe commit of the work in progress was refused because of a possible credential, and `branch_state` is `unsafe`
- **THEN** the comment says the branch was not pushed, ends with the rebuild step, and does not contain `/relevo:fix`

#### Scenario: Not pushed for another reason
- **WHEN** the issue changed after `ready` and `branch_state` is `not_pushed`
- **THEN** the comment ends with the rebuild step and does not contain `/relevo:fix`

#### Scenario: Pushed branch unchanged
- **WHEN** `branch_state` is `pushed`
- **THEN** the next step is still `/relevo:fix <n>`

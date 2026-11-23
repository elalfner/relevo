# Spec Delta

## MODIFIED Requirements

### Requirement: Ship requires the issue to be ready for it
`ship` SHALL require the issue to be in the state `pr-open` and, in any other state, SHALL name the command that is missing: `/relevo:review` for `built` and `in-review`, `/relevo:fix` for `build-failed` and `changes-requested`.

#### Scenario: Issue not reviewed yet
- **WHEN** the issue is `built`
- **THEN** `ship` stops and says to run `/relevo:review <n>` first

#### Scenario: Issue with a pull request open
- **WHEN** the issue is `pr-open`
- **THEN** `ship` goes on to the other checks

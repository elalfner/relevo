# Spec Delta

## ADDED Requirements

### Requirement: Kept work is corrected from the failure comment
When the last commit of the branch is the work-in-progress commit that `go` makes after a rejection, `fix` SHALL take the finding of the last failure comment of the issue as the defect, tell the person what QA found and what it could not check, and ask only what that finding leaves open.

#### Scenario: QA could not run the tests
- **WHEN** the last failure comment says the analysis and the tests could not run and the branch holds the work in progress
- **THEN** `fix` runs them, corrects what they find and does not ask the person to describe a defect

#### Scenario: A branch without the work-in-progress commit
- **WHEN** the last commit of the branch is not that commit
- **THEN** `fix` behaves as before and asks the person what is wrong

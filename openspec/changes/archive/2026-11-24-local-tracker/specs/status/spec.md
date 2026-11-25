# Spec Delta

## ADDED Requirements

### Requirement: Status lists the issues of a files project from the files
With `tracker: files`, `/relevo:status` SHALL list the issues by state from `.relevo/issues/` and the state records, name the next command for each, and say which branches are waiting to be shipped. It SHALL NOT report review deadlines, reviewer alerts, milestones or team capacity.

#### Scenario: Mixed states
- **WHEN** issue 1 is `built` and issue 2 is `ready`
- **THEN** status lists `/relevo:review 1` and `/relevo:go 2` as the next commands

#### Scenario: Nothing waiting
- **WHEN** every issue is shipped
- **THEN** status says that nothing is waiting

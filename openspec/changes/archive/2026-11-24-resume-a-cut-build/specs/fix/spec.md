## ADDED Requirements

### Requirement: Fix says when the work is an unfinished build that resume continues
When the last commit of the branch is `wip: stopped by limit (#N)` or a checkpoint (`wip: checkpoint <k>/<n>`), `fix` SHALL tell the person, before it corrects anything, that the build did not finish and that `/relevo:go <n> --resume` continues it, and SHALL go on with the correction only when the person wants to correct the work instead. For work that QA rejected, `fix` SHALL NOT say it.

#### Scenario: The branch ends at a limit commit
- **WHEN** `fix` runs on a branch whose last commit is `wip: stopped by limit (#42)`
- **THEN** it says that the build did not finish and that `/relevo:go 42 --resume` continues it, and it corrects only if the person says so

#### Scenario: The branch ends at a QA rejection
- **WHEN** the last commit is `wip: rejected by QA`
- **THEN** `fix` reads the finding as before and does not mention `--resume`

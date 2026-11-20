# Spec Delta

## ADDED Requirements

### Requirement: The stack profile is resolved before the specification is committed
Before it commits the specification, `go` SHALL resolve the stack profile of the platform of the issue. When it cannot, the run SHALL take the failure path with the reason `profile not resolved` before anything is committed or pushed, so that the remote has no branch for the issue.

#### Scenario: The profile cannot be resolved
- **WHEN** the stack profile of the platform fails to resolve at the start of a run
- **THEN** the run ends with `profile not resolved`, no commit of the specification is made, nothing is pushed and the comment says the branch was not pushed

#### Scenario: The profile resolves
- **WHEN** the profile resolves
- **THEN** the specification is committed and the build goes on with that same profile

### Requirement: A failure that leaves only the specification on the branch names the way out
When a run ends in `build-failed` with a branch that it pushed and that holds only the specification, the comment SHALL give the recovery `delete-branch` and SHALL NOT suggest `/relevo:fix <n>`. The next step SHALL name the command that deletes the remote branch and say to build the issue again afterwards, with `relevo:go` or `/relevo:go <n> --retry`. A branch that holds implementation, kept work or checkpoints SHALL keep the next step it has.

#### Scenario: Failure between the specification and the build
- **WHEN** a run fails after it pushed the commit of the specification and before the developer ran, and the branch holds only files of the change
- **THEN** the comment says the branch holds only the specification, names the command that deletes it, and does not contain `/relevo:fix`

#### Scenario: Failure after work was kept
- **WHEN** the run kept work in progress on the branch
- **THEN** the next step is still the one for kept work

### Requirement: A refused retry says how to recover from a specification-only branch
When the planner refuses a retry because a branch `feature/<n>-*` exists on the remote and that branch holds only the specification of the change, the message SHALL say to delete that branch, with the command, and to run the retry again, and SHALL NOT send the person to `/relevo:fix <n>`. When the branch holds anything else, or its content cannot be read, the message SHALL be the one for a branch that is corrected. The planner SHALL NOT delete, reset or overwrite the branch itself.

#### Scenario: The branch holds only the specification
- **WHEN** a retry is requested for `build-failed` issue 67 and `origin/feature/67-...` differs from the base only under `openspec/changes/67-.../`
- **THEN** nothing changes and the message names `git push origin --delete feature/67-...` and the retry to run afterwards

#### Scenario: The branch holds code or a commit of a person
- **WHEN** the branch differs from the base outside the change folder
- **THEN** the message sends the person to `/relevo:fix 67` and the branch is untouched

#### Scenario: The branch cannot be read
- **WHEN** the content of the branch cannot be read
- **THEN** the message is the one for a branch that is corrected, and nothing is deleted

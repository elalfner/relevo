# Spec Delta

## ADDED Requirements

### Requirement: The developer builds one section of tasks at a time
`go` SHALL split the pending tasks of the change into groups, one per section of `tasks.md` in file order, and one group when three tasks or fewer are pending. It SHALL launch the developer once per group with only that group's tasks.

#### Scenario: A change with three sections
- **WHEN** `tasks.md` has sections 1, 2 and 3 with pending tasks in each
- **THEN** the developer is launched three times, each time with the tasks of one section

#### Scenario: A small change
- **WHEN** three tasks or fewer are pending
- **THEN** the developer is launched once with all of them

### Requirement: A checkpoint is committed and pushed after each group
After each group `go` SHALL commit the files that changed as `wip: checkpoint <k>/<n> (#N)`, with the hash of the issue text as a trailer, through the same safe commit as every commit, and push the branch of the issue without force.

#### Scenario: A group finishes
- **WHEN** the developer finishes the tasks of a group
- **THEN** its files are committed as a checkpoint and the branch is pushed

#### Scenario: The scans refuse a checkpoint
- **WHEN** a protected path, a restricted file, a marker or a credential is found
- **THEN** nothing is pushed and the build takes the failure path with that reason

#### Scenario: A cut after a checkpoint
- **WHEN** the runner cuts the run during the second group
- **THEN** the first group is on the remote branch and the rescue keeps what the second one had done

### Requirement: A later run resumes from the checkpoints
When the branch of the issue exists on the remote, `go` SHALL continue from it and build only the pending tasks if every commit over the base is a specification, checkpoint or limit commit of this issue, its tip is a checkpoint or limit commit that carries the hash of the issue text, and the text has not changed. Otherwise it SHALL stop with the reason `branch already exists`.

#### Scenario: A run resumes
- **WHEN** a run was cut after two of three groups and the issue is made `ready` again with the same text
- **THEN** the new run continues from the branch and builds the third group only

#### Scenario: A person committed on the branch
- **WHEN** one commit over the base is not one of Relevo's
- **THEN** the run stops with `branch already exists`

#### Scenario: The issue text changed
- **WHEN** the hash on the tip differs from the hash of the issue
- **THEN** the run stops with `branch already exists`

#### Scenario: The work was rejected by QA
- **WHEN** the tip is `wip: rejected by QA`
- **THEN** the run stops with `branch already exists` and the recovery is `/relevo:fix`

### Requirement: A branch created by the run is not an existing branch
The rescue and the failure path SHALL push the branch of the issue when the remote tip is an ancestor of the local branch, and SHALL NOT push when the remote has commits that the local branch lacks.

#### Scenario: The remote holds the checkpoints of this run
- **WHEN** the rescue runs and the remote tip is an ancestor of the working branch
- **THEN** the work is committed and pushed as a fast-forward

#### Scenario: The remote holds other commits
- **WHEN** the remote branch has a commit that the working branch lacks
- **THEN** nothing is pushed and the comment says the branch was not touched

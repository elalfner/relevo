## MODIFIED Requirements

### Requirement: The work is kept when the runner cuts the run
When the agent step is cut by the runner or the job is cancelled or times out, and the issue is still `building` or `ready`, a step that always runs SHALL commit and push the working tree the same way, before the report of the run and before the cleanup. It SHALL NOT push when a commit is refused, SHALL NOT force-push and SHALL NOT overwrite a remote branch: it pushes only a fast-forward of what the remote has. When the work is kept on the branch of the issue, the comment SHALL say that applying `relevo:ready` again resumes from the last checkpoint and builds only the pending tasks (with the number of checkpoints when it is known, and what it resumes from when there is none), and that a changed issue text or a commit by a person stops the run instead. It SHALL NOT say that the run builds from the start. When the work is on a branch of its own because the run was not on the branch of the issue, the comment MAY say that the run builds from the start.

#### Scenario: The job is cut and the run recorded no outcome
- **WHEN** the agent step is cancelled or ends without an outcome and the working tree holds changes
- **THEN** the changes are committed and pushed to the branch of the issue, and the comment says the work was kept and that `/relevo:fix` continues from it

#### Scenario: The branch holds a checkpoint
- **WHEN** the work was kept on the branch of the issue and the branch has checkpoints
- **THEN** the comment says that `relevo:ready` resumes from the last checkpoint, and does not say "from the start"

#### Scenario: The branch holds no checkpoint
- **WHEN** the work was kept on the branch of the issue and no checkpoint exists, or their number is not known
- **THEN** the comment says that `relevo:ready` resumes from the work kept on the branch, and does not say "from the start"

#### Scenario: The scans refuse the rescue commit
- **WHEN** the changes include a protected path, a restricted file, a temporary marker or a possible credential
- **THEN** nothing is pushed and the comment names the file and why

#### Scenario: Nothing changed
- **WHEN** the working tree has no change to keep
- **THEN** no commit is made, nothing is pushed and the comment says nothing was built

#### Scenario: The remote branch has commits this run does not have
- **WHEN** `origin/<branch>` has a commit that the working branch lacks
- **THEN** it is not touched and the comment says so

#### Scenario: The run never left the base branch
- **WHEN** the working tree holds changes and the run is on the base branch or a detached head, not on the branch of the issue
- **THEN** the changes are carried to a new branch of the issue and kept there, and the base branch receives no commit

#### Scenario: The run is on some other branch
- **WHEN** the run is on a branch that is neither the base nor the branch of the issue
- **THEN** the changes are kept on a separate `rescue/<branch>` branch from where the run stands, nothing is pushed to the base branch, and the comment says the work is not on the branch that `/relevo:fix` reads

#### Scenario: The install step rewrote a lockfile
- **WHEN** a file already differed from the commit before the agent started (the install step rewrote a lockfile) and the agent has not changed it since
- **THEN** the rescue and the checkpoints leave it out, so that the refusal of a dependency file the issue did not list does not take the work of the agent with it

#### Scenario: The agent changed that file again
- **WHEN** the agent changed a file that was in the state recorded before it started
- **THEN** it is judged like any change, and a dependency file the issue did not list still refuses the commit

#### Scenario: The agent already took the failure path
- **WHEN** the issue is no longer `building` or `ready` because the run recorded its outcome
- **THEN** the always-running step does nothing

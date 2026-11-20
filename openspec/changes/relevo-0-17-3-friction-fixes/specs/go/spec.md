## ADDED Requirements

### Requirement: A refused checkpoint after earlier checkpoints is reported as a partial push
When a checkpoint is refused by the commit guard (a path outside the platform, a protected path, a restricted file, a temporary marker or a possible credential) and checkpoints of the same run are already on the remote branch, the `build_failed` comment SHALL say that the groups already pushed are on the branch and that the refused group is not, SHALL give the refused path and the reason, SHALL give the line `Allow-paths: <path>` when an `Allow-paths:` line of the issue would allow that path, and SHALL recommend `/relevo:fix <issue>`. It SHALL NOT say that nothing was pushed and SHALL NOT recommend `/relevo:go <issue> --retry`. When no checkpoint was pushed before the refusal, the comment SHALL stay as it is. The push of each checkpoint SHALL NOT change. The files of the refused group stay uncommitted in the worktree of the run.

#### Scenario: Group 4 of 4 refused after three pushed
- **WHEN** checkpoints 1 to 3 were pushed and checkpoint 4 is refused because `docs/x.md` is outside the platform
- **THEN** the comment names groups 1 to 3 as pushed and 4 as not, names `docs/x.md` with `Allow-paths: docs/x.md`, and recommends `/relevo:fix <issue>` in English and in Spanish

#### Scenario: The first checkpoint is refused
- **WHEN** the first checkpoint is refused and nothing was pushed
- **THEN** the comment says the branch was not pushed and recommends building again, as before

#### Scenario: A refusal that no Allow-paths line can fix
- **WHEN** the refusal is for a restricted file or a possible credential
- **THEN** the comment names the path and the reason, gives no `Allow-paths:` line and still recommends `/relevo:fix <issue>` for the pushed groups

### Requirement: A refused retry on a branch with checkpoints says to use fix
When the planner refuses a retry because a branch `feature/<n>-*` exists on the remote and that branch holds code (checkpoints or the finished work), the message SHALL say that the branch holds code, SHALL send the person to `/relevo:fix <n>` and SHALL say that `fix` does not need a description of the defect when the branch ends at a commit that `go` made for a build that did not finish. The message for a branch that holds only the specification, and the one for a branch that cannot be read, SHALL NOT change.

#### Scenario: The branch holds checkpoints
- **WHEN** a retry is requested for `build-failed` issue 20 and `origin/feature/20-...` differs from the base outside the change folder
- **THEN** the message says the branch holds code, sends the person to `/relevo:fix 20` and says no defect description is needed after an interrupted build, and the branch is untouched

#### Scenario: The branch cannot be read
- **WHEN** the content of the branch cannot be read
- **THEN** the message is the one for a branch that is corrected, and nothing is deleted

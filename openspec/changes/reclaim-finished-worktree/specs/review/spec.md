# Spec Delta

## ADDED Requirements

### Requirement: A held branch says whether its worktree can be removed
When another worktree holds the branch of the issue, `review` SHALL say whether that worktree can be removed. It can be removed when its tree is clean (no change and no untracked file) and every commit of its branch is on the remote branch. `review` SHALL name what prevents the removal when it cannot be done. When it can, `review` SHALL give the command, ask the person, and only on a yes remove the worktree with `git worktree remove` without `--force` and go on from the start of the step. `review` SHALL NOT remove a worktree that the person has not agreed to remove, the main working tree, or the working tree it runs in.

#### Scenario: A finished worktree that holds nothing that is not on the remote
- **WHEN** the worktree that holds the branch is clean and its `HEAD` is on `origin/<branch>`
- **THEN** `review` says it holds nothing that is not on the remote, gives `git worktree remove "<path>"` and asks before it removes it, leaving the issue `built` until then

#### Scenario: The person agrees
- **WHEN** the person answers yes
- **THEN** `review` removes the worktree without `--force` and goes on to switch to the branch

#### Scenario: The worktree has something of its own
- **WHEN** the worktree has an uncommitted change, an untracked file or a commit that is not on the remote
- **THEN** `review` names it, removes nothing, changes no file, label or comment, and says the person can review there or save that work first

#### Scenario: The branch holds only the specification
- **WHEN** the branch differs from the base branch only inside the change folder
- **THEN** `review` says there is nothing to review in it and that the way out is to delete the remote branch and build the issue again

#### Scenario: The output the skill already read
- **WHEN** the check runs
- **THEN** it still exits 1 and prints the path of the holder on its own line, and exits 0 when the branch is free or held only by the working tree it runs in

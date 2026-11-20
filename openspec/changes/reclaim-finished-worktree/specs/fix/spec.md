# Spec Delta

## ADDED Requirements

### Requirement: A held branch says whether its worktree can be removed
When another worktree holds the branch of the issue, `fix` SHALL say whether that worktree can be removed, on the same terms as `review`: its tree is clean and every commit of its branch is on the remote branch. When it can, `fix` SHALL give the command, ask the person, and only on a yes remove it with `git worktree remove` without `--force` and go on from the start of the step. When it cannot, `fix` SHALL name what prevents it and change nothing. A branch that holds only the specification SHALL be said to hold nothing to correct.

#### Scenario: A finished worktree that holds nothing that is not on the remote
- **WHEN** the worktree that holds the branch is clean and its `HEAD` is on `origin/<branch>`
- **THEN** `fix` says so, gives `git worktree remove "<path>"`, asks, and changes no file or label until the person answers

#### Scenario: The worktree has unsaved work
- **WHEN** the worktree has an uncommitted change or a commit that is not on the remote
- **THEN** `fix` names it and removes nothing

#### Scenario: Only the specification
- **WHEN** the branch differs from the base branch only inside the change folder
- **THEN** `fix` says there is no code to correct and that the way out is to delete the remote branch and build the issue again

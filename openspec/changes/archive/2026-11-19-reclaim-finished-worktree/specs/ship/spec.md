# Spec Delta

## ADDED Requirements

### Requirement: A held branch says whether its worktree can be removed
When another worktree holds the branch of the issue, `ship` SHALL say whether that worktree can be removed, on the same terms as `review`: its tree is clean and every commit of its branch is on the remote branch. When it can, `ship` SHALL give the command, ask the person, and only on a yes remove it with `git worktree remove` without `--force` and go on. When it cannot, `ship` SHALL name what prevents it. Until the person answers, and whenever it cannot be removed, nothing SHALL be archived, pushed or merged.

#### Scenario: A finished worktree that holds nothing that is not on the remote
- **WHEN** the worktree that holds the branch is clean and its `HEAD` is on `origin/<branch>`
- **THEN** `ship` says so, gives `git worktree remove "<path>"`, asks, and archives, pushes and merges nothing until the person answers

#### Scenario: The worktree has unsaved work
- **WHEN** the worktree has an uncommitted change or a commit that is not on the remote
- **THEN** `ship` names it, removes nothing, and archives, pushes and merges nothing

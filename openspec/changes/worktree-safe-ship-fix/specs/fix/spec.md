## ADDED Requirements

### Requirement: A branch held by another worktree stops fix before it changes anything
Before it switches to the branch of the issue, `fix` SHALL check whether another worktree holds that branch. If one does, `fix` SHALL stop without changing any file or label, and SHALL name the worktree and its path and how to continue, instead of showing the error of git.

#### Scenario: A failed go left its worktree
- **WHEN** `fix` runs for an issue whose branch is checked out in a worktree that a failed `go` kept
- **THEN** `fix` stops, says that the branch is held by that worktree and gives its path, and nothing is changed

#### Scenario: Fix in a worktree of its own
- **WHEN** the person runs `fix` in a worktree where the branch of the issue is free
- **THEN** `fix` switches to the branch there and goes on as in the main checkout

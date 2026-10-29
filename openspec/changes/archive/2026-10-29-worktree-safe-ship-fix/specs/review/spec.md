## ADDED Requirements

### Requirement: A branch held by another worktree stops review before it changes anything
Before it switches to the branch of the issue, `review` SHALL check whether another worktree holds that branch. If one does, `review` SHALL stop with the issue left as `built`, without changing any file, label or comment, and SHALL name the worktree and its path and how to continue, instead of showing the error of git.

#### Scenario: A failed go left its worktree
- **WHEN** `review` runs for an issue whose branch is checked out in a worktree that a failed `go` kept
- **THEN** `review` stops, says that the branch is held by that worktree and gives its path, and the issue stays `built`

#### Scenario: Review in a worktree of its own
- **WHEN** the person runs `review` in a worktree where the branch of the issue is free
- **THEN** `review` switches to the branch there and goes on as in the main checkout

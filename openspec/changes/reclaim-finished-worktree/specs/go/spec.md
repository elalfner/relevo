# Spec Delta

## ADDED Requirements

### Requirement: A hand-off leaves the branch free in a worktree that go did not create
When a run of `go` that builds in a worktree it did not create (it builds where it is, for example in a worktree of the Claude app) ends in a hand-off, it SHALL leave that worktree on the commit of the hand-off with no branch checked out, so that the branch can be checked out by `review` elsewhere. A worktree that `go` created SHALL still be removed at the end of a hand-off. A run that ends in a failure SHALL keep the branch checked out where its work is.

#### Scenario: Built in a worktree of the app
- **WHEN** a run ends in a hand-off and the worktree it ran in was not created by `go`
- **THEN** the worktree is detached at the commit that was pushed and `git switch <branch>` works in another worktree

#### Scenario: Built in a worktree of its own
- **WHEN** a run ends in a hand-off and the worktree was created by `go`
- **THEN** the worktree is removed as before

#### Scenario: The run failed
- **WHEN** the run ends in a failure
- **THEN** the branch stays checked out in the worktree of the run

## ADDED Requirements

### Requirement: The local tidy after a merge follows the working tree
After the merge, `ship` SHALL switch to the base branch, bring it up to date and delete the local branch only when it runs in the main checkout and no other worktree holds the base branch. Otherwise it SHALL change nothing locally and say which branch the working tree stays on. A failure of the tidy SHALL NOT change the outcome of the ship, because the pull request is already merged.

#### Scenario: Ship in the main checkout
- **WHEN** the pull request is merged and `ship` runs in the main checkout with no other worktree holding the base branch
- **THEN** the checkout is switched to the base branch, brought up to date, and the local feature branch is deleted

#### Scenario: Ship in a worktree
- **WHEN** the pull request is merged and `ship` runs in a linked worktree, or the base branch is checked out in another worktree
- **THEN** `ship` does not switch, does not delete the branch the working tree is on, says which branch it stays on, and the report says the issue is closed and the labels removed as usual

#### Scenario: The tidy fails
- **WHEN** a command of the tidy fails after the merge
- **THEN** the failure is reported as a note, the merge, the closed issue and the removed labels are not undone, and the ship is not reported as failed

### Requirement: A branch held by another worktree stops ship before it changes anything
Before it switches to the branch of the issue, `ship` SHALL check whether another worktree holds that branch. If one does, `ship` SHALL stop without archiving, pushing or merging, and SHALL name the worktree and its path and how to continue, instead of showing the error of git.

#### Scenario: A failed go left its worktree
- **WHEN** `ship` runs for an issue whose branch is checked out in a worktree that a failed `go` kept
- **THEN** `ship` stops, says that the branch is held by that worktree and gives its path, and nothing is archived, pushed or merged

#### Scenario: The branch is free
- **WHEN** no other worktree holds the branch, or only the working tree `ship` runs in does
- **THEN** `ship` goes on as before

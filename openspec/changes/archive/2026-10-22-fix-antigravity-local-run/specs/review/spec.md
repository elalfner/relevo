## MODIFIED Requirements

### Requirement: Review restores the base branch upon completion
When `review` opens the pull request and cleans up evidence, it SHALL switch the repository working tree back to the base branch only when it runs in the main checkout and the base branch is not checked out in another worktree. Otherwise it SHALL leave the branch as it is and say so. A failure to switch SHALL NOT change the verdict or the state of the issue.

#### Scenario: Pull request opened successfully
- **WHEN** the pull request is created at the conclusion of a review in the main checkout
- **THEN** `review` switches the repository working tree back to the base branch

#### Scenario: Review runs in a separate worktree
- **WHEN** the pull request is created and the review runs in a worktree, or the base branch is checked out elsewhere
- **THEN** `review` does not switch branches, tells the person which branch the worktree stays on, and the report is unchanged

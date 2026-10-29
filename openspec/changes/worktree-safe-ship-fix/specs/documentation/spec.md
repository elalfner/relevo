## ADDED Requirements

### Requirement: The execution page says how to start worktrees from the base branch
The page on where `go` runs SHALL say, in English and Spanish, that the Worktree button of Claude Code branches from the remote's default branch and cannot be given a branch name, and SHALL give, as an optional recipe, a `WorktreeCreate` hook that fetches `origin/<base>` and creates the worktree from it. It SHALL say that the hook replaces the default creation, so that `.worktreeinclude` and the branch prefix of the app no longer apply, and that `/relevo:init` does not install it.

#### Scenario: Work happens on a base branch that is not the default
- **WHEN** a person whose default branch is `main` and base branch is `dev` reads the page
- **THEN** it says that the button starts from `main`, shows the hook that starts from `dev`, and says what the hook gives up

#### Scenario: Not described as part of Relevo
- **WHEN** a person reads the recipe
- **THEN** it says that it is optional, that Relevo does not install it, and that `go` builds from `origin/<branches.base>` with or without it

### Requirement: The execution page says review, ship and fix can run in a worktree
The page SHALL say, in English and Spanish, that `review`, `ship` and `fix` also run in a worktree the person opened, that a branch held by another worktree stops them with a message that names it, and that a runner registered under the user of the person shares its home with that user's interactive sessions.

#### Scenario: A person runs review from the Worktree button
- **WHEN** a person reads the page before running `review` or `ship` in a worktree
- **THEN** it says that the local tidy of `review` and `ship` is skipped there and that the worktree stays on its branch

#### Scenario: A runner under the person's own user
- **WHEN** a person reads the page before registering a runner under their own user
- **THEN** it says that the runner shares `~/.claude` with their interactive sessions

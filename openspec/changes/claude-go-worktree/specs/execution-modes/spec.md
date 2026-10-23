## MODIFIED Requirements

### Requirement: A local run can be started from the go command
`/relevo:go <issue> --local` SHALL run `go-local.mjs` for the issue and stop, instead of building in the interactive session, so that the build runs in its own process with the closed tool lists of the workflow, which an interactive session does not have.

#### Scenario: Local flag
- **WHEN** the person runs `/relevo:go 42 --local`
- **THEN** the skill runs `go-local.mjs 42`, shows its output and does not build in the session

### Requirement: A local run has its own working tree
`go-local.mjs`, interactive Antigravity local builds and interactive Claude Code builds SHALL run in a separate working tree outside the repository's main working tree, so that the person's uncommitted changes and concurrent sessions do not stop it or collide, SHALL remove the worktree when the run ends cleanly and SHALL keep it, printing its path, otherwise.

#### Scenario: Uncommitted changes in the repository
- **WHEN** the working tree of the repository has uncommitted changes
- **THEN** the local run is not affected, because it works in its own worktree

#### Scenario: Run fails
- **WHEN** the local run ends with an error
- **THEN** the worktree stays for inspection and its path is printed

#### Scenario: Cloud can also build it
- **WHEN** the go workflow is installed, a credential exists and the variable is not `off`
- **THEN** the command warns that the cloud may start the same issue and suggests setting `RELEVO_CLOUD_GO` to `off`

## ADDED Requirements

### Requirement: An interactive Claude Code run builds in its own worktree
When `/relevo:go <issue>` runs in a Claude Code session without `--local` and without `--decision`, and the session is not already in a linked worktree, the skill SHALL create a worktree for the issue from `origin/<base>`, enter it before the preflight and do every later step there. It SHALL NOT switch branches or commit in the main working tree.

#### Scenario: Two issues at once
- **WHEN** the person runs `/relevo:go 1` in one session and `/relevo:go 2` in another
- **THEN** each builds in its own worktree and neither changes the branch or the OpenSpec files of the other or of the main working tree

#### Scenario: Uncommitted changes in the main working tree
- **WHEN** the main working tree has uncommitted changes and the person runs `/relevo:go 42`
- **THEN** the preflight passes in the worktree and the changes of the main working tree are untouched

#### Scenario: The same issue twice
- **WHEN** the worktree of the issue already exists
- **THEN** the run stops before any change and names the worktree and the command that removes it

#### Scenario: No worktree where one exists or is not needed
- **WHEN** `go` runs with `--decision`, or inside the worktree that `go-local.mjs` made, or in any linked worktree
- **THEN** no further worktree is created and the build runs where it is

#### Scenario: Clean end and failure
- **WHEN** the issue ends `built`, or a gate decision stops the run before anything is built
- **THEN** the session returns to the original folder and the worktree is removed
- **WHEN** the run ends on the failure path or stops for any other reason
- **THEN** the session returns to the original folder, the worktree is kept and its path is printed

#### Scenario: Review stays in the main working tree
- **WHEN** the person runs `/relevo:review` for the issue
- **THEN** it runs in the main working tree, as before

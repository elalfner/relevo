# Spec Delta

## Purpose

Lets one person run Relevo on a local git repository with no remote: an issue is a file, its lifecycle state lives on the machine, and the commands behave as they do on GitHub for a one-person project.

## ADDED Requirements

### Requirement: An issue is a file with the sections of an issue
With `tracker: files`, an issue SHALL be one markdown file `.relevo/issues/<n>.md` whose title is its first heading and whose sections are those of `docs/issue-format.md`. The same checks that validate a GitHub issue (scenarios, edge cases, vague words, dependencies) SHALL run on it before it can be approved.

#### Scenario: Complete issue
- **WHEN** `.relevo/issues/3.md` has scenarios as WHEN/THEN pairs, edge cases and the other required sections
- **THEN** the check passes and the issue can be approved

#### Scenario: Incomplete issue
- **WHEN** the file has a WHEN with no THEN
- **THEN** the check fails with the same message a GitHub issue gets, and the issue cannot be approved

### Requirement: Numbers are sequential and never reused
A new issue SHALL take the number after the highest one that exists as a file or as a state record, so that the number of an issue that was built and archived is never given to another.

#### Scenario: Next number
- **WHEN** issues 1, 2 and 4 exist
- **THEN** the next issue is 5

#### Scenario: Archived issue
- **WHEN** issue 7 was shipped and its file removed from the working tree
- **THEN** the next issue is still 8

### Requirement: The state is kept outside the tracked files
The lifecycle state of an issue (`ready`, `building`, `built`, `in-review`, `build-failed` and the others of `issue-lifecycle`), its comments and its approval hash SHALL be kept in a folder inside the git directory of the repository, shared by every worktree of it and never committed. A change of state SHALL NOT create a commit or modify a tracked file.

#### Scenario: State change
- **WHEN** an issue moves from `ready` to `building`
- **THEN** only the state record changes and `git status` shows nothing new

#### Scenario: Build in a worktree
- **WHEN** a build runs in a separate worktree of the repository
- **THEN** it reads and writes the same state records as the main working tree

### Requirement: The issue file is committed once, when it is written
`/relevo:issue` SHALL commit the issue file to the base branch after the person approves the draft, so that a build in a worktree created from that branch contains it, and SHALL commit nothing else.

#### Scenario: Approved draft
- **WHEN** the person approves a draft in a project with `tracker: files`
- **THEN** one commit on the base branch adds `.relevo/issues/<n>.md` and the issue has no state yet

#### Scenario: Draft not approved
- **WHEN** the person does not approve
- **THEN** no file is written and no commit is made

### Requirement: Approval is the person's, and the approved text is what is built
Applying `ready` SHALL store the hash of the issue text. Before a build starts the text SHALL be hashed again, and a different hash SHALL stop the build as the GitHub gate does for an issue edited after approval, with the reason `issue changed after ready`.

#### Scenario: Unchanged
- **WHEN** the file is as it was when `ready` was applied
- **THEN** the build may start

#### Scenario: Edited after approval
- **WHEN** the file was edited after `ready`
- **THEN** the build does not start, the issue keeps its state and the person is told to approve it again

### Requirement: There are no roles, assignees, milestones or queue
In a `files` project the one person SHALL be the author, the approver, the builder and the merger. Assignee, milestone, review capacity, the build queue and the GitHub permission checks SHALL NOT apply and SHALL NOT block a command.

#### Scenario: Build without an assignee
- **WHEN** an approved issue has no assignee and no milestone
- **THEN** `go` builds it

### Requirement: Dependencies are other issue files
A `Depends-on: #N` line SHALL refer to another issue of the project, and the issue SHALL NOT start until the issue it names has been shipped. A reference to another repository SHALL be rejected as unsupported.

#### Scenario: Dependency not shipped
- **WHEN** issue 5 depends on `#4` and 4 is `built` but not shipped
- **THEN** 5 does not start and the message names 4

#### Scenario: Other repository
- **WHEN** an issue says `Depends-on: owner/repo#2`
- **THEN** the check rejects it and says that a `files` project cannot depend on another repository

### Requirement: A file tracker needs no remote
No command of a `files` project SHALL require a git remote, the GitHub command line or network access to the tracker. A push that cannot happen because there is no remote SHALL be recorded as the existing `not_pushed` state and SHALL NOT fail the command.

#### Scenario: No remote
- **WHEN** `go` makes its checkpoint commits in a repository with no remote
- **THEN** the commits are kept locally, the state is `not_pushed` and the build goes on

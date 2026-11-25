# Spec Delta

## Purpose

Defines how a built issue is reviewed and delivered in a project with no pull request: the review is of the branch diff and the delivery is a confirmed local merge into the base branch.

## ADDED Requirements

### Requirement: A review of a branch needs no pull request
With `tracker: files`, `/relevo:review <n>` SHALL review the branch of the issue against the base branch, with the same checks and the same guard against patching code during the review, and SHALL record its result in the state of the issue. It SHALL NOT open a pull request or pick a reviewer.

#### Scenario: Review passes
- **WHEN** the person finishes the review of a `built` issue with every step passed
- **THEN** the issue moves to `in-review` complete, the result is recorded and no pull request exists

#### Scenario: Review finds a defect
- **WHEN** a step fails
- **THEN** the review records the failure, patches nothing and points to `/relevo:fix <n>`

### Requirement: Ship is a local merge the person confirms
`/relevo:ship <n>` SHALL, after a written yes, archive the OpenSpec change of the issue on its branch, merge the branch into the base branch with one squash commit, delete the branch, close the issue (its Relevo state is cleared and its record marked closed; its file is left in place, because a change of state makes no commit) and remove its worktree when git allows it. Without the yes nothing SHALL be archived or merged.

#### Scenario: Confirmed
- **WHEN** the person confirms the ship of a reviewed issue
- **THEN** the base branch gains one commit, the branch is deleted and the issue has no Relevo state

#### Scenario: Not confirmed
- **WHEN** the person does not confirm
- **THEN** no archive, merge or deletion happens

### Requirement: Ship refuses what a pull request would have refused
Ship SHALL stop, changing nothing, when the branch does not merge cleanly into the base branch, when the validation gate has not passed on the commit that would be merged, or when the issue was not reviewed. Each reason SHALL be shown.

#### Scenario: Conflict with the base
- **WHEN** the base branch moved and the merge would conflict
- **THEN** ship stops, lists the files and changes nothing

#### Scenario: Gate not passed
- **WHEN** the branch has commits after the last passing gate
- **THEN** ship stops and says the gate must run again

### Requirement: Ship is the only command that touches the base branch
Of the commands of a `files` project, only `/relevo:issue` (to add an issue file) and `/relevo:ship` SHALL commit to the base branch. A build and a fix SHALL work on the branch of the issue.

#### Scenario: Build
- **WHEN** `go` builds an issue
- **THEN** every commit it makes is on the branch of the issue

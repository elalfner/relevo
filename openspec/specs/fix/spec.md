# fix Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Specification first
`fix` SHALL update the change's specification, design and task list to describe the corrected behaviour before any code is written, and the main session SHALL NOT edit application code.

#### Scenario: New feedback
- **WHEN** the person describes a defect
- **THEN** a scenario describing the correct behaviour is added to the specification and a corrections section with unchecked tasks is appended to the task list, before the developer agent runs

### Requirement: Specification first is checked, not trusted
Before the developer agent runs, `fix` SHALL verify that the working tree contains a new or corrected scenario and at least one new unchecked correction task, and that nothing outside the change folder was edited. The fix SHALL NOT be committed before QA passes.

#### Scenario: Code edited before the specification
- **WHEN** a file outside the change folder was modified before the specification and tasks were updated
- **THEN** the check fails, names the file, and the developer agent does not run

#### Scenario: Nothing to correct yet
- **WHEN** the issue has no branch with work to correct, or is in a state before `built`
- **THEN** `fix` stops and says why, without changing anything

### Requirement: Rules are not rewritten to fit
If the reported defect is actually a violation of a project rule, `fix` SHALL say so and SHALL NOT change the rule.

#### Scenario: Rule violation
- **WHEN** the defect is a breach of a rule in `qa.rules_from`
- **THEN** the fix restores compliance with the rule

### Requirement: Developer and QA with one retry
`fix` SHALL delegate to the developer agent only the new tasks, then run QA on the iteration's diff against the new scenarios, with `qa.retries` retries.

#### Scenario: Rejected twice
- **WHEN** QA still rejects after the retries
- **THEN** no commit or push is made, the changes are kept in the working tree, the issue's labels do not change, and the person is told the findings

### Requirement: State is preserved
After a successful fix the issue SHALL keep its current state (`in-review`, `qa-failed` returns to `built`, or `changes-requested` returns to `pr-open`), and a comment SHALL summarise the change, the QA verdict and the commit.

#### Scenario: Fix after qa-failed
- **WHEN** a fix on a `qa-failed` issue passes QA
- **THEN** the issue becomes `built` and the assignee is notified

#### Scenario: Fix after requested changes
- **WHEN** a fix addresses requested changes on an open pull request
- **THEN** the issue returns to `pr-open` and the reviewer is re-requested

### Requirement: Safe commit
`fix` SHALL stage files explicitly and run the same temporary-marker and credential scan as the build.

#### Scenario: Marker found
- **WHEN** the staged diff contains a temporary marker
- **THEN** the commit is aborted

### Requirement: Fix uses the platform of the issue
`fix` SHALL resolve the platform of the issue again from its text, resolve the profile and the role skills for it, and give them to `relevo:dev`, the gate and the lenses with the folder of the platform. When the platform cannot be resolved it SHALL stop before changing anything and say why.

#### Scenario: Monorepo fix
- **WHEN** `fix` runs on an issue for `api`
- **THEN** the agents receive the profile of the stack of `api` and its folder

#### Scenario: Platform not resolvable
- **WHEN** the issue no longer names a valid platform in a repository with several
- **THEN** `fix` changes nothing and tells the person to correct the `Platform:` line

### Requirement: Unfinished work is saved, not left in the tree
When QA still rejects after the retries, `fix` SHALL save the working tree in a stash named `relevo-fix #<issue> iteration <k>`, leave the tree clean and the labels unchanged, and say how to resume. A stash of the issue SHALL be offered back on the next start. Discarding it SHALL need written confirmation.

#### Scenario: QA rejects after the retries
- **WHEN** QA still rejects after the retries on issue 42, iteration 2
- **THEN** the changes are saved in a stash named "relevo-fix #42 iteration 2", the working tree is clean, the labels are unchanged and the findings are shown

#### Scenario: Resuming
- **WHEN** `fix` starts on issue 42 and a stash named for issue 42 exists
- **THEN** it offers to restore it, and restores it and goes on from the developer step only after the person agrees

#### Scenario: Restore conflicts
- **WHEN** restoring the stash conflicts with the branch
- **THEN** `fix` stops, keeps the stash and explains which files conflict

#### Scenario: Start from scratch
- **WHEN** the person wants to discard the stash
- **THEN** it is dropped only after their written confirmation

### Requirement: A branch without implementation is not corrected
`fix` SHALL tell a branch whose only differences from the base branch are inside the change folder from one that holds implementation, and for the first SHALL stop and say to delete the remote branch and label the issue `ready` again.

#### Scenario: Branch with only the specification
- **WHEN** every file that differs from the base branch is under `openspec/changes/<change>/`
- **THEN** `fix` changes nothing and tells the person to delete the remote branch and apply `relevo:ready` again

#### Scenario: Branch with code
- **WHEN** a file outside the change folder differs from the base branch
- **THEN** `fix` goes on

### Requirement: The task list is checked around a fix
Before the developer runs, the only unchecked tasks in `tasks.md` SHALL be those of the correction section just added. After QA passes, no task SHALL be unchecked. The section SHALL include a task for a regression test, unless every correction is marked as visible only on a device.

#### Scenario: An old task is still open
- **WHEN** a task of the original build is unchecked before the developer runs
- **THEN** the check fails and names the task

#### Scenario: A correction is left open
- **WHEN** QA passes but a correction task is unchecked
- **THEN** `fix` does not commit and names the task

#### Scenario: No regression test
- **WHEN** the correction section has no test task and no correction is marked as device-only
- **THEN** the specification-first check fails and says a regression test is missing

#### Scenario: Device-only correction
- **WHEN** a correction task is marked "(device only)" because the defect shows only on a device
- **THEN** no test task is required for it

### Requirement: Kept work is corrected from the failure comment
When the last commit of the branch is the work-in-progress commit that `go` makes after a rejection, `fix` SHALL take the finding of the last failure comment of the issue as the defect, tell the person what QA found and what it could not check, and ask only what that finding leaves open.

#### Scenario: QA could not run the tests
- **WHEN** the last failure comment says the analysis and the tests could not run and the branch holds the work in progress
- **THEN** `fix` runs them, corrects what they find and does not ask the person to describe a defect

#### Scenario: A branch without the work-in-progress commit
- **WHEN** the last commit of the branch is not that commit
- **THEN** `fix` behaves as before and asks the person what is wrong

### Requirement: A branch held by another worktree stops fix before it changes anything
Before it switches to the branch of the issue, `fix` SHALL check whether another worktree holds that branch. If one does, `fix` SHALL stop without changing any file or label, and SHALL name the worktree and its path and how to continue, instead of showing the error of git.

#### Scenario: A failed go left its worktree
- **WHEN** `fix` runs for an issue whose branch is checked out in a worktree that a failed `go` kept
- **THEN** `fix` stops, says that the branch is held by that worktree and gives its path, and nothing is changed

#### Scenario: Fix in a worktree of its own
- **WHEN** the person runs `fix` in a worktree where the branch of the issue is free
- **THEN** `fix` switches to the branch there and goes on as in the main checkout

### Requirement: Fix runs the gate and the lenses on the iteration's diff
After the developer agent has done the correction tasks, `fix` SHALL run the validation gate and the active lenses on the iteration's diff against the new scenarios, with `qa.retries` retries, as `go` does, and SHALL use the same aggregation.

#### Scenario: A correction that breaks a test
- **WHEN** the gate is red after the correction
- **THEN** no lens runs and the developer agent receives the output of the gate

#### Scenario: A correction that passes
- **WHEN** the gate is green and no blocking lens rejects
- **THEN** `fix` goes on as it does after a passed QA

### Requirement: The change folder is given as a name or as a path
The check for a branch without implementation SHALL accept the change as the name of its folder (`31-summary`) or as its path (`openspec/changes/31-summary`, with or without a trailing slash), and SHALL ignore every file under that folder, whatever its name, when it decides whether the branch holds implementation. A value that is empty or does not name a folder of the change SHALL be refused as a usage error and SHALL NOT be answered as if the branch had code.

#### Scenario: Every file of the change, given by name
- **WHEN** the only files that differ from the base branch are `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md` and files under `specs/` of `openspec/changes/31-summary/`, and the change is given as `31-summary`
- **THEN** the check says the branch holds only the specification, and `fix` stops before it changes anything

#### Scenario: The same files, given by path
- **WHEN** the same branch is checked with the change given as `openspec/changes/31-summary` or `openspec/changes/31-summary/`
- **THEN** the answer is the same: only the specification

#### Scenario: Code beside the specification
- **WHEN** a file outside the change folder also differs from the base branch
- **THEN** the check says the branch holds implementation and lists only the files outside the change folder

#### Scenario: A value that names no folder
- **WHEN** the change is given as an empty value or as a path that does not end in a folder of `openspec/changes/`
- **THEN** the check exits with the usage error and prints no verdict

### Requirement: A held branch says whether its worktree can be removed
When another worktree holds the branch of the issue, `fix` SHALL say whether that worktree can be removed, on the same terms as `review`: its tree is clean and every commit of its branch is on the remote branch. When it can, `fix` SHALL give the command, ask the person, and only on a yes remove it with `git worktree remove` without `--force` and go on from the start of the step. When it cannot, `fix` SHALL name what prevents it and change nothing. A branch that holds only the specification SHALL be said to hold nothing to correct.

#### Scenario: A finished worktree that holds nothing that is not on the remote
- **WHEN** the worktree that holds the branch is clean and its `HEAD` is on `origin/<branch>`
- **THEN** `fix` says so, gives `git worktree remove "<path>"`, asks, and changes no file or label until the person answers

#### Scenario: The worktree has unsaved work
- **WHEN** the worktree has an uncommitted change or a commit that is not on the remote
- **THEN** `fix` names it and removes nothing

#### Scenario: Only the specification
- **WHEN** the branch differs from the base branch only inside the change folder
- **THEN** `fix` says there is no code to correct and that the way out is to delete the remote branch and build the issue again

### Requirement: Saving unfinished work tolerates files marked for the diff
When `fix` saves the working tree in a stash and some new files are marked with intent-to-add (the mark that makes them visible to the diff without staging their content), saving SHALL succeed. It SHALL remove the mark from those files only, so the stash holds their content as untracked files and restoring it gives the files back. A file whose content is really staged SHALL NOT be touched by that step.

#### Scenario: A new file marked for the diff
- **WHEN** a new file is marked with intent-to-add and `fix-stash.mjs save` runs for issue 42, iteration 2
- **THEN** it exits 0, the stash is named "relevo-fix #42 iteration 2" and the working tree is clean

#### Scenario: Restoring brings the file back
- **WHEN** that stash is restored
- **THEN** the new file exists again with its content

#### Scenario: A file really staged
- **WHEN** a file with staged content is in the tree when `save` runs
- **THEN** that step does not unstage it

### Requirement: A build interrupted at a checkpoint is closed without a description of the defect
When the last commit of the branch is the checkpoint of a build that did not finish (`wip: checkpoint <k>/<n>`), the failure-comment lookup SHALL report the work as kept, so that `fix` treats the tasks still open as what is left and does not ask the person to describe a defect.

#### Scenario: The last commit is a checkpoint
- **WHEN** the subject of the last commit is `wip: checkpoint 3/4 (#20)` and the issue has a failure comment
- **THEN** the lookup reports `kept` and `fix` does not ask what is wrong

#### Scenario: The last commit is a person's commit
- **WHEN** the last commit is not a commit that `go` made
- **THEN** the lookup does not report `kept`

## ADDED Requirements

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

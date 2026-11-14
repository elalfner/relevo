# Spec Delta

## ADDED Requirements

### Requirement: The work kept at a limit names the tasks it holds
The commit `wip: stopped by limit (#N)` SHALL name, in a `Relevo-Tasks:` trailer, the tasks that are checked in the `tasks.md` of the change and that no earlier commit of the branch over the base names. With none, or when that file cannot be read, it SHALL carry no trailer. A lookup of the template by section SHALL also find such a commit.

#### Scenario: A task finished after the last checkpoint
- **WHEN** a run is cut after the checkpoint of tasks 1.1 and 1.2 with the task 2.1 checked and not committed
- **THEN** the commit `wip: stopped by limit (#N)` carries `Relevo-Tasks: 2.1`

#### Scenario: A task that a commit already names
- **WHEN** the checked tasks are 1.1, 1.2 and 2.1 and a checkpoint already names 1.1 and 1.2
- **THEN** the trailer names only 2.1

#### Scenario: No task was finished
- **WHEN** no task is checked beyond those that earlier commits name
- **THEN** the commit is made as before, with no trailer

#### Scenario: The task list cannot be read
- **WHEN** the `tasks.md` of the change is missing or unreadable
- **THEN** the commit is made as before and the rescue does not fail

#### Scenario: The template was in the work that was kept
- **WHEN** a run is cut during the template group, which is in the limit commit with its tasks named
- **THEN** the lookup of the template by that section finds it in that commit

#### Scenario: The checkpoints and the QA rejection do not change
- **WHEN** a checkpoint is made, or the work is kept after a QA rejection
- **THEN** their commits are made as before

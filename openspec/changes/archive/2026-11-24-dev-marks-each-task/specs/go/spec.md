# Spec Delta

## ADDED Requirements

### Requirement: The developer marks each task when it finishes it
The developer agent SHALL mark a task `[x]` in `tasks.md` as soon as the code of that task exists and its own checks pass, with one edit per task and before it starts the next, and SHALL NOT leave the marks for the end of its launch. A task whose content is the full test run SHALL be marked when that run passes. The checkbox SHALL remain the only edit the developer makes to the files of the change, in every mode. A task that cannot be finished SHALL stay unchecked, and the report SHALL say why.

#### Scenario: A task finishes in the middle of a launch
- **WHEN** the developer finishes task 1.1 of a group of three
- **THEN** task 1.1 is `[x]` in the working tree before the developer starts task 1.2

#### Scenario: The progress rises inside one group
- **WHEN** a build of three tasks, which is one group, is in development and the developer finishes the first task
- **THEN** the progress shows one task done out of three while the launch is still running, and not `0 of 3` until the launch ends

#### Scenario: A task that cannot be finished
- **WHEN** the developer cannot finish a task
- **THEN** its box stays unchecked and the report says why, as before

#### Scenario: A correction in fix mode
- **WHEN** the developer corrects the findings of QA, which are tasks added to `tasks.md`
- **THEN** each correction is marked when it is corrected, by the same rule

### Requirement: A mark is never taken back
The developer agent SHALL NOT remove a `[x]` mark it or an earlier launch made. When it finds that a task it marked earlier is wrong, it SHALL correct the code and leave the box checked, and the QA lenses remain who judge whether the work is right.

#### Scenario: An earlier task turns out wrong
- **WHEN** the developer, building task 1.3, finds that task 1.2 was wrong
- **THEN** it corrects the code of task 1.2 and task 1.2 stays `[x]`

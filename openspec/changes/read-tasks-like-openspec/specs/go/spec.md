# Spec Delta

## ADDED Requirements

### Requirement: The tasks are counted as OpenSpec counts them
Every script of Relevo that reads the boxes of `tasks.md` SHALL decide which lines are tracked tasks and which are done with one shared rule, the one OpenSpec states: a box holding only `x`, in either case and with any spacing, is done; any other marker (`~`, `-`, an empty box) is unfinished and counts in the total; a line with no box is not a task. The total and the done count of Relevo SHALL equal the ones OpenSpec reports for the same file.

#### Scenario: A box with spacing
- **WHEN** a task line is `- [ x] 1.1 ...`
- **THEN** it counts as done and as part of the total

#### Scenario: An unfinished marker
- **WHEN** a task line is `- [~] 1.2 ...` or `- [] 1.3 ...`
- **THEN** it counts in the total, is not done and is listed among the tasks still open

#### Scenario: A line with no box
- **WHEN** a line of `tasks.md` has no box, such as a plain bullet of a follow-up section
- **THEN** it is not a task and counts nowhere

#### Scenario: Relevo and OpenSpec agree
- **WHEN** the same `tasks.md` is read by Relevo and by `openspec instructions apply`
- **THEN** both give the same total and the same number of tasks done

### Requirement: A build stops on a schema it does not understand
Before the developer agent starts, `go` SHALL read the schema of the change and whether task tracking is configured from the apply instructions of OpenSpec. When the schema is not `spec-driven`, or the tasks are not tracked, the run SHALL end in `build-failed` with the reason `schema`, which names the schema found and says to use `spec-driven`, and no developer agent SHALL start. The message SHALL exist in English and Spanish.

#### Scenario: Another schema
- **WHEN** the apply instructions report a schema other than `spec-driven`
- **THEN** the run ends in `build-failed` with the reason `schema` naming that schema, and no agent starts

#### Scenario: Tasks not tracked
- **WHEN** the apply instructions report that task tracking is not configured
- **THEN** the run ends in `build-failed` with the reason `schema`, and no agent starts

#### Scenario: The supported schema
- **WHEN** the apply instructions report `spec-driven` with its tasks tracked
- **THEN** the build goes on as before

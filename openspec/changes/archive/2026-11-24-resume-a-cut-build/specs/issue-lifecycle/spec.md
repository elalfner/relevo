## ADDED Requirements

### Requirement: The next-step table gives a build that stopped before it finished its own variant
The next-step table SHALL give `build-failed` a variant for a build that stopped at a limit or was cut with its work kept on the branch. It SHALL be owned by the assignee, its command SHALL be `/relevo:go {n} --resume`, and its hint SHALL say that it continues the build from where it stopped and that `/relevo:fix {n}` is for work that QA rejected. The variant for work that QA rejected, and the one for a refused checkpoint after earlier ones were pushed, SHALL keep `/relevo:fix {n}`.

#### Scenario: A run stopped at a limit
- **WHEN** a `build_failed` comment has the reason `run limit reached` and the branch state is `kept`
- **THEN** its next step is `/relevo:go <n> --resume` and not `/relevo:fix <n>`

#### Scenario: QA rejected the work
- **WHEN** a `build_failed` comment has the branch state `kept` for a QA rejection
- **THEN** its next step is `/relevo:fix <n>`, as before

#### Scenario: Both languages
- **WHEN** the repository language is Spanish
- **THEN** the variant, its hint and its progress line are in Spanish, and a test fails when either language lacks it

### Requirement: The comment of a build that stopped says how much was done
The `build_failed` comment of a build that stopped at a limit with its work kept SHALL say how many tasks of `tasks.md` are done out of the total, and SHALL name the cloud way (apply the `go` label) next to the local one (`--resume`). It SHALL NOT say that QA rejected the work.

#### Scenario: Four of nine tasks
- **WHEN** a run stops at the turns limit with four of nine tasks checked
- **THEN** the comment says that four of nine tasks are done, names `/relevo:go <n> --resume` and the `go` label, and says that QA did not judge the work

#### Scenario: The tasks cannot be read
- **WHEN** the number of tasks done or the total is not known
- **THEN** the comment names the next step without the figure and does not invent one

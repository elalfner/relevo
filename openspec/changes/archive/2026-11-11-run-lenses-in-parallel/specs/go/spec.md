## ADDED Requirements

### Requirement: The QA lenses run together
When the gate receipt is valid, `go` SHALL launch every active lens in the same turn, each in the foreground and with the model and effort of the plan, and SHALL wait for all the reports before it aggregates. The lens plan SHALL list the launch batches: all the active lenses in one batch, or batches of at most the concurrency limit of the runtime when one is given. A run that cannot launch the lenses together SHALL launch them in those batches, one batch after another.

#### Scenario: Several active lenses
- **WHEN** the receipt is valid and the plan lists `spec`, `security`, `code` and `interface` as active
- **THEN** the four are launched together and the build waits for the four reports

#### Scenario: A concurrency limit
- **WHEN** the runtime allows only two subagents at a time and four lenses are active
- **THEN** the plan lists two batches of two and the second batch starts after the first has reported

#### Scenario: An inactive lens
- **WHEN** the plan records `interface` as `SKIPPED`
- **THEN** no agent is launched for it and it is in no batch

### Requirement: No lens starts without a valid receipt, in parallel as in sequence
The receipt SHALL be checked immediately before each launch of lenses (each batch), and no lens SHALL start when that check fails: the gate runs again first. All the lenses of a batch SHALL be launched in the same turn, with no step between them that can change the diff.

#### Scenario: The diff changed since the gate
- **WHEN** the receipt check fails before a batch
- **THEN** no lens of the batch starts and the gate runs again

#### Scenario: A second batch
- **WHEN** the lenses are launched in two batches
- **THEN** the receipt is checked again before the second batch

### Requirement: One failed lens does not stop the others
When a lens ends with no report, the other lenses SHALL finish and keep their reports. `go` SHALL ask that lens again once, alone, after the receipt check, and when it still gives no report SHALL take the failure path with the reason `lens report invalid`, naming the lens and not retrying the developer.

#### Scenario: One lens ends with no report
- **WHEN** `code` fails and `spec` and `security` report
- **THEN** their reports are kept, `code` is asked again once, and if it fails again the comment names `code`

### Requirement: The seconds of each lens are right when lenses overlap
The record of a lens SHALL have its own start and its own end. The seconds of a lens SHALL be the time between them; a lens that has no end SHALL last until the next phase is announced or the run ends, never until another lens begins.

#### Scenario: Two lenses overlap
- **WHEN** `spec` runs from 0 to 200 seconds and `security` from 1 to 30 seconds
- **THEN** the usage record has 200 seconds for `spec` and 29 for `security`

#### Scenario: A lens has no end
- **WHEN** a lens was started and never ended, and the next phase begins at 90 seconds
- **THEN** its seconds are counted to that phase

### Requirement: An agent is given the path of the Relevo scripts it runs
When an agent has to run a script of Relevo, `go` SHALL give it the resolved path of that script (from `CLAUDE_PLUGIN_ROOT`), and the instructions of the agent SHALL NOT make it search the filesystem for one.

#### Scenario: The spec lens checks the decisions of the issue
- **WHEN** `go` launches the `spec` lens
- **THEN** it gives the lens the path of `issue-sections.mjs`, and the lens runs that path with no search

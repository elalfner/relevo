## ADDED Requirements

### Requirement: The gate reuses a green check on an unchanged diff
The gate SHALL NOT run a check again when a result recorded in this working folder has the same diff hash, the same command and the same platform folder, passed, and the same check never failed on that key. It SHALL record the check as `reused` in the receipt, with the original duration, and SHALL still report the overall status. A check that failed, or that ever failed on that key, SHALL be run. The diff changing SHALL give no reuse.

#### Scenario: The same diff and command
- **WHEN** the developer's run of `test` passed on the diff the gate now hashes
- **THEN** the gate records `test` as reused and does not run it

#### Scenario: The tree changed
- **WHEN** the diff changed after the earlier run
- **THEN** the gate runs the check

#### Scenario: A flaky test
- **WHEN** a check passed once and failed once on the same key
- **THEN** the gate runs it every time and reuse never hides the red result

#### Scenario: A red result
- **WHEN** an earlier result for the key is red
- **THEN** the gate runs the check again

### Requirement: A result cannot be marked green without running it
No argument of the gate or of any other script SHALL mark a check green without running the command. Only the gate and the script that runs long commands write results, and only after a command ran.

#### Scenario: The agent wants a shortcut
- **WHEN** an agent looks for a way to mark a check green
- **THEN** no option, subcommand or argument records a result without running the command

### Requirement: Every lens reads the receipt for results
The orchestrator SHALL give every lens the receipt and SHALL tell it not to run the analysis or the tests, so that a lens that needs a result reads it from the receipt.

#### Scenario: A lens needs test results
- **WHEN** a lens needs to know whether the tests passed
- **THEN** it reads the receipt and does not run the tests

# validation-gate Specification

## Purpose
Runs the checks that need no judgement once, in a script, and proves with a receipt tied to the exact diff that they ran, so that no reviewer starts on code whose checks did not run.

## Requirements

### Requirement: The checks run once in a script, not in an agent
After the developer agent finishes and its new files are visible to the diff, the orchestrator SHALL run a gate that runs the `analyze` and `test` commands of the profile from the folder of the platform, the diff scanner and the restricted-file check, and SHALL report `green`, `red` or `could-not-run`. No agent SHALL run the gate.

#### Scenario: A green run
- **WHEN** analysis and tests pass and the scans find nothing
- **THEN** the gate reports `green`

#### Scenario: A failing test
- **WHEN** a test fails
- **THEN** the gate reports `red` and names the command

#### Scenario: A missing tool
- **WHEN** a command of the profile cannot start
- **THEN** the gate reports `could-not-run` and names the tool

### Requirement: The gate writes a receipt tied to the diff
The gate SHALL write a receipt with a hash of the diff against the base branch excluding generated files, the base commit, each command with its exit code, duration and the tail of its output, and the status. The receipt SHALL be written in a local folder that git ignores and SHALL NOT appear in the diff or in a commit.

#### Scenario: A receipt exists
- **WHEN** the gate finishes
- **THEN** the receipt holds the hash, the base commit, the commands with their results and the status

#### Scenario: The receipt is not committed
- **WHEN** the work is committed
- **THEN** the receipt is not among the files of the commit

### Requirement: No lens starts without a valid receipt
Before each lens the orchestrator SHALL recompute the hash of the current diff and SHALL NOT launch the lens unless it equals the receipt's and the status is `green`. When the diff changed, the gate SHALL run again.

#### Scenario: The diff changed
- **WHEN** a file changed after the receipt was written
- **THEN** the gate runs again before any lens

#### Scenario: A receipt that is red
- **WHEN** the receipt's status is `red`
- **THEN** no lens is launched

### Requirement: A red gate goes back to the developer agent without QA
When the gate is red, the developer agent SHALL receive the tail of its output, capped in size, and SHALL fix, with no lens having run. A red gate SHALL use one of the developer attempts, so that the total remains `qa.retries + 1`.

#### Scenario: A first attempt with a failing test
- **WHEN** the gate is red after the first developer run and `qa.retries` is 1
- **THEN** the developer agent fixes with the output of the gate and one attempt remains for QA

#### Scenario: No attempts left
- **WHEN** the gate is red on the last attempt
- **THEN** the run ends in the usual failure exit with the output of the gate in the comment

### Requirement: A gate that could not run ends the run
When the gate reports `could-not-run`, the run SHALL end with the reason "automated validation could not run", naming what is missing, and the developer agent SHALL NOT be retried, because it cannot install a tool.

#### Scenario: The tools are missing
- **WHEN** the test runner is not installed
- **THEN** the run ends with that reason and no developer retry

### Requirement: The code lens uses the receipt
The `code` lens SHALL read the receipt for the result of analysis and tests and SHALL NOT run them again.

#### Scenario: The lens needs a result
- **WHEN** the `code` lens reports on the tests
- **THEN** it cites the receipt and does not run the test command

### Requirement: The receipt is a safeguard against mistakes, not a boundary
The documentation SHALL say that the receipt guards against an omission or a mistake, and that it is not a defence against an agent that writes a false file, so the guards of the commit remain the enforcement.

#### Scenario: A reader looks at the security page
- **WHEN** a person reads what the receipt protects
- **THEN** the page says that it is not a security boundary

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

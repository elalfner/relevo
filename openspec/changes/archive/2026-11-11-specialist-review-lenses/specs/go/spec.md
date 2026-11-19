## MODIFIED Requirements

### Requirement: Adversarial QA with one retry
QA SHALL compare the diff against the issue's scenarios and the project rules in `qa.rules_from` through its lenses, after the validation gate has run the platform's static analysis and tests once, and return `QA PASSED` or `QA REJECTED` with file, line and reason. On rejection, by the gate or by a lens, the developer agent SHALL get exactly `qa.retries` attempts to fix, then QA SHALL run again.

#### Scenario: QA passes after a retry
- **WHEN** the first QA run rejects and the second passes
- **THEN** the build proceeds as passed

#### Scenario: QA still rejects
- **WHEN** QA rejects after the allowed retries
- **THEN** the branch is pushed, the issue is labelled `qa-failed`, the assignee is mentioned with the QA report, no pull request is opened and the state does not advance

#### Scenario: Task marked done without code
- **WHEN** a task is checked off without code that implements it
- **THEN** QA rejects and names the task

#### Scenario: Validation tooling missing
- **WHEN** the gate cannot run static analysis or tests because the tooling is not available
- **THEN** the run ends with the reason "automated validation could not run" and no lens passes code whose checks did not run

#### Scenario: Device-only scenario
- **WHEN** a scenario can only be observed on a device or in another app
- **THEN** QA does not reject it for lacking a test, checks that the code plausibly produces it, and lists it as left for on-device review

#### Scenario: Verdict line
- **WHEN** a lens or the aggregation finishes
- **THEN** the first line of its output is exactly `QA PASSED` or `QA REJECTED`

#### Scenario: A red gate
- **WHEN** the gate reports that the tests fail
- **THEN** no lens runs, the developer agent receives the output of the gate and one of its attempts is used

### Requirement: QA retries look only at what changed
On a retry, each lens SHALL audit the files in the developer's report and every finding of its own previous report, and the gate SHALL still run the static analysis and the full test suite.

#### Scenario: Retry scope
- **WHEN** QA runs again after the developer fixed the findings of the first run
- **THEN** the gate runs analysis and all tests again, and each lens checks each earlier finding of its own first, then reviews the diff of the reported files

### Requirement: The agents are generic and the stack comes from the profile
`go` SHALL resolve the profile of the platform of the issue with the resolution command and give it to `relevo:dev` and to each lens agent, each lens with the sections it reads, together with the paths of the role skills. The agents SHALL NOT contain commands, file patterns or hygiene rules of one stack. The commands that verify the code and the generated files left out of the diff under review SHALL come from the profile.

#### Scenario: Flutter repository
- **WHEN** `go` builds an issue in a repository whose platform has stack `flutter`
- **THEN** the developer and the lenses receive the Flutter profile, the gate runs its `analyze` and `test` commands, and the diff leaves out the profile's generated files

#### Scenario: Profile cannot be resolved
- **WHEN** the resolution command fails
- **THEN** `go` takes the failure path with the reason `profile not resolved` and builds nothing

### Requirement: The agents leave configuration alone
`relevo:dev` SHALL NOT edit `relevo.yml`, anything under `.relevo/` or `skills-lock.json`, and the `spec` lens SHALL reject a diff that touches them, as it already does for `GLOSSARY.md` and `docs/adr/`.

#### Scenario: Developer edits the configuration
- **WHEN** the diff touches `relevo.yml`
- **THEN** the `spec` lens rejects it citing the file, and the commit script would refuse it anyway

### Requirement: Commands run from the folder of the platform
`go` SHALL resolve the profile and the role skills for the platform of the decision and tell `relevo:dev` and the lenses the folder of the platform, and run the commands of the profile from it in the gate.

#### Scenario: Monorepo
- **WHEN** `go` builds an issue for `api` at `apps/api`
- **THEN** the agents receive the profile of the stack of `api` and the folder `apps/api`

### Requirement: The phase of the build is announced and checked
At the start of each step of a build, `go` SHALL announce the phase it enters: planning, specification, development, QA, the new attempt of development or QA with its number out of the allowed retries, and delivery. The announcement SHALL be kept outside the working tree of the repository so that it never appears in the diff of the change. When no announcement has been made, the phase SHALL be deduced from what exists in the working tree, and the progress comment SHALL still be kept.

#### Scenario: QA starts
- **WHEN** the agent starts the validation gate for the first time
- **THEN** the progress comment shows the QA phase

#### Scenario: Retry after a rejection
- **WHEN** QA rejects the work and development starts again
- **THEN** the progress comment shows development with its attempt number out of the allowed retries

#### Scenario: No announcement
- **WHEN** the agent has announced no phase
- **THEN** the progress comment shows the phase deduced from the working tree, and the elapsed time keeps growing

#### Scenario: The announcement stays out of the diff
- **WHEN** the phase has been announced and the work is committed
- **THEN** the announcement is not among the files of the commit and the working tree has no file added for it

## ADDED Requirements

### Requirement: QA is the gate followed by the lenses
After the developer agent finishes, `go` SHALL run the validation gate, and SHALL run the lenses only when the gate is green and its receipt is valid. It SHALL then aggregate the reports with a script, and SHALL end the run or hand the findings to the developer agent as the result says.

#### Scenario: A green gate
- **WHEN** the gate is green and its receipt matches the diff
- **THEN** the active lenses run one after another and their reports are aggregated

#### Scenario: A receipt that does not match
- **WHEN** the diff changed after the receipt was written
- **THEN** the gate runs again before any lens

### Requirement: The limits of a run count every subagent
The limits on the turns and the cost of a run, and the limit on its tokens with an agent that has no cost limit, SHALL include the turns, cost and tokens of the lens agents. Where the runtime does not count a subagent, Relevo SHALL count it from the log of the run.

#### Scenario: Lenses use turns
- **WHEN** the lenses of a run use turns
- **THEN** those turns count towards `limits.run_max_turns`

#### Scenario: A runtime that does not count subagents
- **WHEN** the runtime leaves the turns of a subagent out of its count
- **THEN** Relevo adds them from the log and applies the limit to the total

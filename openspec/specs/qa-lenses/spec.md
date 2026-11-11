# qa-lenses Specification

## Purpose
Splits the review of a build into read-only lenses, each with its own scope, knowledge, model and effort, and decides the result with a script, so that each kind of judgement has one owner and the blocking rule is explicit.

## Requirements

### Requirement: QA is made of four read-only lenses
QA SHALL be made of the lenses `spec`, `security`, `code` and `interface`. Each lens SHALL be a read-only reviewer that changes no file and does not change the index, that answers with a first line of exactly `QA PASSED` or `QA REJECTED`, and that lists numbered findings, each with a class.

#### Scenario: A lens answers
- **WHEN** a lens finishes
- **THEN** its first line is `QA PASSED` or `QA REJECTED` and every finding is numbered and has a class

#### Scenario: A lens tries to write
- **WHEN** a lens would need to change a file
- **THEN** it has no tool to do so and reports the need as a finding

### Requirement: The `spec` lens owns the conformance to the issue
The `spec` lens SHALL check that every scenario has code and, where the platform allows, a test, that every task marked done has real code, that the project rules of `qa.rules_from` are kept, that the diff stays inside the folder of the platform and the change and adds no unjustified dependency or configuration change, that the documentation text equals the issue's, and that every decision and constraint of the issue holds.

#### Scenario: A scenario with no code
- **WHEN** a scenario of the specification has no code that makes its outcome true
- **THEN** the `spec` lens rejects and names the scenario

#### Scenario: A task checked off without code
- **WHEN** a task is marked done and no code implements it
- **THEN** the `spec` lens rejects and names the task

#### Scenario: A project rule broken
- **WHEN** the diff breaks a rule of the project's rules file
- **THEN** the `spec` lens rejects and cites the rule by its text

### Requirement: The `code` lens owns the hygiene of the stack and the tests
The `code` lens SHALL read the receipt of the gate instead of running the checks, SHALL look in the diff for what the profile lists for the stack and for leftovers and temporary markers, SHALL judge the tests that the developer wrote, and SHALL review a script that is meant to review the built change before it runs.

#### Scenario: A leftover
- **WHEN** the diff holds a debug print or a temporary marker
- **THEN** the `code` lens rejects with the file and line

#### Scenario: A typical bug of the stack
- **WHEN** the diff holds a defect that the profile lists for the stack
- **THEN** the `code` lens rejects with the file, line and the item of the profile

#### Scenario: A script that asserts nothing
- **WHEN** a review script has a line that would pass whether or not the behaviour existed
- **THEN** the `code` lens rejects it and names the line

### Requirement: The `security` lens owns the security review
The `security` lens SHALL look in the diff for injection and unsafe construction of queries or commands, authentication and authorization gaps, secrets and sensitive data in code, logs and errors, unsafe deserialization and evaluation, trust in input that comes from the client, open redirects, and dependencies the design does not justify, and for what the profile lists for the stack.

#### Scenario: A query built from input
- **WHEN** the diff builds a query by joining user input into a string
- **THEN** the `security` lens rejects with the file and line

#### Scenario: A finding without evidence
- **WHEN** the lens can only suspect a weakness and cannot point to a line, an output or a scenario
- **THEN** it does not reject for it

### Requirement: The `interface` lens owns the interface rules and the references
The `interface` lens SHALL apply the interface rules that the change touches and the design references of the issue, treating a mobile sketch as an image reference, and SHALL list what only a person can see under "left for on-device review".

#### Scenario: A blocking rule broken
- **WHEN** the diff breaks a blocking interface rule
- **THEN** the lens rejects with the file, line and rule

#### Scenario: Appearance only a person can judge
- **WHEN** a scenario depends on how the screen looks
- **THEN** the lens lists it for the on-device review and does not reject

### Requirement: Every finding needs evidence in every lens
A finding of any lens SHALL carry the file and line, what is wrong, the evidence (a line of code, the output of a command or a quoted scenario) and the scenario or rule it breaks, in a form that the developer agent can fix without asking. A lens SHALL NOT reject on speculation or on taste unless a rule of the project says so.

#### Scenario: Enough to fix
- **WHEN** a lens rejects
- **THEN** each finding says where it is, what is wrong, how it is known and what it breaks

### Requirement: A lens reads only the sections that it needs
Each lens SHALL receive only the sections of the profile that it reads, and the `spec` lens SHALL receive none of the stack's sections.

#### Scenario: The security lens
- **WHEN** the `security` lens is launched
- **THEN** it receives the security sections of the profile and not the sections for the developer or for the interface

### Requirement: The `interface` lens is active only when the change has an interface
The `interface` lens SHALL be active only when the profile of the platform has an interface and the selection of interface rules for the change returns at least one rule beyond the always-on ones. Otherwise a script SHALL record it as `SKIPPED` with the reason.

#### Scenario: A stack with no interface
- **WHEN** the profile has no interface
- **THEN** the lens is recorded as `SKIPPED` with that reason and no agent is launched for it

#### Scenario: A change with a visible part
- **WHEN** the tasks touch a form on a stack with an interface
- **THEN** the lens is active

### Requirement: Every active lens runs every round
In each round every active lens SHALL review the change, so that the developer agent receives all the findings at once. In this version the lenses run one after another.

#### Scenario: Findings from two lenses
- **WHEN** the `spec` lens and the `security` lens each reject
- **THEN** the developer agent receives both reports together

### Requirement: A script decides the result and it fails closed
A script SHALL read the report of each lens and decide the result: `spec`, `security` and `code` always block, and `interface` blocks on every attempt except the last. Any blocking rejection SHALL make the result `QA REJECTED`. A report without a valid first line SHALL be requested once more from the same lens, and if it is still invalid the run SHALL end with the reason "lens report invalid" and no developer retry.

#### Scenario: One blocking lens rejects
- **WHEN** only the `code` lens rejects
- **THEN** the result is `QA REJECTED`

#### Scenario: An invalid report
- **WHEN** a lens answers without a valid first line twice
- **THEN** the run ends with the reason "lens report invalid" and the developer agent is not retried

### Requirement: The interface lens advises on the last attempt
The last attempt is the one numbered `qa.retries + 1`. On it the findings of the `interface` lens SHALL NOT block and SHALL become advisory notes. With `qa.retries` equal to 0 the lens SHALL always advise.

#### Scenario: Interface rejects on the first attempt
- **WHEN** only the `interface` lens rejects and a retry remains
- **THEN** the result is `QA REJECTED` and the developer agent receives its findings

#### Scenario: Interface rejects on the last attempt
- **WHEN** only the `interface` lens rejects on the last attempt
- **THEN** the result is `QA PASSED` and its findings are advisory notes

#### Scenario: No retries
- **WHEN** `qa.retries` is 0 and the `interface` lens rejects
- **THEN** its findings are advisory notes

### Requirement: Advisory content reaches the person
When the result passes with advisory content, which is the findings of the `interface` lens on the last attempt and the scenarios that only a device can show, the hand-off SHALL carry them in a hidden marker next to the visible lines, so that the review lists them. No file SHALL be written to the repository for them.

#### Scenario: Notes in the hand-off
- **WHEN** the result passes with a note from the `interface` lens
- **THEN** the hand-off comment carries it in the marker and shows how many notes there are

### Requirement: The lenses are evaluated on seeded defects
An opt-in harness SHALL run each lens on seeded defects and on good variants and report, per lens, the defects found, the good variants flagged and the cost, and SHALL be able to run without a given rule or with a given skill. The result SHALL be recorded in a dated page of the documentation, and a default SHALL change only on that evidence.

#### Scenario: A lens that flags good code
- **WHEN** the evaluation flags a good variant
- **THEN** the report counts it as a false positive for that lens

#### Scenario: The harness is not part of the tests
- **WHEN** the automatic tests run
- **THEN** the harness does not run and spends no model usage

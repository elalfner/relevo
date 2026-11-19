## RENAMED Requirements

- FROM: `### Requirement: QA is made of four read-only lenses`
- TO: `### Requirement: QA is made of five read-only lenses`

## MODIFIED Requirements

### Requirement: QA is made of five read-only lenses
QA SHALL be made of the lenses `spec`, `security`, `code`, `interface` and `bugs`. Each lens SHALL be a read-only reviewer that changes no file and does not change the index, that answers with a first line of exactly `QA PASSED` or `QA REJECTED`, and that lists numbered findings, each with a class.

#### Scenario: A lens answers
- **WHEN** a lens finishes
- **THEN** its first line is `QA PASSED` or `QA REJECTED` and every finding is numbered and has a class

#### Scenario: A lens tries to write
- **WHEN** a lens would need to change a file
- **THEN** it has no tool to do so and reports the need as a finding

### Requirement: A lens reads only the sections that it needs
Each lens SHALL receive only the sections of the profile that it reads, and the `spec` and `bugs` lenses SHALL receive none of the stack's sections.

#### Scenario: The security lens
- **WHEN** the `security` lens is launched
- **THEN** it receives the security sections of the profile and not the sections for the developer or for the interface

#### Scenario: The bugs lens
- **WHEN** the `bugs` lens is launched
- **THEN** it receives the change, the receipt and the project rules, and no section of the profile

### Requirement: A script decides the result and it fails closed
A script SHALL read the report of each lens and decide the result: `spec`, `security` and `code` always block, `interface` blocks on every attempt except the last, and `bugs` blocks only as its mode says. Any blocking rejection SHALL make the result `QA REJECTED`. A report without a valid first line SHALL be requested once more from the same lens, and if it is still invalid the run SHALL end with the reason "lens report invalid" and no developer retry, except for the `bugs` lens in `advisory` mode.

#### Scenario: One blocking lens rejects
- **WHEN** only the `code` lens rejects
- **THEN** the result is `QA REJECTED`

#### Scenario: An invalid report
- **WHEN** a lens answers without a valid first line twice
- **THEN** the run ends with the reason "lens report invalid" and the developer agent is not retried

#### Scenario: The bugs lens rejects in advisory mode
- **WHEN** only the `bugs` lens rejects and its mode is `advisory`
- **THEN** the result is `QA PASSED` and its findings are advisory notes

#### Scenario: The bugs lens gives no valid report in advisory mode
- **WHEN** the `bugs` lens answers without a valid first line twice and its mode is `advisory`
- **THEN** the result is the one of the other lenses and a note says that the lens gave no valid report

### Requirement: Advisory content reaches the person
When the result passes with advisory content, which is the findings of the `interface` lens on the last attempt, the findings of the `bugs` lens that do not block and the scenarios that only a device can show, the hand-off SHALL carry them in a hidden marker next to the visible lines, so that the review lists them. No file SHALL be written to the repository for them.

#### Scenario: Notes in the hand-off
- **WHEN** the result passes with a note from the `interface` lens
- **THEN** the hand-off comment carries it in the marker and shows how many notes there are

#### Scenario: A note from the bugs lens
- **WHEN** the result passes with a finding of the `bugs` lens that does not block
- **THEN** the hand-off carries it in the marker with the name of the lens and its label, and the review lists it as a pending line

## ADDED Requirements

### Requirement: The `bugs` lens owns the correctness defects
The `bugs` lens SHALL look in the diff for a defect that has a concrete failure scenario: a wrong or missing condition, a guard that the change removes and nothing re-establishes, a changed function that breaks one of its callers, and what holds only at one moment, such as a state reached later, a second actor, a repeated or concurrent call, or a sensitive action that leaves no trace. It SHALL NOT report style, cleanup, conformity to the issue, security or hygiene, which other lenses own.

#### Scenario: A guard removed
- **WHEN** the diff deletes a check and no code of the change enforces the same invariant
- **THEN** the `bugs` lens rejects with the file, line, the invariant and the input that now gets through

#### Scenario: An invariant that holds only at one moment
- **WHEN** a value is validated when a feature is switched on and a later call can set it back to an invalid one
- **THEN** the `bugs` lens rejects with both lines and the sequence of calls

#### Scenario: A finding that belongs to another lens
- **WHEN** the only problem found is a leftover marker, a weak test or a broken scenario of the issue
- **THEN** the `bugs` lens does not report it

### Requirement: A finding of the `bugs` lens is confirmed or plausible
The `bugs` lens SHALL check each candidate against the code before reporting it and SHALL label it `CONFIRMED`, when the failing input and the line that mishandles it are shown, or `PLAUSIBLE`, when the scenario is believable but a fact outside the diff is unchecked. It SHALL name that fact in a `PLAUSIBLE` finding and SHALL NOT report a candidate it can refute.

#### Scenario: A confirmed finding
- **WHEN** the lens can show the input and the line that fails
- **THEN** the finding is labelled `CONFIRMED` and carries both

#### Scenario: A plausible finding
- **WHEN** the failure depends on a configuration that the diff does not show
- **THEN** the finding is labelled `PLAUSIBLE` and names that configuration

#### Scenario: A refuted candidate
- **WHEN** reading the callers shows that the input cannot reach the line
- **THEN** the lens does not report the candidate

### Requirement: The mode of the `bugs` lens decides whether it blocks
The `bugs` lens SHALL be governed by `qa.bugs` of `relevo.yml`, whose default is `advisory`. In `advisory` every finding SHALL be an advisory note and none SHALL block. In `blocking` a `CONFIRMED` finding SHALL block and a `PLAUSIBLE` one SHALL be an advisory note. With `off` the lens SHALL be recorded as `SKIPPED` with that reason and no agent SHALL be launched for it.

#### Scenario: The default
- **WHEN** `relevo.yml` does not set `qa.bugs` and the lens reports a `CONFIRMED` finding
- **THEN** the result of QA is unchanged and the finding is an advisory note

#### Scenario: Blocking with a confirmed finding
- **WHEN** `qa.bugs` is `blocking` and the lens reports a `CONFIRMED` finding
- **THEN** the result is `QA REJECTED` and the developer agent receives the finding

#### Scenario: Blocking with a plausible finding
- **WHEN** `qa.bugs` is `blocking` and the lens reports only a `PLAUSIBLE` finding
- **THEN** the result is `QA PASSED` and the finding is an advisory note

#### Scenario: Switched off
- **WHEN** `qa.bugs` is `off`
- **THEN** the lens is recorded as `SKIPPED` with that reason and no agent is launched

### Requirement: The `bugs` lens is evaluated before its default changes
The evaluation harness SHALL include seeded cases for the `bugs` lens, built from neutral examples that name no real project, each with a bad variant that has one defect and a good variant that differs only by the fix. The default of `qa.bugs` SHALL change to `blocking` only after a dated page of the documentation records, for the lens, the defects found and no good variant flagged.

#### Scenario: A seeded case
- **WHEN** the harness runs the `bugs` lens on a case
- **THEN** it counts the defect as found when the lens rejects the bad variant with the expected finding, and a rejected good variant as a false positive

#### Scenario: A default changes
- **WHEN** a change proposes `blocking` as the default of `qa.bugs`
- **THEN** it cites the dated evaluation that records the defects found and no good variant flagged

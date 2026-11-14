## Purpose

Gives Relevo one body of interface rules that is asked, checked, built and reviewed the same way in every stack, with a bounded cost for each agent and the attribution of its source.

## ADDED Requirements

### Requirement: A rule has a fixed set of fields
Each rule SHALL have a stable identifier, a category, a principle in one or two sentences that is not a recipe for one technology, the platforms it applies to (`all`, `web` or `mobile`), a weight (`blocking` or `advisory`), how it is checked (`code`, `render` or `person`), whether it is always considered (`core`), the tags of the changes it matters to, a question, a "build it like this" line, a "check this" line, optional examples tagged by stack, and its source.

#### Scenario: A rule without a field
- **WHEN** a rule lacks its weight, its check or its source
- **THEN** the test of the data fails and names the rule

#### Scenario: A repeated identifier
- **WHEN** two rules have the same identifier
- **THEN** the test of the data fails

#### Scenario: A blocking rule that cannot be checked
- **WHEN** a rule is `blocking` and has no `code`, `render` or `person` check, or has no example for any stack
- **THEN** the test of the data fails

### Requirement: The curation is recorded and the source is attributed
The collection SHALL come with a record of which guidelines of its source were adopted, merged into another or left out, with the reason. The licence notice SHALL name the source with its copyright line and licence text, and a test SHALL fail when a rule cites a source that the notice does not name.

#### Scenario: A guideline left out
- **WHEN** a person asks why a guideline of the source has no rule
- **THEN** the record says that it was left out and gives the reason

#### Scenario: A source missing from the notice
- **WHEN** a rule cites a source that the notice does not name
- **THEN** the test fails

### Requirement: Rules that cite an accessibility standard are verified against it
A rule that cites a criterion of an accessibility standard SHALL be checked against the text of the standard, and the date it was checked SHALL be recorded with the collection. A rule that cannot be confirmed SHALL be corrected or removed, and an enhanced criterion SHALL NOT be presented as a requirement.

#### Scenario: An enhanced criterion
- **WHEN** a rule is based on a criterion of the enhanced level of the standard
- **THEN** its text says that it is enhanced and its weight is `advisory`

### Requirement: The rules for an agent are selected by a script for a role, a stack and a change
A script SHALL select the rules for a role (`think`, `issue`, `dev`, `qa` or `review`), a stack and the text of a change. It SHALL keep the rules whose platform matches the interface kinds of the stack, always keep the `core` ones, add those whose tags match the text, and print the face of each that the role needs: the question for `think` and `issue`, the "build it like this" line for `dev`, the "check this" line for `qa` and `review`.

#### Scenario: A change that touches forms
- **WHEN** the text of the change mentions a form and the role is `dev`
- **THEN** the output holds the core rules and the form rules, each with its "build it like this" line

#### Scenario: A stack for the web only
- **WHEN** the stack has only the `web` interface kind
- **THEN** no rule that applies only to `mobile` is selected

#### Scenario: A mobile stack that builds for the web
- **WHEN** the platform of a `mobile` stack has `web` among its targets
- **THEN** the rules for `web` are selected as well

### Requirement: Only the examples of the stack are given, and the cost is bounded
The selection SHALL give an agent only the examples tagged for the stack of the issue or as neutral. For `dev` and `qa` it SHALL keep within a budget of bytes, dropping first the advisory rules and then the examples of the rules that are not core, SHALL NOT drop a blocking core rule, and SHALL print how many rules it left out.

#### Scenario: Over the budget
- **WHEN** the rules that match are larger than the budget
- **THEN** advisory rules and then examples are dropped, the blocking core rules stay, and the output says how many were left out

#### Scenario: An example for another stack
- **WHEN** a rule has an example tagged for a stack other than the one of the issue
- **THEN** it is not in the output

### Requirement: A stack can translate a rule
A stack MAY override the "build it like this" line, the "check this" line and the examples of a rule where the principle reads differently in that stack. A rule without an override SHALL use the common text. A report SHALL list the blocking rules that have no example for a stack, and the tests SHALL print it as a warning and not fail on it.

#### Scenario: A translated rule
- **WHEN** the rule about accessible names is selected for a `mobile` stack
- **THEN** the lines come from that stack's override and not from the common text

#### Scenario: A gap
- **WHEN** a blocking rule has no example for a stack
- **THEN** the coverage report lists it for that stack

### Requirement: A repository can add rules and never weaken them
A repository MAY add rules and examples in `.relevo/interface.json` with the same fields. It SHALL NOT remove a rule of the plugin or lower its weight, and an exception for a project SHALL be written in the project's own rules file, which QA already reads. `doctor` SHALL validate the file.

#### Scenario: An added rule
- **WHEN** the file adds a rule with all its fields
- **THEN** it is selected like a rule of the plugin

#### Scenario: A rule that tries to lower a weight
- **WHEN** the file repeats the identifier of a plugin rule with a lower weight
- **THEN** the plugin's rule is kept and `doctor` reports the attempt

### Requirement: Seeded defects exist for the blocking rules
For each blocking rule that has a code example there SHALL be a good and a bad file, taken from the examples of the rule, in the fixtures of the tests. A test SHALL fail when a blocking rule with a code example has no fixture and no recorded reason.

#### Scenario: A blocking rule with a bad example
- **WHEN** a blocking rule has a bad code example
- **THEN** the fixtures hold a file with that defect and a good variant that must not be flagged

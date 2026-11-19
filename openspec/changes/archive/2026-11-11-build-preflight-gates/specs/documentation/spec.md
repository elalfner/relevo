## ADDED Requirements

### Requirement: The documentation describes the checks before the agent, the new reasons and the records
The guide, the issue format, the execution page and the security page SHALL describe the checks that run before the agent, the reasons `inputs` and `policy`, the `External inputs` section, the classes of QA findings, the handling of a conflict in `review` and the records of phases and outcome classes, in English and Spanish. They SHALL state that these checks are not a security control.

#### Scenario: A reader looks for why an issue went back
- **WHEN** a person reads the guide after an issue went to `needs-spec` with the reason `inputs` or `policy`
- **THEN** the guide says what each reason means and what to do

#### Scenario: Both languages
- **WHEN** a page gains a section about these checks
- **THEN** its Spanish page gains the same section with the same structure

#### Scenario: The security page
- **WHEN** a person reads the security page
- **THEN** it says that the guards remain the enforcement and that the checks before the agent only save cost

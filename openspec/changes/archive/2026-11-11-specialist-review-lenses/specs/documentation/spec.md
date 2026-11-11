## ADDED Requirements

### Requirement: The documentation describes the gate, the lenses and the settings
The guide, the configuration page, the stacks page, the execution page and the security page SHALL describe the gate and its receipt, the four lenses and what each owns, the blocking rule over the attempts, the advisory notes, the settings of model and effort with their defaults and their cost, and what is not applied with Antigravity, in English and Spanish.

#### Scenario: A reader looks for why a build was rejected
- **WHEN** a person reads the guide after a rejection
- **THEN** it says which lens or the gate can reject, and what each means

#### Scenario: A reader changes a model
- **WHEN** a person reads the configuration page
- **THEN** it lists the keys, the defaults and how to set each lens to the model that QA used before

#### Scenario: Both languages
- **WHEN** a page gains a section about these parts
- **THEN** its Spanish page gains the same section with the same structure

### Requirement: The evaluation is recorded on a dated page
The documentation SHALL have a page with the result of each run of the evaluation, with its date, the lenses, the defects and the good variants, what was found and flagged, and the cost, and SHALL say which default was kept or changed because of it.

#### Scenario: A default changes
- **WHEN** a default model or effort changes
- **THEN** the page records the evaluation that justified it

### Requirement: The release notes say that the cost of QA changes
The notes of the release that introduces the lenses SHALL say that two lenses use the stronger model by default, and how to keep the cost of QA as it was.

#### Scenario: The release notes
- **WHEN** a person reads the notes of that release
- **THEN** they say which lenses use the stronger model and which settings restore the previous cost

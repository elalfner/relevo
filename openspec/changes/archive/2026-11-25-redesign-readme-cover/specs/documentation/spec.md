# Spec Delta

## ADDED Requirements

### Requirement: The cover says what Relevo is before explaining it
The cover, in both languages, SHALL open with the logo, a headline about what the person gains, a line that calls Relevo an AI agent orchestrator from issue to merge, and the animated logo. The install commands SHALL come before the first section heading, followed by the instruction to restart Claude Code and run `/relevo:doctor`.

#### Scenario: A visitor wants to install
- **WHEN** a person opens the README
- **THEN** the two `claude plugin` commands appear before any `##` heading

#### Scenario: A visitor asks what it is
- **WHEN** a person reads the lines above the install commands
- **THEN** they name an AI agent orchestrator that goes from issue to merge

### Requirement: The cover claims only what the repository records
The cover SHALL NOT call Relevo early development, and SHALL say that it is in use on real projects and that configuration and commands can change before 1.0. Each usage figure on the cover SHALL be recorded in the pilot findings with its date and how it was counted, and the cover SHALL link that record.

#### Scenario: A figure
- **WHEN** the cover gives a number of merged pull requests or lines of code
- **THEN** the pilot findings hold the number, the date and the counting rule

#### Scenario: Status
- **WHEN** a person reads the status line
- **THEN** it says in use on real projects, links the changelog for breaking changes and does not say early development

#### Scenario: Where code goes
- **WHEN** a person reads the FAQ entry on whether their code leaves their infrastructure
- **THEN** it says that the code the agent reads is sent to the model provider, also with an own runner

### Requirement: Published usage evidence names no private project
The cover and the pilot findings entry about usage SHALL NOT name a private project, client, organisation, repository, person or runner label.

#### Scenario: The usage record
- **WHEN** the entry describes the projects that were measured
- **THEN** it gives their number, stacks and size only

### Requirement: The cover does not advertise what was not tried end to end
The cover SHALL NOT present Antigravity as a supported way to build. The install page and the security page SHALL keep describing it with what was and was not tried.

#### Scenario: Antigravity
- **WHEN** a person reads the README
- **THEN** Antigravity is not named, and the install page still describes `relevo init`

### Requirement: The cover shows the handoffs and keeps the command table
The cover SHALL show the three handoffs (`think`, `go`, `review`), each with its state picture, and SHALL keep the table of the seven commands of the flow, with the explanation of the logo, in a collapsed section near the end whose title says that it holds the commands.

#### Scenario: Looking for a command
- **WHEN** a person opens the section titled with the meaning of the logo and its commands
- **THEN** the table lists the seven commands in order and the page names `status` and `doctor`

### Requirement: The cover follows the brand
Every logo and picture of the cover SHALL be black on light or white on dark, with a variant for each theme, and the logo files SHALL be those of the brand folder, unchanged.

#### Scenario: Dark theme
- **WHEN** the README is read with a dark theme
- **THEN** each picture has a source for it

### Requirement: The package describes itself as the cover does
The descriptions of `package.json`, of the plugin manifest and of the marketplace entry SHALL call Relevo an AI agent orchestrator from issue to merge.

#### Scenario: The three descriptions
- **WHEN** the three files are read
- **THEN** each description holds the same words about what Relevo is

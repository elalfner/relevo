## ADDED Requirements

### Requirement: A Get started page takes a newcomer to a merged pull request
The documentation SHALL have a Get started page, in English and Spanish, with numbered steps from installing the plugin to shipping the first pull request. Each step SHALL give the command to run, what the person should see and what to do if they do not, and SHALL link the page that explains it in full. The page SHALL end with what to do next and a table of the problems a newcomer meets.

#### Scenario: A step
- **WHEN** a person reads the step that sets the repository up
- **THEN** it gives `/relevo:init`, says what the plan will show and that nothing changes until they agree, and what to do if a tool is missing

#### Scenario: The credential
- **WHEN** a person reaches the step about the model credential
- **THEN** it names the two secrets, says they are created by the person in the repository settings and never written in a file or in the conversation

#### Scenario: A problem
- **WHEN** a newcomer's first build does not start
- **THEN** the table of problems names the likely causes and the fix for each

### Requirement: The first page a visitor reads leads to it
The cover and the documentation index SHALL link the Get started page before every other page, and the install page SHALL point to it.

#### Scenario: From the cover
- **WHEN** a visitor opens the README
- **THEN** the first link in the documentation list is Get started

### Requirement: The install page does not contradict the stacks
The install page SHALL NOT say that a stack is the only one when the plugin ships more than one profile.

#### Scenario: Stacks
- **WHEN** the plugin ships the profiles flutter, vue and laravel
- **THEN** the install page names all three

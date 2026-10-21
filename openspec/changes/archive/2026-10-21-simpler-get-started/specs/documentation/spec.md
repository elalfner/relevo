# Spec Delta

## MODIFIED Requirements

### Requirement: A Get started page takes a newcomer to a merged pull request
The documentation SHALL have a Get started page, in English and Spanish, with numbered steps from installing the plugin to shipping the first pull request. Each step SHALL give the command to run, what the person should see and what to do if they do not, and SHALL link the page that explains it in full. The page SHALL end with what to do next and a table of the problems a newcomer meets. It SHALL give one way to install the plugin, SHALL explain in one plain sentence each technical term the first time it appears, and SHALL say what the build installs and what the project still has to install.

#### Scenario: A step
- **WHEN** a person reads the step that sets the repository up
- **THEN** it gives `/relevo:init`, says what the plan will show and that nothing changes until they agree, and what to do if a tool is missing

#### Scenario: The credential
- **WHEN** a person reaches the step about the model credential
- **THEN** it names the two secrets, says they are created by the person in the repository settings and never written in a file or in the conversation

#### Scenario: A problem
- **WHEN** a newcomer's first build does not start
- **THEN** the table of problems names the likely causes and the fix for each

#### Scenario: One way to install
- **WHEN** a person reads the install step
- **THEN** it shows the two `claude plugin` commands once, run in the project folder with the project scope written out, and the npm command and `relevo` are left to the install page

#### Scenario: A project with dependencies
- **WHEN** a person with a Vue or Laravel project reads the step that builds
- **THEN** it says the build installs the toolchain but not the dependencies, and that the project enables the install of its dependencies in `relevo-go.yml` or QA fails; for Flutter it says nothing more is needed

#### Scenario: A term the newcomer may not know
- **WHEN** the page first uses ruleset, OpenSpec root, milestone, secret or QA
- **THEN** a short sentence in plain words says what it is

#### Scenario: A rare case in the setup step
- **WHEN** the repository has no OpenSpec root, is a free private repository without branch protection, or is not a clone with a GitHub remote
- **THEN** the step stays short and the table of problems says what to do for each

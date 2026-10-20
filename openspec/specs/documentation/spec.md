# documentation Specification

## Purpose
TBD - created by archiving change documentation-guide. Update Purpose after archive.

## Requirements

### Requirement: A guide answers what to do next
The documentation SHALL have a guide, in English and Spanish, with the life of an issue and the command of each step, who runs it, what to do when a review finds a failure, a reviewer asks for changes, QA fails, the quota runs out or the correct behaviour is unknown, when to use `fix` and when to write a new issue, how to choose and switch between cloud, local or both, what the credentials and limits mean in each mode, and the practice for public repositories.

#### Scenario: A review found a failure
- **WHEN** a person reads the guide after a failure in a review
- **THEN** it says to run `/relevo:fix <n>` with what went wrong, and that the review resumes afterwards

#### Scenario: The quota ran out
- **WHEN** a cloud run stopped at a usage limit
- **THEN** the guide says the issue stays recoverable, to apply `ready` again later, or to run `go` locally

### Requirement: The security model is stated honestly
The documentation SHALL have a page, in English and Spanish, that states what Relevo protects and how, and what it does not protect, including that prompt injection has no complete defence, that code run by the agent in the runner is only partly contained, and that the human review of the pull request is the last barrier.

#### Scenario: What is not protected
- **WHEN** a person reads the page
- **THEN** it names the risks that remain and what reduces each

### Requirement: Every page exists in both languages with the same structure
Every page of the documentation SHALL exist in English and Spanish with the same sections in the same order, the same commands and the same links, and every page SHALL be in the list that the parity test checks.

#### Scenario: A page without its translation
- **WHEN** a page exists in one language only
- **THEN** the test fails and names it

### Requirement: The commands page gives the arguments and an example
For each command the page SHALL give the argument hint of its skill and an example of use.

#### Scenario: Argument of a command
- **WHEN** the skill of `fix` takes `[issue-number] [what is wrong]`
- **THEN** the commands page shows that form and an example

### Requirement: The configuration page covers every setting
The configuration page SHALL mention every setting that `relevo.yml` accepts, the layers of a stack profile, `checks` and what the limits mean with an API key and with a subscription.

#### Scenario: A new setting
- **WHEN** a setting is added to the code
- **THEN** a test fails until the page mentions it

### Requirement: The documentation does not name what does not exist
Every command, label, setting, script and file that a page names SHALL exist in the repository, and this SHALL be tested.

#### Scenario: A removed command
- **WHEN** a page names `/relevo:create`
- **THEN** the test fails

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

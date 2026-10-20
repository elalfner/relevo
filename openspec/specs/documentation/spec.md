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

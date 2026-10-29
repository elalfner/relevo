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

### Requirement: An upgrade page says what to update and in what order
The documentation SHALL have a page `upgrading`, in English and Spanish, that names the three things that carry a version (the plugin on each machine, the pin and text of the workflows, and the plugin the cloud agent loads), the order that avoids breaking a project, how to read the versions in `doctor`, and how `init` updates a workflow. It SHALL state that a newer plugin reads an older `relevo.yml`, and that an older one rejects the keys a newer one adds.

#### Scenario: The order
- **WHEN** a person reads the page
- **THEN** it says to update the plugins first, then the workflows through one pull request to the default branch, then run `init` for the labels and workflows that are new, and only then add the new keys to `relevo.yml`

#### Scenario: The page exists in both languages
- **WHEN** the parity test runs
- **THEN** `docs/upgrading.md` and `docs/upgrading.es.md` exist, have the same sections in the same order and are in the list that the test checks

#### Scenario: The commands it names exist
- **WHEN** the page names a command or a flag
- **THEN** the test that checks the documentation finds it in the code

#### Scenario: A visitor finds it
- **WHEN** a person reads the install page or the README
- **THEN** each links to the upgrade page

### Requirement: The stacks page explains the recommended Flutter skills
The stacks page, in both languages, SHALL say that the official Dart and Flutter skills are recommended and never required, give the install route of each tool, and say which route reaches the cloud runner. It SHALL NOT say that Relevo hands these skills to the `dev` or `qa` agent.

#### Scenario: Routes by tool
- **WHEN** the section on Flutter of the stacks page is read
- **THEN** it gives the two `claude plugin` commands for Claude Code, the `npx skills add flutter/agent-plugins ... --agent universal` command for the Antigravity CLI, and the settings path of the Antigravity IDE

#### Scenario: Nothing is required
- **WHEN** the section is read
- **THEN** it says that the Flutter profile works without these skills, that `doctor` reports a missing one as a note, and that `init` offers the installs as optional

#### Scenario: Cloud runner
- **WHEN** the section is read
- **THEN** it says that a plugin installed on a machine does not reach the cloud runner and that a skills folder committed to the repository does

#### Scenario: Rules and MCP
- **WHEN** the section is read
- **THEN** it says that the official rules are copied by hand into the project's rules file, and that the plugin of Claude Code brings the Dart MCP server while the Antigravity CLI needs `.agents/mcp_config.json`

#### Scenario: Both languages
- **WHEN** the English and the Spanish stacks pages are compared
- **THEN** both carry the same section with the same commands

### Requirement: The documentation says how building in the session differs from --local
The commands page SHALL compare the two ways to build an issue by hand, `/relevo:go <n>` in a Claude Code session and `/relevo:go <n> --local`, on who builds, the tools, the limits, what the person sees, whose context it uses and where the worktree is, and SHALL give a rule to choose between them. The guide SHALL say which to use by hand and link to that comparison, and the page about where `go` runs SHALL link to it instead of describing the difference again. Both languages SHALL have the same headings, the same commands and the same links.

#### Scenario: Choosing how to build by hand
- **WHEN** a person reads the `go` entry of the commands page
- **THEN** it shows that the session run is built by their own session with its own tools and no cost or turn limit and that `--local` runs a separate process with the closed tool lists and the limits of `relevo.yml`, and says to use the session to watch and step in and `--local` to leave it running under the same limits as the cloud

#### Scenario: Not described as the same
- **WHEN** a page describes `--local`
- **THEN** it does not say it does the same as the session run, because only the worktree is the same

#### Scenario: The guide points to the comparison
- **WHEN** a person reads "Cloud, local or both" in the guide
- **THEN** a bullet says which way to build by hand and links to the comparison in the commands page, in English and in Spanish

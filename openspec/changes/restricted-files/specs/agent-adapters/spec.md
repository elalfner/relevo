# Spec Delta

## ADDED Requirements

### Requirement: The restricted files are rendered as read denials for each agent
The cloud build of each supported agent SHALL receive the restricted files as read denials, written outside the repository so that a pull request cannot loosen them. For an agent whose tool offers no file-read denial, the workflow SHALL say so in the rendered file and the security page SHALL list the control as not enforced.

#### Scenario: Reading the Claude workflow
- **WHEN** a person reads the workflow rendered for `agent.build: claude`
- **THEN** the `Read` denials and the sandbox read denials for the base list and for `restricted_paths` are visible, and the example file is not among them

#### Scenario: The list changes
- **WHEN** a project adds an entry to `restricted_paths`
- **THEN** the next render of the workflow carries a denial for it in each agent

#### Scenario: An agent without file-read denials
- **WHEN** the tool of an agent has no setting to deny the read of a file
- **THEN** the rendered workflow does not claim a control it lacks and the run relies only on the other levels, which the security page lists

### Requirement: Claude Code gets both read controls
For Claude Code the denials SHALL be `Read` rules and sandbox read denials together, because a `Read` rule does not reach a shell command and a sandbox denial does not reach the `Read` tool.

#### Scenario: A shell command reads the file
- **WHEN** the agent runs `cat .env` in a shell
- **THEN** the sandbox denial refuses it, and the security page lists the shell as partial where the sandbox is not available

### Requirement: An ignore file is not a control
The rendered settings and the documentation SHALL NOT rely on a `.gitignore` entry or on an ignore file that the tool does not document (for example `.claudeignore` or `.claudecode.json`) to hide a file from an agent.

#### Scenario: A tool that names no such file
- **WHEN** Relevo renders the denials for an agent
- **THEN** it writes only settings that the tool's documentation lists as denying a read

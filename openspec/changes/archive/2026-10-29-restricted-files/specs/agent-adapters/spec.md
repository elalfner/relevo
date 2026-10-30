# Spec Delta

## ADDED Requirements

### Requirement: The restricted files are rendered as read denials for each agent
The cloud build of each supported agent SHALL receive the restricted files as read denials, written outside the repository so that a pull request cannot loosen them. For an agent whose tool offers no file-read denial, the workflow SHALL say so in the rendered file and the security page SHALL list the control as not enforced.

#### Scenario: Reading the Claude workflow
- **WHEN** a person reads the workflow rendered for `agent.build: claude`
- **THEN** the `Read` denials and the sandbox read denials for the base list and for `restricted_paths` are visible, the sandbox is shown as not enabled, and the example file is not among them

#### Scenario: The list changes
- **WHEN** a project adds an entry to `restricted_paths`
- **THEN** the next render of the workflow carries a denial for it in each agent

#### Scenario: An agent without file-read denials
- **WHEN** the tool of an agent has no setting to deny the read of a file
- **THEN** the rendered workflow does not claim a control it lacks and the run relies only on the other levels, which the security page lists

### Requirement: Claude Code gets both read controls
For Claude Code the denials SHALL be `Read` rules and sandbox read denials together, because a `Read` rule does not reach a process that opens files itself and a sandbox denial does not reach the `Read` tool.

#### Scenario: The cloud sandbox is not enabled by default
- **WHEN** the workflow is rendered for the cloud build
- **THEN** the sandbox read denials are present but `sandbox.enabled` is not set, until a full cloud run has shown that the build still fetches, comments, labels and pushes with it enabled, and the security page lists a process that opens files itself as not covered in the cloud

#### Scenario: A script reads the file
- **WHEN** the agent runs a script that opens `.env` itself on a machine where the sandbox is enabled
- **THEN** the sandbox denial refuses it, and the security page lists such a process as not covered where the sandbox is not enabled

#### Scenario: A file command in a shell
- **WHEN** the agent runs `cat .env`
- **THEN** the `Read` rule refuses it, with or without the sandbox

### Requirement: Antigravity gets exact-path read denials
For Antigravity the denials SHALL be one `read_file` rule for each restricted path that exists in the tree, because the tool documents no globs, and the security page SHALL list the file tool as enforced for those paths and the shell as not covered, because the denial does not reach a command.

#### Scenario: A glob is never written
- **WHEN** the rendered settings are read
- **THEN** every `read_file` denial names a path and none uses `**`, because the tool does not match globs

#### Scenario: The shell reads the file
- **WHEN** an allowed command such as `cat` reads a restricted file
- **THEN** the denial does not stop it, and the security page lists the shell as not covered for this agent

#### Scenario: Two environment files exist
- **WHEN** the tree has `.env` and `api/.env.production`
- **THEN** the rendered settings carry a `read_file` denial for each of them, and none for `.env.example`

### Requirement: An ignore file is not a control
The rendered settings and the documentation SHALL NOT rely on a `.gitignore` entry or on an ignore file that the tool does not document (for example `.claudeignore` or `.claudecode.json`) to hide a file from an agent.

#### Scenario: A tool that names no such file
- **WHEN** Relevo renders the denials for an agent
- **THEN** it writes only settings that the tool's documentation lists as denying a read

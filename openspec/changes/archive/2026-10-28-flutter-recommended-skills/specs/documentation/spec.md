# Spec Delta

## ADDED Requirements

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

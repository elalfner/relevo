# Spec Delta

## MODIFIED Requirements

### Requirement: The stacks page explains the recommended Flutter skills
The stacks page, in both languages, SHALL say that the default set of official Dart and Flutter skills is recommended and never required, give the command that installs it and where it lands, and say that a plugin installed on a machine does not reach the cloud runner while a committed folder does. It SHALL say that `dev` and `qa` receive the set when it is committed, and how to switch a skill off. It SHALL NOT say that Relevo hands no skill to these agents.

#### Scenario: Routes by tool
- **WHEN** the section on Flutter of the stacks page is read
- **THEN** it gives the `npx skills add flutter/agent-plugins` command with `--agent claude-code`, the one with `--agent universal` for the Antigravity CLI, the settings path of the Antigravity IDE, and the two `claude plugin` commands as an optional extra for working on a machine

#### Scenario: Nothing is required
- **WHEN** the section is read
- **THEN** it says that the Flutter profile works without these skills, that `doctor` reports a missing one as a note, and that `init` offers the install as optional

#### Scenario: Cloud runner
- **WHEN** the section is read
- **THEN** it says that a plugin installed on a machine does not reach the cloud runner and that a skills folder committed to the repository does

#### Scenario: Handed to the agents
- **WHEN** the section is read
- **THEN** it says that `dev` and `qa` receive the skills of the set that are committed, that the others are left out with a note, and that `skills.disable` in `.relevo/stacks/flutter.md` switches one off

#### Scenario: Rules and MCP
- **WHEN** the section is read
- **THEN** it says that the official rules are copied by hand into the project's rules file, and that the plugin of Claude Code brings the Dart MCP server while the Antigravity CLI needs `.agents/mcp_config.json`

#### Scenario: Both languages
- **WHEN** the English and the Spanish stacks pages are compared
- **THEN** both carry the same section with the same commands

## ADDED Requirements

### Requirement: The stacks page tells a required skill from a recommended one
The stacks page, in both languages, SHALL say that a skill under `requires_skills` is required and that `doctor` fails when it is missing, that a skill listed under `skills` is given to a role, and that a recommended skill only produces a note. It SHALL say that a stack can use both, and give `supabase` as the example.

#### Scenario: Difference
- **WHEN** the section on skills of the stacks page is read
- **THEN** it says that a required skill missing is a failure, that a recommended one missing is a note, and that a skill can be both required and listed for a role

### Requirement: A page states a rule once
A page of the documentation SHALL NOT repeat the same bullet. A repeated bullet SHALL be removed and the page keeps the place where it belongs.

#### Scenario: Commands that do not rewrite code
- **WHEN** the stacks page is read in either language
- **THEN** the sentence that the commands QA runs never rewrite the code appears once

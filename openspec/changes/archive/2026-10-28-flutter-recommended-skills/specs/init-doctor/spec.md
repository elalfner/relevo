# Spec Delta

## ADDED Requirements

### Requirement: Doctor notes the recommended Dart and Flutter skills
For a repository with a platform of stack `flutter`, `doctor` SHALL report once, for each coding agent the repository uses, whether the official Dart and Flutter skills are available: a pass when they are, a note when they are not, with the install commands. It SHALL report nothing for an agent it cannot check. The agents are Claude Code, and Antigravity when the repository has an Antigravity plugin of Relevo or sets `agent.build: antigravity`.

#### Scenario: Plugin missing in Claude Code
- **WHEN** a platform has stack `flutter`, `claude plugin list --json` answers, and neither the plugin `dart-flutter` nor a skill folder starting with `flutter-` is found
- **THEN** `doctor` reports a note `recommended.flutter.claude` with the commands `claude plugin marketplace add flutter/agent-plugins` and `claude plugin install dart-flutter@dart-flutter`

#### Scenario: Plugin installed
- **WHEN** `claude plugin list --json` lists `dart-flutter`, at the user scope or at the project scope of this repository
- **THEN** `doctor` reports a passed check `recommended.flutter.claude`

#### Scenario: Skills committed to the repository
- **WHEN** a folder starting with `flutter-` exists under `.agents/skills` or `.claude/skills`
- **THEN** `doctor` reports a pass for each agent it applies to, and no note

#### Scenario: Claude Code cannot list its plugins
- **WHEN** `claude plugin list --json` fails or `claude` is not installed, and no folder starting with `flutter-` is found
- **THEN** `doctor` reports no `recommended.flutter.claude` check

#### Scenario: Antigravity in use and skills missing
- **WHEN** the repository has an Antigravity plugin of Relevo or `agent.build` is `antigravity`, and no folder starting with `flutter-` exists under `.agents/skills`
- **THEN** `doctor` reports a note `recommended.flutter.antigravity` with the command `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes`, and says that the Antigravity IDE installs them from its settings, which `doctor` cannot check

#### Scenario: Antigravity not in use
- **WHEN** the repository has no Antigravity plugin of Relevo and `agent.build` is not `antigravity`
- **THEN** `doctor` reports no `recommended.flutter.antigravity` check

#### Scenario: No Flutter platform
- **WHEN** no platform of the repository has stack `flutter`
- **THEN** `doctor` reports no `recommended.flutter` check

### Requirement: A recommended skill never blocks
A recommended skill SHALL NOT be a failure or a warning of `doctor`, SHALL NOT change its exit status, SHALL NOT be listed under `requires_skills` of the Flutter profile, and SHALL NOT stop `go`, `review` or `ship`. Relevo SHALL NOT hand a recommended skill to the `dev` or `qa` agent.

#### Scenario: Everything else passes
- **WHEN** every other check of a Flutter repository passes and the recommended skills are missing
- **THEN** `doctor` exits with status 0 and the report shows one note

#### Scenario: The profile of Flutter
- **WHEN** the profile of `flutter` is resolved
- **THEN** its `requires_skills` is empty and its `skills` lists for `dev`, `qa`, `issue` and `review` are empty

### Requirement: Init offers the recommended Dart and Flutter skills as optional installs
When `init` plans a repository with a platform of stack `flutter` and the skills `doctor` looks for are missing for an agent the repository uses, it SHALL list each install command as an optional install, show its exact text, and run it only after a yes to that command alone. Declining SHALL change nothing else and SHALL NOT make a later step fail. What is not a command SHALL be listed as a manual step. `init` SHALL NOT write the project's rules file or any MCP configuration file.

#### Scenario: Offered for Claude Code
- **WHEN** a Flutter platform is planned, `claude` can list its plugins and `dart-flutter` is not installed
- **THEN** the plan has two optional installs, `claude plugin marketplace add flutter/agent-plugins` and `claude plugin install dart-flutter@dart-flutter`, and nothing runs before the person says yes to each one

#### Scenario: Offered for the Antigravity CLI
- **WHEN** the repository uses Antigravity and no folder starting with `flutter-` exists under `.agents/skills`
- **THEN** the plan has one optional install, `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes`

#### Scenario: Declined
- **WHEN** the person declines an optional install
- **THEN** `init` continues, says the recommendation stays open, and `doctor` keeps the note

#### Scenario: Already installed
- **WHEN** the skills are found for an agent
- **THEN** the plan lists that line as done and offers nothing for it

#### Scenario: Steps that are not commands
- **WHEN** the plan includes the Flutter recommendation because a skill is missing
- **THEN** it lists as a manual step copying the official rules into the project's rules file and, when Antigravity is in use, installing the plugin from the settings of the Antigravity IDE ("Customizations", "Build with Google Plugins", "Dart and Flutter") and adding the Dart MCP server to `.agents/mcp_config.json`; and `init` writes none of them

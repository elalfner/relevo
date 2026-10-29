# Spec Delta

## MODIFIED Requirements

### Requirement: Doctor notes the recommended Dart and Flutter skills
For a repository with a platform of stack `flutter`, `doctor` SHALL report once, for each coding agent the repository uses, whether the default set of official skills of the `flutter` profile is in the repository: a pass when it is, a note when it is not, with the install command. Only a skill folder committed to the repository counts, in `.claude/skills` for Claude Code and in `.agents/skills` for Antigravity, at the root or in the folder of a Flutter platform. A plugin installed on a machine, and the home folder of the person, SHALL NOT count, because the cloud runner does not see them. The agents are Claude Code, and Antigravity when the repository has an Antigravity plugin of Relevo or sets `agent.build: antigravity`.

#### Scenario: Plugin missing in Claude Code
- **WHEN** a platform has stack `flutter` and none of the skills of the default set is under `.claude/skills` at the root or in the folder of a Flutter platform
- **THEN** `doctor` reports a note `recommended.flutter.claude` with the install command for Claude Code, and says that the cloud runner reads only what is committed

#### Scenario: Plugin installed
- **WHEN** `claude plugin list --json` lists `dart-flutter` at the user scope or at the project scope of this repository, and no skill of the default set is committed
- **THEN** `doctor` reports the note `recommended.flutter.claude` and says that the plugin works on this machine and does not reach the cloud runner

#### Scenario: Claude Code cannot list its plugins
- **WHEN** `claude plugin list --json` fails or `claude` is not installed, and no skill of the default set is committed
- **THEN** `doctor` still reports the note `recommended.flutter.claude`, without the sentence about the plugin, because it judges the committed folders and not the plugin

#### Scenario: Skills committed to the repository
- **WHEN** every skill of the default set is a folder under `.claude/skills` of the root or of a Flutter platform
- **THEN** `doctor` reports a pass `recommended.flutter.claude`, and no note

#### Scenario: Only `.agents/skills` and Claude Code
- **WHEN** the skills are under `.agents/skills` and not under `.claude/skills`
- **THEN** `doctor` reports a pass for Antigravity when it is in use, and still reports the note `recommended.flutter.claude`

#### Scenario: Skills in the home folder
- **WHEN** the skills are only under `~/.claude/skills`
- **THEN** `doctor` treats them as missing

#### Scenario: Antigravity in use and skills missing
- **WHEN** the repository has an Antigravity plugin of Relevo or `agent.build` is `antigravity`, and the default set is not under `.agents/skills`
- **THEN** `doctor` reports a note `recommended.flutter.antigravity` with the command `npx skills add flutter/agent-plugins` naming each skill of the set with `--agent universal --yes`, and says that the Antigravity IDE installs them from its settings, which `doctor` cannot check

#### Scenario: Antigravity not in use
- **WHEN** the repository has no Antigravity plugin of Relevo and `agent.build` is not `antigravity`
- **THEN** `doctor` reports no `recommended.flutter.antigravity` check

#### Scenario: No Flutter platform
- **WHEN** no platform of the repository has stack `flutter`
- **THEN** `doctor` reports no `recommended.flutter` check

### Requirement: A recommended skill never blocks
A recommended skill SHALL NOT be a failure or a warning of `doctor`, SHALL NOT change its exit status, SHALL NOT be listed under `requires_skills` of the Flutter profile, and SHALL NOT stop `go`, `review` or `ship`. A skill of the default set that the repository lacks SHALL be left out of the run and reported once as a note.

#### Scenario: Everything else passes
- **WHEN** every other check of a Flutter repository passes and the default skills are missing
- **THEN** `doctor` exits with status 0 and the report shows one note

#### Scenario: The profile of Flutter
- **WHEN** the profile of `flutter` is resolved
- **THEN** its `requires_skills` is empty, its `skills` lists for `dev` and `qa` name the default set, and its lists for `issue` and `review` are empty

#### Scenario: Run without the skills
- **WHEN** `go` runs on a Flutter repository that has none of the default skills
- **THEN** the run is not stopped, `dev` and `qa` receive no skill, and the output of the resolution says which skills were left out and why

### Requirement: Init offers the recommended Dart and Flutter skills as optional installs
When `init` plans a repository with a platform of stack `flutter` and skills of the default set are missing, it SHALL list one optional install per platform folder, run from that folder, naming each missing skill, and run it only after a yes to that command alone. The command writes real files, not links, under `.claude/skills/` for Claude Code and under `.agents/skills/` for Antigravity when it is in use. It SHALL tell the person to commit what was written, with `skills-lock.json`. Declining SHALL change nothing else and SHALL NOT make a later step fail. What is not a command SHALL be a manual step. `init` SHALL NOT write the project's rules file or any MCP configuration file, and SHALL NOT offer the plugin of Claude Code.

#### Scenario: Offered for Claude Code
- **WHEN** a Flutter platform with `path: app` is planned and the default skills are not under `app/.claude/skills`
- **THEN** the plan has an optional install `npx skills add flutter/agent-plugins` with each missing skill, `--agent claude-code --copy` and `--yes`, to run from `app`, and nothing runs before the person says yes to it

#### Scenario: Two Flutter platforms
- **WHEN** two platforms have stack `flutter` with different paths
- **THEN** the plan has one optional install per folder, and a platform whose path is `.` installs at the root

#### Scenario: Offered for the Antigravity CLI
- **WHEN** the repository uses Antigravity and the default skills are not under `.agents/skills`
- **THEN** the plan has one more optional install with `--agent universal`

#### Scenario: Declined
- **WHEN** the person declines an optional install
- **THEN** `init` continues, says the recommendation stays open, and `doctor` keeps the note

#### Scenario: Already installed
- **WHEN** the skills are found in the folder
- **THEN** the plan lists that line as done and offers nothing for it

#### Scenario: Steps that are not commands
- **WHEN** the plan includes the Flutter recommendation because a skill is missing
- **THEN** it lists as manual steps copying the official rules into the project's rules file, committing the new folder and `skills-lock.json`, and, when Antigravity is in use, installing the plugin from the settings of the Antigravity IDE and adding the Dart MCP server to `.agents/mcp_config.json`; and `init` writes none of them

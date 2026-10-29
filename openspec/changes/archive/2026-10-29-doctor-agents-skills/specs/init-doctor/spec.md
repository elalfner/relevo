# Spec Delta

## MODIFIED Requirements

### Requirement: Doctor notes the recommended Dart and Flutter skills
For a repository with a platform of stack `flutter`, `doctor` SHALL report once, for each coding agent the repository uses, whether the default set of official skills of the `flutter` profile is in the repository: a pass when it is, a note when it is not, with the install command. Only a skill folder committed to the repository counts, at the root or in the folder of a Flutter platform: `.claude/skills` and `.agents/skills` for Claude Code, because `go` hands the agents the path of each `SKILL.md` from either, and `.agents/skills` for Antigravity. A plugin installed on a machine, and the home folder of the person, SHALL NOT count, because the cloud runner does not see them. The agents are Claude Code, and Antigravity when the repository has an Antigravity plugin of Relevo or sets `agent.build: antigravity`.

#### Scenario: Plugin missing in Claude Code
- **WHEN** a platform has stack `flutter` and none of the skills of the default set is under `.claude/skills` or `.agents/skills` at the root or in the folder of a Flutter platform
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
- **THEN** `doctor` reports a pass `recommended.flutter.claude`, because `go` gives `dev` and `qa` the paths from that folder, and a pass for Antigravity when it is in use

#### Scenario: Skills split between the two folders
- **WHEN** one skill of the set is under `.claude/skills` and the other under `.agents/skills`
- **THEN** `doctor` reports a pass `recommended.flutter.claude`

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

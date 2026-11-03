## MODIFIED Requirements

### Requirement: One source renders a plugin for each tool
Relevo SHALL render a plugin for a tool other than Claude Code from the files in `skills/`, `agents/`, `scripts/`, `stacks/`, `knowledge/` and `templates/`, with one renderer per tool, and SHALL NOT change what the Claude Code plugin installs.

#### Scenario: Rendering for Antigravity
- **WHEN** the Antigravity renderer runs
- **THEN** it writes `plugin.json` with the name `relevo` and the package version, one `SKILL.md` per skill, the agents `relevo-dev` and `relevo-qa`, and a copy of the scripts, stacks, knowledge and templates

#### Scenario: Claude Code unaffected
- **WHEN** the package is packed after the renderer exists
- **THEN** no file of the Claude plugin is removed or renamed, its manifest and agents are unchanged, its skills differ only by the question that `init` asks about the agent, and the new files are additions

#### Scenario: The scripts find the knowledge
- **WHEN** a script of the rendered plugin selects interface rules
- **THEN** it finds the knowledge folder next to the scripts, as it does in the Claude plugin

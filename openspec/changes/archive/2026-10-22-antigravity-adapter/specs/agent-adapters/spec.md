## ADDED Requirements

### Requirement: One source renders a plugin for each tool
Relevo SHALL render a plugin for a tool other than Claude Code from the files in `skills/`, `agents/`, `scripts/`, `stacks/` and `templates/`, with one renderer per tool, and SHALL NOT change what the Claude Code plugin installs.

#### Scenario: Rendering for Antigravity
- **WHEN** the Antigravity renderer runs
- **THEN** it writes `plugin.json` with the name `relevo` and the package version, one `SKILL.md` per skill, the agents `relevo-dev` and `relevo-qa`, and a copy of the scripts, stacks and templates

#### Scenario: Claude Code unaffected
- **WHEN** the package is packed after the renderer exists
- **THEN** no file of the Claude plugin is removed or renamed, its manifest and agents are unchanged, its skills differ only by the question that `init` asks about the agent, and the new files are additions

### Requirement: Names and text are rewritten for the tool
A rendered file SHALL name commands and agents the way the tool does and SHALL contain no Claude Code token: commands keep `/relevo:<name>` through the plugin name, agents are `relevo-dev` and `relevo-qa`, and scripts are called by absolute path.

#### Scenario: No Claude token remains
- **WHEN** every rendered file is scanned
- **THEN** none contains `${CLAUDE_PLUGIN_ROOT}`, `relevo:dev`, `relevo:qa` or a Claude-only agent key (`model`, `effort`, `disallowedTools`), and a test fails if one does

#### Scenario: Script calls
- **WHEN** a skill text called a script of the package
- **THEN** the rendered text calls `node` with the absolute path of that script inside the rendered plugin, with the same arguments

#### Scenario: Subagent delegation uses reactive wakeup
- **WHEN** the skill `go` is rendered for Antigravity
- **THEN** the text instructs the agent to yield its turn without polling tools like `manage_subagents` while waiting for the subagent's report message

### Requirement: Skills that only a person may start stay reserved
A skill that is reserved for a person in Claude Code SHALL keep `disable-model-invocation: true` in the rendered plugin.

#### Scenario: A reserved skill
- **WHEN** the skill `go` is rendered
- **THEN** its frontmatter has `disable-model-invocation: true` and a test fails if any of the reserved skills loses it

### Requirement: Agents are rendered with an explicit tool list
A rendered agent SHALL list its tools explicitly as a YAML list of the tool's own names, the QA agent SHALL list no tool that writes or edits files, and the renderer SHALL refuse a tool it cannot map.

#### Scenario: QA is read-only
- **WHEN** `relevo-qa` is rendered
- **THEN** its tool list contains the command tool and no write or edit tool

#### Scenario: Bash tool mapping
- **WHEN** Claude's `Bash` tool is mapped to Antigravity
- **THEN** it maps to `run_command` only and excludes unsupported tools such as `command_status`

#### Scenario: Unknown tool
- **WHEN** the renderer meets a Claude tool with no mapping
- **THEN** it stops, names the tool and writes nothing

### Requirement: The rendered plugin is installed and kept current
`relevo init` SHALL install the rendered plugin into the project (`.agents/plugins/relevo/`) or the machine (`agy plugin install`), SHALL record the tool, the package version and a hash of each file in the plugin folder, `update` SHALL render again, and a file edited by hand SHALL be reported and not overwritten without `--force`.

#### Scenario: Update after a new version
- **WHEN** `relevo update` runs with a newer package
- **THEN** the plugin is rendered again and the recorded version is the new one

#### Scenario: A hand-edited file
- **WHEN** a rendered file's hash differs from the record
- **THEN** `update` reports it and leaves it, and `doctor` warns

### Requirement: The agent run is limited by a guard
A cloud run of an agent that has no limits of its own SHALL be started through the run guard, which SHALL stop the run when `limits.run_max_turns`, `limits.run_max_tokens` or its time limit is reached, SHALL fail the run when the agent reports a refused tool, and SHALL report which limit stopped it.

#### Scenario: Step limit reached
- **WHEN** the event stream shows more agent steps than `limits.run_max_turns`
- **THEN** the guard kills the agent's process group and exits with the code that means a limit was reached

#### Scenario: A refused tool
- **WHEN** the agent exits 0 but the final event lists a denied action
- **THEN** the guard fails the run and names the action

#### Scenario: No output
- **WHEN** the agent prints nothing until its time limit
- **THEN** the guard ends it and the run reports that it produced no outcome

### Requirement: The Antigravity cloud build is closed
The Antigravity workflow SHALL be the shared workflow with its marked model step replaced, and that step SHALL run the agent with user-level settings written on the runner that deny web access and allow only the listed commands, through the guard, with a job timeout and a key from the secret store, and SHALL NOT accept `limits.run_max_cost`.

#### Scenario: Reading the workflow
- **WHEN** a person reads the workflow rendered for `agent.build: antigravity`
- **THEN** the allow list, the deny rules, the guard limits, the timeout and the secret name are visible and no key is written in it

#### Scenario: A cost limit with Antigravity
- **WHEN** `relevo.yml` sets `agent.build: antigravity` and `limits.run_max_cost`
- **THEN** validation fails and says that no cost limit exists for this agent and that `limits.run_max_tokens` and the project's quota are the ceiling

#### Scenario: One source
- **WHEN** the workflow is rendered for Claude and for Antigravity
- **THEN** the two differ only inside the marked model step, and a test fails if the markers are missing, repeated, or if anything else differs

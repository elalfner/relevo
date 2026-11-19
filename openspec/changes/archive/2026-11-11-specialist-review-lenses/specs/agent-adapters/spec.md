## MODIFIED Requirements

### Requirement: Names and text are rewritten for the tool
A rendered file SHALL name commands and agents the way the tool does and SHALL contain no Claude Code token: commands keep `/relevo:<name>` through the plugin name, agents are `relevo-dev`, `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code` and `relevo-qa-interface`, and scripts are called by absolute path.

#### Scenario: No Claude token remains
- **WHEN** every rendered file is scanned
- **THEN** none contains `${CLAUDE_PLUGIN_ROOT}`, `relevo:dev`, a `relevo:qa-` name or a Claude-only agent key (`model`, `effort`, `disallowedTools`), and a test fails if one does

#### Scenario: Script calls
- **WHEN** a skill text called a script of the package
- **THEN** the rendered text calls `node` with the absolute path of that script inside the rendered plugin, with the same arguments

#### Scenario: Subagent delegation uses reactive wakeup
- **WHEN** the skill `go` is rendered for Antigravity
- **THEN** the text instructs the agent to yield its turn without polling tools like `manage_subagents` while waiting for the subagent's report message

### Requirement: Agents are rendered with an explicit tool list
A rendered agent SHALL list its tools explicitly as a YAML list of the tool's own names, each lens agent SHALL list no tool that writes or edits files, and the renderer SHALL refuse a tool it cannot map.

#### Scenario: QA is read-only
- **WHEN** a lens agent such as `relevo-qa-security` is rendered
- **THEN** its tool list contains the command tool and no write or edit tool

#### Scenario: Bash tool mapping
- **WHEN** Claude's `Bash` tool is mapped to Antigravity
- **THEN** it maps to `run_command` only and excludes unsupported tools such as `command_status`

#### Scenario: Unknown tool
- **WHEN** the renderer meets a Claude tool with no mapping
- **THEN** it stops, names the tool and writes nothing

## ADDED Requirements

### Requirement: Every lens agent renders with a valid name
The renderer SHALL write the four lens agents with the names `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code` and `relevo-qa-interface`, SHALL rewrite every reference to them in the skills, and a test SHALL fail when an agent file of the plugin renders to an invalid name.

#### Scenario: Rendering the lenses
- **WHEN** the Antigravity renderer runs
- **THEN** the four lens agents are written with those names and no `relevo:qa-` token remains

#### Scenario: A new agent file
- **WHEN** an agent file is added to the plugin
- **THEN** the test checks that it renders to a valid name

### Requirement: With Antigravity the lenses are called one at a time
In this version the rendered `go`, `fix` and `review` SHALL call the lens agents one at a time and wait for each report before the next, as they do for the developer agent.

#### Scenario: Several lenses
- **WHEN** four lenses are active
- **THEN** the rendered text calls the first, ends its turn until the report arrives, and then calls the next

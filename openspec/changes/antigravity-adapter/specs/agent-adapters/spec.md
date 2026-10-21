## ADDED Requirements

### Requirement: One source renders to each tool
Relevo SHALL render its skills and its `dev` and `qa` agents for a tool other than Claude Code from the files in `skills/` and `agents/`, with one renderer per tool, and SHALL NOT change what the Claude Code plugin installs.

#### Scenario: Rendering for Antigravity
- **WHEN** the Antigravity renderer runs
- **THEN** each skill produces `relevo-<name>/SKILL.md` and each agent produces `relevo-dev.md` or `relevo-qa.md`, and nothing is written for Claude

#### Scenario: Claude Code unaffected
- **WHEN** the package is packed after the renderer exists
- **THEN** the files the plugin installs are the same as before

### Requirement: Names and text are rewritten for the tool
A generated file SHALL name commands and agents the way the tool does (`/relevo-go`, `relevo-dev`) and SHALL contain no Claude Code token.

#### Scenario: No Claude token remains
- **WHEN** every generated file is scanned
- **THEN** none contains `${CLAUDE_PLUGIN_ROOT}`, `$ARGUMENTS`, `relevo:` followed by a name, or a frontmatter key that only Claude Code understands, and a test fails if one does

#### Scenario: Arguments
- **WHEN** a skill used `$ARGUMENTS`
- **THEN** the generated text says that the argument is what the person typed after the command name

### Requirement: Skills that only a person may start say so
For each skill that is reserved for a person in Claude Code, the generated skill SHALL state in its description and in its first line that it runs only when the person types its command, and SHALL otherwise stop and ask. The security page SHALL say that the tool does not enforce this.

#### Scenario: A reserved skill
- **WHEN** `relevo-go` is generated
- **THEN** its description says it runs only when the person types `/relevo-go`, and its body begins with the instruction to stop if it was not started that way

### Requirement: Generated text calls scripts through the package
Generated files SHALL run scripts with `relevo run <name>`, and `relevo run` SHALL run the script of the installed package and say which package version it used.

#### Scenario: A script call
- **WHEN** a skill text calls a script of the package
- **THEN** the generated text calls `relevo run <name>` with the same arguments

#### Scenario: A script that does not exist
- **WHEN** `relevo run` is given a name the package does not contain
- **THEN** it exits non-zero and names the missing script

### Requirement: Agents are rendered with an explicit tool list
A generated subagent SHALL list its tools explicitly, the QA subagent SHALL list no tool that writes or edits files, and the renderer SHALL refuse a tool name that the installed tool does not know.

#### Scenario: QA is read-only
- **WHEN** `relevo-qa` is generated
- **THEN** its tool list contains no write or edit tool

#### Scenario: Unknown tool name
- **WHEN** the renderer maps a tool that the target does not have
- **THEN** it stops, names the tool and writes nothing

### Requirement: Generated files are tracked and kept current
Every file Relevo generates SHALL be listed with its package version and hash in a manifest; `update` SHALL regenerate the files and remove the ones the new version no longer produces; and a file edited by hand SHALL be reported and not overwritten without `--force`.

#### Scenario: Update after a new version
- **WHEN** `relevo update` runs and a skill no longer exists in the new version
- **THEN** its file is deleted and the manifest no longer lists it

#### Scenario: A hand-edited file
- **WHEN** a generated file's hash differs from the manifest
- **THEN** `update` reports it and leaves it, and `doctor` warns

### Requirement: The agent run is limited by a guard
A cloud run of an agent that has no limits of its own SHALL be started through the run guard, which SHALL stop the run when `limits.run_max_turns`, `limits.run_max_tokens` or its time limit is reached, SHALL fail the run when the agent reports a refused tool, and SHALL report which limit stopped it.

#### Scenario: Turn limit reached
- **WHEN** the agent's event stream shows more turns than `limits.run_max_turns`
- **THEN** the guard kills the agent's process group and exits with the code that means a limit was reached

#### Scenario: A refused tool
- **WHEN** the agent exits 0 but reported a refused tool on its error output
- **THEN** the guard fails the run and names the tool

#### Scenario: No output
- **WHEN** the agent prints nothing until its own timeout
- **THEN** the guard ends it at the time limit and the run reports that it produced no outcome

### Requirement: The Antigravity cloud build is closed
The Antigravity workflow SHALL be the shared workflow with its marked model step replaced, and that step SHALL run the agent with user-level settings written on the runner that deny web access and allow only the listed commands, through the guard, with a job timeout and a credential from the secret store, and SHALL NOT accept `limits.run_max_cost`.

#### Scenario: Reading the template
- **WHEN** a person reads the workflow rendered for `agent.build: antigravity`
- **THEN** the allow list, the deny rules, the guard limits, the timeout and the secret name are visible and no key is written in it

#### Scenario: A cost limit with Antigravity
- **WHEN** `relevo.yml` sets `agent.build: antigravity` and `limits.run_max_cost`
- **THEN** validation fails and says that no cost limit exists for this agent and that `limits.run_max_tokens` and the project's quota are the ceiling

#### Scenario: One source
- **WHEN** the workflow is rendered for Claude and for Antigravity
- **THEN** the two differ only inside the marked model step, and a test fails if the markers are missing, repeated, or if anything else differs

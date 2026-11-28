# agent-adapters Specification

## Purpose

Renders Relevo for tools other than Claude Code from one source of skills, agents and scripts, installs and updates the rendered plugin, and limits the agent run with a guard, so that a team can use Relevo with Antigravity without a second copy to maintain.

## Requirements

### Requirement: One source renders a plugin for each tool
Relevo SHALL render a plugin for a tool other than Claude Code from the files in `skills/`, `agents/`, `scripts/`, `stacks/`, `knowledge/` and `templates/`, with one renderer per tool, including native root `hooks.json` for Antigravity, and SHALL NOT change what the Claude Code plugin installs.

#### Scenario: Rendering for Antigravity
- **WHEN** the Antigravity renderer runs
- **THEN** it writes `plugin.json` with the name `relevo` and the package version, root `hooks.json`, one `SKILL.md` per skill, the agents `relevo-dev`, `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code`, `relevo-qa-interface` and `relevo-qa-bugs`, and a copy of the scripts, stacks, knowledge and templates

#### Scenario: Claude Code unaffected
- **WHEN** the package is packed after the renderer exists
- **THEN** no file of the Claude plugin is removed or renamed, its manifest, hooks and agents are unchanged, its skills differ only by the question that `init` asks about the agent, and the new files are additions

#### Scenario: The scripts find the knowledge
- **WHEN** a script of the rendered plugin selects interface rules
- **THEN** it finds the knowledge folder next to the scripts, as it does in the Claude plugin

### Requirement: Names and text are rewritten for the tool
A rendered file SHALL name commands and agents the way the tool does and SHALL contain no Claude Code token or Claude-only workflow phrase: commands keep `/relevo:<name>` through the plugin name, agents are `relevo-dev`, `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code`, `relevo-qa-interface` and `relevo-qa-bugs`, scripts are called by absolute path, `go` syncs its `--local` and interactive instructions with Antigravity, and `think` checks Antigravity `1.5.18` global skill directories.

#### Scenario: No Claude token remains
- **WHEN** every rendered file (including `qa-run.md`, `go/SKILL.md`, `fix/SKILL.md` and `review/SKILL.md`) is scanned
- **THEN** none contains `${CLAUDE_PLUGIN_ROOT}`, `relevo:dev`, a `relevo:qa-` name, Claude-only agent keys (`model`, `effort`, `disallowedTools`), or Claude-only phrases (`Agent` tool, Claude `effort` launch parameters, mandatory `<usage>` block), and a test fails if one does

#### Scenario: Script calls
- **WHEN** a skill text called a script of the package
- **THEN** the rendered text calls `node` with the absolute path of that script inside the rendered plugin, with the same arguments

#### Scenario: Subagent delegation uses reactive wakeup
- **WHEN** the skill `go` is rendered for Antigravity
- **THEN** the text instructs the agent to yield its turn without polling tools like `manage_subagents` while waiting for subagent report messages

#### Scenario: Synced local and interactive go instructions
- **WHEN** a person runs `/relevo:go <n> --local` or interactive `/relevo:go <n>` in Antigravity
- **THEN** the rendered `--local` instructions launch `go-local.mjs` in the background forwarding `--retry`/`--resume`, print `go-local.mjs status <n>`, and end with `next-step.mjs --conversation`; and interactive mode prints `next-step.mjs --build-warning --issue <n>` and isolates execution in a `Workspace: 'share'` subagent with a `schedule` watchdog

#### Scenario: Global skill discovery in Antigravity think
- **WHEN** `/relevo:think` is rendered for Antigravity
- **THEN** its skill check looks in `~/.agents/skills` and `~/.gemini/config/skills` in addition to existing skill folders

### Requirement: Skills that only a person may start stay reserved
A skill that is reserved for a person in Claude Code SHALL keep `disable-model-invocation: true` in the rendered plugin.

#### Scenario: A reserved skill
- **WHEN** the skill `go` is rendered
- **THEN** its frontmatter has `disable-model-invocation: true` and a test fails if any of the reserved skills loses it

### Requirement: Agents are rendered with an explicit tool list
A rendered agent SHALL list its tools explicitly as a YAML list of the tool's own names verified against `agy 1.5.18`, each lens agent SHALL list no tool that writes or edits files, the rendered plugin SHALL pass `agy plugin validate`, and the renderer SHALL refuse a tool it cannot map.

#### Scenario: QA is read-only
- **WHEN** a lens agent such as `relevo-qa-security` is rendered
- **THEN** its tool list contains the command tool and no write or edit tool

#### Scenario: Bash tool mapping
- **WHEN** Claude's `Bash` tool is mapped to Antigravity
- **THEN** it maps to `run_command` only and excludes unsupported tools such as `command_status`

#### Scenario: Verified against agy 1.5.18
- **WHEN** `renderAntigravity` renders the plugin and live validation runs against `agy 1.5.18`
- **THEN** `agents/relevo-*.md` lists only tools reported in `agy 1.5.18` `init.tools` and passes `agy plugin validate`

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

### Requirement: Every lens agent renders with a valid name
The renderer SHALL write the five lens agents with the names `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code`, `relevo-qa-interface` and `relevo-qa-bugs`, SHALL rewrite every reference to them in the skills, and a test SHALL fail when an agent file of the plugin renders to an invalid name.

#### Scenario: Rendering the lenses
- **WHEN** the Antigravity renderer runs
- **THEN** the five lens agents are written with those names and no `relevo:qa-` token remains

#### Scenario: A new agent file
- **WHEN** an agent file is added to the plugin
- **THEN** the test checks that it renders to a valid name

### Requirement: Empirical agy 1.5.18 spike precedes adapter assumptions
No Antigravity tool name, model tier mapping, hook payload assumption, or sandbox assumption SHALL change without empirical `agy 1.5.18` evidence recorded in `docs/pilot-findings.md`.

#### Scenario: Spike records agy 1.5.18 findings
- **WHEN** the `agy 1.5.18` spike runs (`RELEVO_AGY_CHECK=1` and targeted probes)
- **THEN** `docs/pilot-findings.md` records the `init` tool registry, the real mapping of `invoke_subagent` `pro`/`flash` tiers under `gemini-4-neon-high`, `--model` + `--effort` interaction, `--settings` with cached subscription login, whether `--sandbox` allows `git` and `gh`, `stream-json` subagent/usage fields, and the live `PreToolUse` payload structure

### Requirement: With Antigravity the lenses run in parallel with a batch watchdog
In Antigravity, rendered `go`, `fix`, `review`, and `qa-run.md` SHALL launch all active QA lenses of a batch in parallel in one turn via `invoke_subagent`, guard the batch with a `schedule` watchdog, collect reports via reactive wakeup without polling, terminate each finished lens with `manage_subagents`, and retry only a failed or timed-out lens once while preserving completed reports.

#### Scenario: Multiple active lenses run in parallel
- **WHEN** `/relevo:go`, `/relevo:fix`, or `/relevo:review` runs QA in Antigravity with multiple active lenses
- **THEN** the rendered instructions launch all active lenses in the batch in parallel in one turn via `invoke_subagent`, set a batch watchdog via `schedule`, collect reports via reactive wakeup without polling, and kill each finished subagent with `manage_subagents`

#### Scenario: Single lens fails or hangs while siblings finish
- **WHEN** one QA lens fails or hangs while sibling lenses in the same batch finish
- **THEN** the batch watchdog fires, only the stalled or failed lens is killed and retried once, and all completed sibling reports are preserved

### Requirement: Antigravity enforces run time limits with a native PreToolUse hook
The Antigravity renderer SHALL write a native `hooks.json` at `<plugin_dir>/hooks.json` (never `hooks/hooks.json`) that invokes `time-guard.mjs` on Antigravity `PreToolUse`. `time-guard.mjs` SHALL handle both Claude Code (`tool_name`/`tool_input`) and Antigravity (`toolCall.name`/`toolCall.args`, camelCase) payloads, returning `{ "decision": "deny", "reason": ... }` for Antigravity when refusing a launch after `limits.run_max_minutes` or a subagent tool call after the hard stop.

#### Scenario: Hook file placed at plugin root
- **WHEN** `renderAntigravity` renders the plugin
- **THEN** `hooks.json` is written at `<plugin_dir>/hooks.json` and never at `hooks/hooks.json`

#### Scenario: Antigravity PreToolUse refusal
- **WHEN** a Relevo run in Antigravity reaches `limits.run_max_minutes` or its hard stop and `PreToolUse` sends an Antigravity camelCase payload to `time-guard.mjs`
- **THEN** `time-guard.mjs` returns `{ "decision": "deny", "reason": ... }` to stop further Relevo subagent launches or subagent tool calls

#### Scenario: Claude Code PreToolUse compatibility
- **WHEN** `time-guard.mjs` receives a Claude Code `PreToolUse` payload (`tool_name`/`tool_input`)
- **THEN** it evaluates and responds with `hookSpecificOutput` unchanged without breaking Claude Code

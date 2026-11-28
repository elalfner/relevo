# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: With Antigravity the lenses are called one at a time
**Reason**: Sequential lens execution slowed every QA round and prevented parity with Claude Code's parallel QA batches.
**Migration**: Replaced by `With Antigravity the lenses run in parallel with a batch watchdog`, launching active lenses per batch in one turn via `invoke_subagent` with a `schedule` watchdog and single-lens retry.

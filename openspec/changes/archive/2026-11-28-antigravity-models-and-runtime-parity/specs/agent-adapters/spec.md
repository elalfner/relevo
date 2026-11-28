# Spec Delta

## MODIFIED Requirements

### Requirement: Names and text are rewritten for the tool
A rendered file SHALL name commands and agents the way the tool does and SHALL contain no Claude Code token or Claude-only workflow phrase: commands keep `/relevo:<name>` through the plugin name, agents are `relevo-dev`, `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code`, `relevo-qa-interface` and `relevo-qa-bugs`, scripts are called by absolute path, `go` syncs its `--local` (passing `--agent antigravity`) and interactive instructions with Antigravity, subagent launches in `go`, `qa-run.md`, `fix`, and `review` pass native `invoke_subagent` `Model` tiers (`flash_lite`, `flash`, `pro`, `inherit`) from `model-plan.mjs` without `effort`, and `think` checks Antigravity `1.5.18` global skill directories.

#### Scenario: No Claude token remains
- **WHEN** every rendered file (including `qa-run.md`, `go/SKILL.md`, `fix/SKILL.md` and `review/SKILL.md`) is scanned
- **THEN** none contains `${CLAUDE_PLUGIN_ROOT}`, `relevo:dev`, a `relevo:qa-` name, Claude-only agent keys (`model`, `effort`, `disallowedTools`), or Claude-only phrases (`Agent` tool, Claude `effort` launch parameters, mandatory `<usage>` block), and a test fails if one does

#### Scenario: Script calls
- **WHEN** a skill text called a script of the package
- **THEN** the rendered text calls `node` with the absolute path of that script inside the rendered plugin, with the same arguments

#### Scenario: Subagent delegation uses reactive wakeup
- **WHEN** the skills `go`, `fix`, `review`, and `qa-run.md` are rendered for Antigravity
- **THEN** the text instructs the agent to launch `relevo-dev` and each QA lens via `invoke_subagent` with `Model` set to the planned native tier (`flash_lite`, `flash`, `pro`, `inherit`, defaulting to `inherit` for non-tier names) and no `effort` parameter, and to yield its turn without polling tools like `manage_subagents` while waiting for subagent report messages

#### Scenario: Synced local and interactive go instructions
- **WHEN** a person runs `/relevo:go <n> --local` or interactive `/relevo:go <n>` in Antigravity
- **THEN** the rendered `--local` instructions launch `go-local.mjs <n> --agent antigravity` in the background forwarding `--retry`/`--resume`, print `go-local.mjs status <n>`, and end with `next-step.mjs --conversation`; and interactive mode prints `next-step.mjs --build-warning --issue <n>` and isolates execution in a `Workspace: 'share'` subagent with a `schedule` watchdog

#### Scenario: Global skill discovery in Antigravity think
- **WHEN** `/relevo:think` is rendered for Antigravity
- **THEN** its skill check looks in `~/.agents/skills` and `~/.gemini/config/skills` in addition to existing skill folders

### Requirement: The agent run is limited by a guard
A cloud or local run of an agent that has no limits of its own SHALL be started through the run guard, which SHALL pass `--model` and `--effort` to `agy -p` for base slugs from `agents.antigravity.main` (omitting `--effort` when the model slug already carries an effort suffix `-low`, `-medium`, `-high`, `-xhigh`, or `-max`), SHALL pass per-session `--settings <file>` without `--sandbox` (including `modelProvider: 'gemini'` only in cloud or when `GEMINI_API_KEY` is set, and omitting it locally for cached subscription login), SHALL NEVER add `command(agy)` to `BASE_PROGRAMS` or the allowlist, SHALL stop the run when `limits.run_max_turns`, `limits.run_max_tokens` or its time limit is reached, SHALL fail the run when the agent reports a refused tool, SHALL report which limit stopped it, and SHALL record per-subagent turns and tokens in its summary.

#### Scenario: Base slug passes model and effort
- **WHEN** `agent-guard.mjs run` starts `agy -p` with `agents.antigravity.main` set to `{ model: gemini-4-neon, effort: high }`
- **THEN** `agy -p` receives `--model gemini-4-neon --effort high`, receives `--settings <file>` when provided, and does not receive `--sandbox`

#### Scenario: Effort-suffixed model omits effort flag
- **WHEN** `agent-guard.mjs run` starts `agy -p` with `agents.antigravity.main` set to `{ model: gemini-4-neon-high, effort: low }`
- **THEN** `agy -p` receives `--model gemini-4-neon-high` and omits `--effort` so `agy 1.5.18` does not exit 1 on a flag conflict

#### Scenario: Local settings omit modelProvider when GEMINI_API_KEY is unset
- **WHEN** `agySettings` generates settings for a local run with `GEMINI_API_KEY` unset
- **THEN** the settings JSON omits `modelProvider`, keeps the denied web and exact-path `read_file` rules and allowed stack commands, and never includes `command(agy)`

#### Scenario: Cloud or API-key settings include modelProvider
- **WHEN** `agySettings` generates settings for a cloud run or when `GEMINI_API_KEY` is set
- **THEN** the settings JSON includes `modelProvider: "gemini"` and never includes `command(agy)`

#### Scenario: Per-subagent turns and tokens recorded in summary
- **WHEN** an Antigravity run emits `init`, `step_type: "subagent"` (`invoke_subagent`), and `agent_response` steps across main and subagent conversations
- **THEN** the guard summary records both the overall totals and an `agents` array with per-agent `name`, optional `launch`/`model`, `turns`, and `tokens`

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
The Antigravity workflow SHALL be the shared workflow with its marked model step replaced, and that step SHALL install `agy 1.5.18+` pinned by version, URL and verified SHA-512, SHALL generate per-session settings written under `$RUNNER_TEMP` (denying web access and exact-path restricted files, allowing only the listed commands, never `command(agy)`) and pass them via `--settings` without `--sandbox`, SHALL run the agent through the guard with `--model`/`--effort` from `relevo.yml`, a job timeout, and `GEMINI_API_KEY` from the secret store, SHALL allow `limits.run_max_cost` to coexist in `relevo.yml` alongside mandatory `limits.run_max_tokens`, and SHALL continue rejecting `trust: public`.

#### Scenario: Reading the workflow
- **WHEN** a person reads the workflow rendered for `agent.build: antigravity`
- **THEN** the pinned `agy 1.5.18+` version and SHA-512 check, per-session `--settings` generation and flag, absence of `--sandbox`, guard limits, timeout, and `GEMINI_API_KEY` secret name are visible and no key is written in it

#### Scenario: A cost limit with Antigravity
- **WHEN** `relevo.yml` sets `agent.build: antigravity`, `limits.run_max_tokens: 2000000` and `limits.run_max_cost: 5`
- **THEN** validation passes (validating both limits' types and ranges) and the cloud build enforces `limits.run_max_tokens` through the guard while leaving `limits.run_max_cost` available for Claude Code coexistence

#### Scenario: Public trust stays refused with Antigravity
- **WHEN** `relevo.yml` sets `agent.build: antigravity` and `trust: public`
- **THEN** validation fails explaining that `trust: public` is not supported with `agent.build: antigravity` yet

#### Scenario: One source
- **WHEN** the workflow is rendered for Claude and for Antigravity
- **THEN** the two differ only inside the marked model step, and a test fails if the markers are missing, repeated, or if anything else differs

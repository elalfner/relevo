# agent-settings Specification

## Purpose
Lets a project choose the model and the effort of the developer agent and of each lens, with defaults, and makes sure that a setting an agent cannot apply is said so and never looks effective.

## Requirements

### Requirement: The developer agent and each lens have a model and an effort
There SHALL be a model and an effort for the developer agent and for each of the lenses `spec`, `security`, `code`, `interface` and `bugs`, plus an optional main session setting (`agents.main`), taken from tool-scoped `agents.<tool>` when set, falling back to top-level `agents.*`, and from the active tool's defaults otherwise.

#### Scenario: A setting for one lens
- **WHEN** the file sets the model of the `security` lens
- **THEN** the other roles keep their defaults

#### Scenario: Tool-scoped block overrides top-level fallback
- **WHEN** `relevo.yml` defines both `agents.claude` and `agents.antigravity`
- **THEN** each tool resolves its own block, falling back to top-level `agents.*` only for keys its block omits

### Requirement: The defaults are stated
The defaults for Claude Code SHALL be: `ladder` `[haiku, sonnet, opus]`, the developer agent `sonnet` with effort `high`, `spec` and `security` `opus` with `high`, `code` `sonnet` with `high`, `interface` `sonnet` with `medium`, and `bugs` `sonnet` with `high`. The defaults for Antigravity SHALL be: `main` `gemini-4-neon` with effort `high`, `ladder` `[flash_lite, flash, pro, inherit]`, and `dev` plus all five QA lenses (`spec`, `security`, `code`, `interface`, `bugs`) on `inherit` with no per-subagent effort, so no subagent silently downgrades to `gemini-4-hydrogen-*`. A default SHALL change only on empirical evidence.

#### Scenario: A project that changes nothing
- **WHEN** a Claude project sets none of the keys under `agents`
- **THEN** each role runs with the Claude defaults of this requirement

#### Scenario: An Antigravity project that changes nothing
- **WHEN** an Antigravity project sets none of the keys under `agents`
- **THEN** the main session runs with `gemini-4-neon` at effort `high`, `agents.ladder` is `[flash_lite, flash, pro, inherit]`, and `dev` and all five QA lenses default to `inherit`

#### Scenario: The cost of the defaults
- **WHEN** the documentation lists the defaults
- **THEN** it states the defaults and how to override them per role

### Requirement: The model is given when the agent is launched
The orchestrator SHALL give the configured model of a role when it launches the agent of that role, and SHALL give the effort in the same way where the runtime allows it.

#### Scenario: A configured model
- **WHEN** the file sets `agents.qa.code.model`
- **THEN** the `code` lens is launched with that model

### Requirement: A setting that cannot be applied is never silent
Where the runtime cannot apply the effort at launch, `doctor` SHALL say which settings are not applied and why. A setting SHALL NOT be accepted silently and then have no effect.

#### Scenario: An effort the runtime cannot set
- **WHEN** the runtime accepts a model but not an effort at launch
- **THEN** `doctor` says that the effort is not applied and names the roles

### Requirement: Antigravity applies main and native subagent tiers and warns on unapplied fields
With `agent.build` set to `antigravity`, Relevo SHALL apply `agents.main` on `agy -p` (omitting `--effort` on effort-suffixed slugs) and native `invoke_subagent` tiers (`flash_lite`, `flash`, `pro`, `inherit`) on subagents without writing explicit model IDs to `agents/*.md`. Validation, `doctor`, and `init` SHALL warn only on unapplied fields (subagent `effort`, non-tier subagent models, and `agents.main` effort-suffix conflicts).

#### Scenario: Supported Antigravity settings produce no warning
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets `agents.antigravity.main: { model: gemini-4-neon, effort: high }` and `agents.antigravity.qa.interface.model: inherit`
- **THEN** validation, `doctor`, and `init` report no unapplied agent setting warning

#### Scenario: Unapplied subagent effort or non-tier model warns specifically
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets `agents.antigravity.dev.effort: medium` or `agents.antigravity.qa.security.model: gemini-4-neon`
- **THEN** validation passes and `doctor` and `init` warn specifically naming the unapplied field(s)

#### Scenario: Main model effort suffix conflicts with main effort
- **WHEN** `agent.build` is `antigravity` and `agents.antigravity.main` sets `model: gemini-4-neon-high` and `effort: low`
- **THEN** `doctor` warns on the conflict and explains that `--effort` will be omitted

### Requirement: No setting disables or weakens a lens
There SHALL be no setting that turns off `spec`, `security` or `code`, or that lowers what they block. A project's exceptions SHALL be written in its own rules file, which the `spec` lens already reads.

#### Scenario: An attempt to turn a lens off
- **WHEN** a file tries to disable the `security` lens
- **THEN** validation fails because the key does not exist

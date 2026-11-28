# Spec Delta

## ADDED Requirements

### Requirement: Claude and Antigravity spending limits coexist
`relevo.yml` SHALL allow both `limits.run_max_cost` and `limits.run_max_tokens` to be set in the same file. The limit required by the active `agent.build` (`limits.run_max_cost` for `claude`, `limits.run_max_tokens` for `antigravity`) SHALL remain mandatory. When the inactive tool's limit is present, validation SHALL check its type and range (`limits.run_max_cost` as a number greater than 0; `limits.run_max_tokens` as an integer at least 1000) and SHALL accept it without error or rejection.

#### Scenario: Both limits set on a Claude repository
- **WHEN** `relevo.yml` has `agent.build: claude`, `limits.run_max_cost: 5` and `limits.run_max_tokens: 2000000`
- **THEN** validation passes and both values are present in the validated configuration

#### Scenario: Both limits set on an Antigravity repository
- **WHEN** `relevo.yml` has `agent.build: antigravity`, `limits.run_max_tokens: 2000000` and `limits.run_max_cost: 5`
- **THEN** validation passes and both values are present in the validated configuration

#### Scenario: Inactive limit has an invalid value
- **WHEN** `relevo.yml` has `agent.build: claude`, `limits.run_max_cost: 5` and `limits.run_max_tokens: 500`
- **THEN** validation fails and reports that `limits.run_max_tokens` must be an integer >= 1000

#### Scenario: Active limit is missing while inactive limit is set
- **WHEN** `relevo.yml` has `agent.build: antigravity`, `limits.run_max_cost: 5` and no `limits.run_max_tokens`
- **THEN** validation fails and reports that `limits.run_max_tokens` is required for `antigravity`

### Requirement: Tool-scoped agent blocks and main session setting
`relevo.yml` MAY define optional `agents.main` (`{ model, effort }`) and optional `agents.claude` and `agents.antigravity` blocks (each accepting `main`, `ladder`, `dev`, and `qa.<lens>`), alongside backward-compatible top-level `agents.*`. Validation SHALL validate every block present and resolve the active tool's block (tool-scoped keys overriding top-level `agents.*`, falling back to tool defaults) while preserving per-tool resolution for runtime switching.

#### Scenario: Both tool blocks defined in one file
- **WHEN** `relevo.yml` sets `agents.claude` and `agents.antigravity` (each with `main`, `ladder`, `dev` and `qa.*`)
- **THEN** validation validates both blocks, passes when both are valid, and exposes the active `agent.build` block as `config.agents`

#### Scenario: Tool block overrides top-level fallback
- **WHEN** `relevo.yml` sets `agent.build: antigravity`, top-level `agents.dev.model: pro`, and `agents.antigravity.dev.model: inherit`
- **THEN** the resolved Antigravity developer model is `inherit`

#### Scenario: Invalid setting inside inactive tool block
- **WHEN** `relevo.yml` has `agent.build: claude` and sets `agents.antigravity.main.effort: extreme`
- **THEN** validation fails and names `agents.antigravity.main.effort` and the allowed effort values

#### Scenario: Main session setting rejects floor and ceiling
- **WHEN** `relevo.yml` sets `agents.main.floor: sonnet` or `agents.antigravity.main.ceiling: pro`
- **THEN** validation fails because `main` accepts only `model` and `effort`

### Requirement: Antigravity applies main and native subagent tier settings
For `agent.build: antigravity`, defaults SHALL be `main: { model: gemini-4-neon, effort: high }`, `ladder: [flash_lite, flash, pro, inherit]`, and `dev` plus all five QA lenses on `inherit` (QA `auto` floor `inherit`). Supported Antigravity settings SHALL apply without warning; validation SHALL warn specifically on unapplied fields (subagent `effort`, non-tier subagent models, and `agents.main` effort-suffix conflicts).

#### Scenario: Antigravity defaults with no agents block
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` has no `agents` block
- **THEN** validation passes with no agent warning, `agents.main` is `{ model: gemini-4-neon, effort: high }`, `agents.ladder` is `[flash_lite, flash, pro, inherit]`, and `dev` and all five QA lenses default to `inherit`

#### Scenario: Valid Antigravity settings produce no warning
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets `agents.antigravity.main: { model: gemini-4-neon, effort: high }` and `agents.antigravity.dev: { model: auto, floor: pro, ceiling: inherit }`
- **THEN** validation passes with no warning about unapplied agent settings

#### Scenario: Unapplied subagent effort or non-tier model warns specifically
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets `agents.antigravity.dev.effort: low` and `agents.antigravity.qa.code.model: gemini-4-neon`
- **THEN** validation passes and warns specifically on `agents.antigravity.dev.effort` and `agents.antigravity.qa.code.model`

#### Scenario: Conflicting effort suffix on main model warns
- **WHEN** `agent.build` is `antigravity` and `agents.antigravity.main` sets `model: gemini-4-neon-high` and `effort: low`
- **THEN** validation passes and warns that the effort suffix on `model` conflicts with `effort` and `--effort` will be omitted

## MODIFIED Requirements

### Requirement: Defaults and validation
Optional settings SHALL have documented defaults, the spending limit for the active `agent.build` (`limits.run_max_cost` for `claude`, `limits.run_max_tokens` for `antigravity`) SHALL be mandatory, and invalid values SHALL be rejected with an actionable message.

#### Scenario: Defaults
- **WHEN** an optional setting is absent
- **THEN** the documented default is used: base `dev`, release `main`, `review.mode` `peer`, `review.merger` `approver`, `built_unreviewed_per_person` 2, `concurrent_agents` 3, `review_sla_hours` 8, `run_max_turns` 100, `qa.retries` 1, `evidence.policy` `attach_to_pr`, `language` `en`, `trust` `private-team`

#### Scenario: Cost limit is mandatory
- **WHEN** `agent.build` is `claude` (or absent) and `limits.run_max_cost` is absent
- **THEN** validation fails and unattended runs do not start, because an unattended Claude agent must always have a cost limit

#### Scenario: Token limit is mandatory for Antigravity
- **WHEN** `agent.build` is `antigravity` and `limits.run_max_tokens` is absent
- **THEN** validation fails and unattended runs do not start, because an unattended Antigravity agent must always have a token limit

#### Scenario: Invalid value
- **WHEN** a setting has a value outside its allowed set
- **THEN** validation fails and names the setting, the value and the allowed values

### Requirement: The order of the models is declared in relevo.yml
`agents.ladder` (and `agents.<tool>.ladder`) SHALL be a list of model names from the lowest to the highest, without repeats, with the default `[haiku, sonnet, opus]` for `claude` and `[flash_lite, flash, pro, inherit]` for `antigravity`. Relevo SHALL NOT check the names against a hard-coded vendor model catalog, because that list changes; the order is the only thing the ladder says. A ladder that is not a list of distinct non-empty names SHALL be reported by name.

#### Scenario: The default ladder
- **WHEN** `agent.build` is `claude` (or absent) and `relevo.yml` has no `agents.ladder`
- **THEN** the effective configuration has `[haiku, sonnet, opus]`

#### Scenario: The default ladder for Antigravity
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` has no `agents.ladder`
- **THEN** the effective configuration has `[flash_lite, flash, pro, inherit]`

#### Scenario: A ladder of the repository
- **WHEN** `agents.ladder` is `[sonnet, opus]`
- **THEN** that order is the one the floor and the ceiling of every role are read against

#### Scenario: An invalid ladder
- **WHEN** `agents.ladder` repeats a name, is empty or holds something that is not a name
- **THEN** the configuration is invalid and the message names `agents.ladder`

### Requirement: The default range of a role never costs more than the defaults
When a role is on `auto` and sets no `ceiling`, its ceiling SHALL be the default model of the role; when it sets no `floor`, its floor SHALL be the name one step below the ceiling in the ladder, or the ceiling itself when there is none. For a QA lens the default floor SHALL NOT be below the tool's QA minimum model (`sonnet` for `claude`, `inherit` for `antigravity`) when that model is in the ladder: it is the higher of the name one step below the ceiling and that QA minimum, and never above the ceiling. So `auto` never costs more than the defaults unless the repository raises the ceiling, and a QA lens is never taken below the minimum floor by default.

#### Scenario: Auto with the defaults
- **WHEN** `agent.build` is `claude` and `agents.dev.model` is `auto` and nothing else is set for the role
- **THEN** its ceiling is `sonnet`, its floor is `haiku`, and the effort is the one configured

#### Scenario: A lens that defaults to the stronger model
- **WHEN** `agent.build` is `claude` and `agents.qa.security.model` is `auto`
- **THEN** its ceiling is `opus` and its floor is `sonnet`: auto never takes the security lens below one step of its default

#### Scenario: A lens that defaults to sonnet
- **WHEN** `agent.build` is `claude` and `agents.qa.code.model` or `agents.qa.interface.model` is `auto` and nothing else is set for the lens
- **THEN** its ceiling and its floor are `sonnet`: the lens evaluation did not pass haiku for these lenses

#### Scenario: An Antigravity lens on auto
- **WHEN** `agent.build` is `antigravity` and `agents.qa.security.model` is `auto` and nothing else is set for the lens
- **THEN** its ceiling and its floor are `inherit`: auto does not silently downgrade an Antigravity QA lens to `gemini-4-hydrogen-*`

#### Scenario: A floor written for a lens
- **WHEN** `agents.qa.code` is `{ model: auto, floor: haiku }` for Claude (or `{ model: auto, floor: pro }` for Antigravity)
- **THEN** its floor is the written value: only the default is raised

#### Scenario: The ceiling is raised
- **WHEN** `agent.build` is `claude` and `agents.dev` is `{ model: auto, ceiling: opus }`
- **THEN** the range of the developer is `sonnet` to `opus`

### Requirement: The settings of the agents are configuration keys
`relevo.yml` MAY set `agents.main.model`, `agents.main.effort`, `agents.dev.model`, `agents.dev.effort`, and, for each lens, `agents.qa.<lens>.model` and `agents.qa.<lens>.effort` (with `<lens>` one of `spec`, `security`, `code`, `interface` and `bugs`), either at top level under `agents` or scoped under `agents.claude` and `agents.antigravity`. A model SHALL be a non-empty string. An effort SHALL be one of `low`, `medium`, `high`, `xhigh` and `max`. An unknown lens name, role key, or effort SHALL fail validation, and a file without the keys SHALL be valid.

#### Scenario: Valid settings
- **WHEN** the file sets a model and an effort for `agents.qa.security` and `agents.main`
- **THEN** validation passes

#### Scenario: Settings for the bugs lens
- **WHEN** the file sets a model and an effort for `agents.qa.bugs`
- **THEN** validation passes

#### Scenario: An unknown lens
- **WHEN** the file sets `agents.qa.style.model`
- **THEN** validation fails and names the lenses that exist

#### Scenario: An unknown effort
- **WHEN** an effort is `extreme`
- **THEN** validation fails and lists the efforts that exist

#### Scenario: No settings
- **WHEN** the file has none of the keys
- **THEN** it is valid and the defaults apply

### Requirement: Validation can warn without blocking
Validation SHALL have a level that reports a message without failing. A setting that is valid but that the agent in use does not apply SHALL produce a warning of that level and SHALL NOT be an error, so that a file can be shared between tools.

#### Scenario: A setting that Antigravity does not apply
- **WHEN** `agent.build` is `antigravity` and the file sets `effort` on a subagent role or a non-tier model on a subagent role
- **THEN** validation passes and reports a targeted warning naming the specific unapplied field(s)

#### Scenario: A setting that Antigravity does apply
- **WHEN** `agent.build` is `antigravity` and the file sets only `agents.antigravity.main` (without a conflicting effort suffix) and valid native tiers (`flash_lite`, `flash`, `pro`, `inherit`, or `auto`) on subagents
- **THEN** validation passes with no unapplied-agent-setting warning

#### Scenario: A key that does not apply and is rejected
- **WHEN** a key is marked as rejected for the agent in use
- **THEN** validation still fails as it did before

## REMOVED Requirements

### Requirement: Antigravity accepts auto and does not apply it
**Reason**: Antigravity CLI `1.5.18` now applies `agents.main` (`--model`/`--effort`) and native `invoke_subagent` model tiers (`flash_lite`, `flash`, `pro`, `inherit`), so `auto` and `agents.ladder` are applied for Antigravity rather than blanket-ignored.
**Migration**: Replaced by `Requirement: Antigravity applies main and native subagent tier settings`, which applies `agents.main`, `ladder`, and native subagent tiers while warning specifically on unapplied fields (per-subagent `effort`, non-tier subagent models, and main effort-suffix conflicts).

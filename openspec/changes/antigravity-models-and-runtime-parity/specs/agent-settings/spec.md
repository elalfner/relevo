# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: With Antigravity the settings are accepted and not applied
**Reason**: Antigravity CLI `1.5.18` supports `--model`/`--effort` for the main session (`agents.main`) and native `invoke_subagent` tiers (`flash_lite`, `flash`, `pro`, `inherit`) for subagents, so Antigravity no longer ignores all `agents.*` settings.
**Migration**: Replaced by `Requirement: Antigravity applies main and native subagent tiers and warns on unapplied fields`.

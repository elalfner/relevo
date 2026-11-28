# Spec Delta

## MODIFIED Requirements

### Requirement: Depth sets defaults, and what the file says wins
For Claude Code, `prototype` SHALL lower the default effort of `dev` and of every lens by one step and SHALL allow a lens to default to the lowest model of the lens floor (`sonnet`). For Antigravity, `prototype` SHALL lower `agents.main.effort` by one step (from `high` to `medium`) while keeping `dev` and all five QA lenses (`spec`, `security`, `code`, `interface`, `bugs`) on `inherit` so every subagent runs on the main flagship model at `medium` rather than downgrading to `gemini-4-hydrogen-*`. A value written under `agents.*` (or `agents.<tool>.*`) SHALL win over the depth, and `qa.retries` SHALL keep its own value.

#### Scenario: Prototype defaults
- **WHEN** `agent.build` is `claude`, `depth` is `prototype`, and `agents` is not set
- **THEN** `dev` and each lens take one effort step less than the standard Claude default, and `spec` and `security` default to `sonnet`

#### Scenario: Prototype defaults for Antigravity
- **WHEN** `agent.build` is `antigravity`, `depth` is `prototype`, and `agents` is not set
- **THEN** `agents.main` is `{ model: gemini-4-neon, effort: medium }` while `dev` and all five QA lenses remain on `inherit`

#### Scenario: Explicit value
- **WHEN** `depth` is `prototype` and `agents.qa.spec.effort` is `high` (for Claude) or `agents.antigravity.main.effort` is `high` (for Antigravity)
- **THEN** the explicit value wins over the prototype default

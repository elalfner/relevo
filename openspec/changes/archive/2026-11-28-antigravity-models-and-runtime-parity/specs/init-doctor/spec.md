# Spec Delta

## MODIFIED Requirements

### Requirement: `doctor` and `init` warn about settings that the agent does not apply
When the agent in use does not apply a setting of `agents` — or when an Antigravity `agents.main.model` carries an effort suffix that conflicts with `agents.main.effort` — `doctor` and `init` SHALL print a targeted warning naming only the unapplied or conflicting setting(s) and explaining why, and SHALL NOT fail for it. Supported Antigravity settings (`agents.main` without effort-suffix conflict, `agents.ladder`, and subagent roles using native `invoke_subagent` tiers `flash_lite`, `flash`, `pro`, `inherit` or `auto`) SHALL produce no warning.

#### Scenario: Antigravity
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets `effort` on `dev` or a QA lens, or sets a subagent model outside `[flash_lite, flash, pro, inherit]`
- **THEN** `doctor` and `init` warn naming only those unapplied settings and go on

#### Scenario: Antigravity with conflicting main model effort suffix
- **WHEN** `agent.build` is `antigravity` and `agents.antigravity.main` sets `model: gemini-4-neon-high` and `effort: low`
- **THEN** `doctor` warns naming the conflict and stating that `--effort` will be omitted

#### Scenario: Antigravity with only applied settings
- **WHEN** `agent.build` is `antigravity` and `relevo.yml` sets only `agents.antigravity.main: { model: gemini-4-neon, effort: high }` and native subagent tiers
- **THEN** neither `doctor` nor `init` prints an unapplied-agent-settings warning

#### Scenario: Claude with every setting applied
- **WHEN** `agent.build` is `claude` and the agent applies every setting of the file
- **THEN** no warning is printed

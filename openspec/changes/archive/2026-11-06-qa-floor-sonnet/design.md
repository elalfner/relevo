# Design

## Decision

The rule is "QA floor = max(one step below the ceiling, sonnet)", applied only when no `floor` is written, only to paths `agents.qa.*`, and only when `sonnet` is in `agents.ladder`. If the ceiling is below `sonnet` (a repository that set it on purpose), the floor is the ceiling. The name `sonnet` is a constant next to the other defaults in `config.mjs`.

## Why not a stricter rule

The issue can still ask for a lower model with `QA-model:` (a person chose it, and it is clamped to the ceiling only upwards). A repository can write `floor: haiku` for a lens. Only the default changes, because one run per case is not enough to forbid haiku.

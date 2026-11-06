# Proposal

## Why

The model and the effort of the developer agent and of each QA lens are fixed for the whole repository in `relevo.yml` (`agents.dev`, `agents.qa.<lens>`), so a trivial issue and a large one run on the same models. A real build in a Flutter project (issue 76 of the sandbox) used two lenses on the stronger model that cost about a third of the run, and the longest of them (`spec`, about 4 minutes) did the same work for a small screen as it would for a large one. The orchestrator already passes `model` and `effort` at every launch, so the choice can come from somewhere else (#134, part of #115).

## What Changes

First stage of #134. Escalation on retry is left for a second change, when there is data from several runs.

- **`model: auto`** for a role (`agents.dev`, `agents.qa.<lens>`). A script, not the main agent, picks the model of the role from signals of the issue and of its tasks, between a floor and a ceiling that the repository sets. The choice is deterministic and recorded.
- **`agents.ladder`**, the order of the models, from the lowest to the highest (default `[haiku, sonnet, opus]`). Floor and ceiling of a role are names in that list. By default the ceiling of a role is its current default model and the floor is one step below, so `auto` never costs more than today unless the repository raises the ceiling.
- **`Model:` and `QA-model:` in the issue.** A line of the issue text asks for a model for the developer or for the lenses. It is read only for a role that is `auto`, can lower the model freely and can raise it only up to the ceiling. It is part of the issue text, so the issue hash protects it. With `trust: public` it is ignored.
- **The comment says what was chosen and why.** The usage comment and its marker say, for each role, the model and effort that were used, whether they came from the configuration, from `auto` or from the issue, and the reason.
- **`/relevo:issue`** may propose a `Model:` line with its reason; a person confirms it with the rest of the draft.

## Capabilities

### New Capabilities

### Modified Capabilities
- `configuration`: `agents.ladder`, the value `auto` and the floor and ceiling of a role.
- `go`: the model plan before the first launch, the issue-level lines and what the comment reports.
- `issue`: the optional `Model:` and `QA-model:` lines and their proposal.
- `execution-modes`: the usage comment and marker carry the model plan.

## Impact

- New: `scripts/model-plan.mjs`, `scripts/lib/model-plan.mjs`, `scripts/lib/issue-model.mjs`.
- Changed: `scripts/lib/config.mjs` (`agents.ladder`, `auto`, floor and ceiling), `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs` (the plan in the comment and the marker), `skills/go/SKILL.md` and `skills/go/references/qa-run.md` (launch with the planned model and effort), `skills/issue/SKILL.md`, `scripts/check-issue.mjs` (the two lines are accepted), `docs/configuration(.es).md`, `docs/execution(.es).md`, `templates/relevo.yml`, `CHANGELOG.md`.
- No change to `run_max_cost`, which stays the hard stop, and no change to what any lens blocks.

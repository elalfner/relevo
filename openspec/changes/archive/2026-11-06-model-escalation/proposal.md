# Proposal

## Why

Second stage of #134. Stage 1 picks the model of each role once, before the first launch, from the size of the change. When QA rejects the work, or the gate is red, the developer is relaunched in **fix** mode with the same model, although the first attempt just showed that the model was not enough. The cost of a retry on the same model that failed is a second failure.

## What Changes

- **A retry of the developer runs one name up `agents.ladder`.** Before each launch of `relevo:dev` in fix mode, a script (`model-plan.mjs escalate`) gives the model: the one of the failed attempt raised by one name, never past the `ceiling` of the role. Only a developer on `auto` is raised; a model set in `relevo.yml` stays.
- **The lenses are not raised.** They review; a stronger reviewer on the retry does not make the code better.
- **The comment and the marker say it.** The usage comment names each step (`haiku to sonnet on attempt 2 (QA rejected)`) and the marker carries `escalated`.

Out of scope: raising the effort, and a retry for `tasks left unfinished` (it has none today: it takes the failure path).

## Capabilities

### Modified Capabilities
- `go`: the model of a retry of the developer.
- `execution-modes`: the usage comment and marker report the steps.

## Impact

- Changed: `scripts/lib/model-plan.mjs` (`escalateDev`), `scripts/model-plan.mjs` (`escalate`), `scripts/lib/run-usage.mjs`, `skills/go/SKILL.md`, `skills/go/references/qa-run.md`, docs, `CHANGELOG.md`.

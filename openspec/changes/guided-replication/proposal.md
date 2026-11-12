# Proposal

## Why

Many issues repeat a pattern that another issue, or the first target of the same issue, already solved: several identical screens, or "like #N". Today the developer builds each one with the same model and a context that grows with every target. The pilot showed the agent copying a sibling screen and spending its judgment only on the differences, which a cheaper model can do if the differences are written down. Issue #135, part of #115, asks for a first target built normally and the rest replicated from a recipe, one per launch, on a cheaper model, with escalation when a target fails.

## What Changes

- **`Pattern: #N` line.** `issue-parse.mjs` reads it like `Depends-on:` and `Allow-paths:`. `scripts/pattern-check.mjs` finds the merged change of #N and writes its diff outside the working tree as the template for the builder. A pattern that is not merged yet, or that does not exist, is reported before building (`build-preflight.mjs --stage issue`, reason `inputs`).
- **A recipe in `tasks.md`, declared and checked by a script.** A `## Replication recipe` section names the template (`group K`, `pattern`, or paths). A task marked `[replica]` carries a `Rename:` map and a `Differences:` list. `replica-plan.mjs check` validates it; a replica without differences sends the issue back (`missing`) in `build-preflight.mjs --stage spec`.
- **One cheap agent per replica task.** `task-groups.mjs` makes each replica task its own group, never merged by the small-change rule. `replica-plan.mjs model` gives the model of a replica launch from the existing ladder and the existing model plan: one name below the developer's planned model, never below the developer's `floor`; two failures of the same target make it the planned (stronger) model, as `go` counts them. No new configuration key.
- **The template is checked first (C1).** Before the first replica launches, `go` runs the gate and the QA lenses on the work built so far, with the normal retries. After each replica's checkpoint the gate runs on it (receipt reuse makes the unchanged checks free).
- **Same guards (C2).** Replicas are committed by `checkpoint.mjs`, so protected paths, restricted files, the credential scan, `run_max_*` and the budget check before each launch apply unchanged.
- `skills/go/SKILL.md`, `agents/dev.md` (a replica mode), `docs/issue-format.md` (+ `.es.md`), `docs/execution.md` (+ `.es.md`), `CHANGELOG.md`.

Out of scope (follow-up, see design): QA findings attributed to one target with a per-target retry; a script that applies the rename map to the template files mechanically; a pattern of another repository; a generator in the target project (out of scope of the issue).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `issue`: the `Pattern:` line.
- `go`: the recipe, the replica launches, the template check and the model of a replica.
- `validation-gate`: the gate runs after each replica target.

## Impact

- New: `scripts/lib/pattern.mjs`, `scripts/pattern-check.mjs`, `scripts/lib/replica-plan.mjs`, `scripts/replica-plan.mjs` and their tests.
- Changed: `scripts/lib/issue-parse.mjs` (a focused addition), `scripts/lib/task-groups.mjs`, `scripts/lib/build-preflight.mjs`, `scripts/build-preflight.mjs`.
- Not touched: `model-plan.mjs` and `lib/model-plan.mjs` (read only: `agents.ladder`, `agents.dev.floor`), `qa-aggregate.mjs`, `scan-exceptions.mjs`, `usage-limit.mjs`, workflows, `run-usage.mjs`, the version in `plugin.json`.

# Proposal

## Why

The four lenses check conformity to the issue (`spec`), security, hygiene of the code and its tests (`code`) and the interface. None asks whether the code does the right thing in the case after the happy path: an invariant that holds only at one moment, a second actor, a state reached later. In a real run, a general correctness review of a branch that had already passed every lens found four defects of exactly that kind (a value that could be set back to an invalid one after a feature was switched on, a sensitive action that left no audit row, a check of the gate that could fail by a rate limit and not by a defect, a project rule that the new code contradicted); none of the lenses had reported any of them, and no lens had been given the question. A lens that owns it, measured on seeded defects as the others are, closes the gap without making any current lens do two jobs.

## What Changes

- Add a fifth read-only lens, `bugs`, that looks in the diff for correctness defects with a concrete failure scenario: wrong or missing conditions, a removed guard that nothing re-establishes, a changed function that breaks a caller, and what holds only at one moment (state after the fact, another actor, a repeated or concurrent call, a missing trace of a sensitive action).
- The lens follows the contract of the others: a first line of exactly `QA PASSED` or `QA REJECTED`, numbered findings with a class and the evidence rule, and `Rule:` citations. It reviews no style, no cleanup and nothing owned by another lens.
- Each candidate is checked by the lens itself against the code before it is reported, and a finding is labelled `CONFIRMED` (the failing input and the line that mishandles it are shown) or `PLAUSIBLE` (the scenario is believable but a fact outside the diff is unchecked).
- A new key `qa.bugs` of `relevo.yml`, with the values `advisory` (the default), `blocking` and `off`. In `advisory` every finding of the lens is an advisory note and never blocks; in `blocking` only a `CONFIRMED` finding blocks and a `PLAUSIBLE` one stays a note; with `off` the lens is not launched.
- `agents.qa.bugs.model` and `agents.qa.bugs.effort` become valid keys, `auto` included, and the model plan, the budget record and the usage comment know the lens.
- `go`, `fix` and `review` launch the lens with the others, in the same turn, and the aggregation script treats its findings by the mode above. On a retry it checks its earlier findings and reviews what changed, as the others do.
- The renderer for other tools writes the lens agent with a valid name, and `doctor` reports a plugin that lacks it.
- The evaluation harness gains seeded cases for the lens, built from neutral examples, and the first measurement is recorded in the dated evaluation page before any default is changed.

## Capabilities

### New Capabilities

None. The lens belongs to the existing capability that owns the lenses.

### Modified Capabilities

- `qa-lenses`: QA is made of five lenses; a `bugs` lens owns correctness defects; a mode decides whether its findings block; its advisory findings reach the person through the hand-off; its seeded cases are part of the evaluation.
- `configuration`: `qa.bugs` is a setting with three values, and `agents.qa.bugs` accepts a model and an effort like the other lenses.
- `agent-adapters`: the renderer writes the `bugs` lens agent with a valid name.
- `init-doctor`: `doctor` checks five lens agents, and notes when `qa.bugs` is `blocking` or `off`.

## Impact

- New agent file `agents/qa-bugs.md`.
- `scripts/lens-plan.mjs`, `scripts/model-plan.mjs`, `scripts/qa-aggregate.mjs` and `scripts/qa-notes.mjs`, the config schema and `scripts/validate-config.mjs`, the budget and usage records, `scripts/eval-lenses.mjs` and `doctor`.
- `skills/go/references/qa-run.md` and the skills `go`, `fix` and `review` where they list the lenses; the renderer for other tools.
- New fixtures under `tests/fixtures/lens-defects/bugs/`, the evaluation page `docs/lens-evaluation.md` (and its Spanish copy), and the pages that list the lenses (guide, configuration, how it works) in both languages; the CHANGELOG.
- Cost: one more model call per QA round. The default `advisory` keeps the result of a run unchanged, so a run that passed before still passes.
- Out of scope: using the built-in `/code-review` command from the plugin, its cloud `ultra` mode, changing the contract or the scope of the four current lenses, and posting findings on a pull request.

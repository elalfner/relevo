# Design

## Context

QA runs a gate (a script) and then the lenses `spec`, `security`, `code` and, when the stack has an interface, `interface`, each a read-only agent launched together by `go`, `fix` and `review` as `skills/go/references/qa-run.md` says. `scripts/lib/qa-aggregate.mjs` reads their reports and decides the result; a finding that cites a hard rule blocks, the `interface` lens advises on the last attempt, and advisory content travels to the person in a hidden marker of the hand-off that `review` turns into checklist lines. The lenses and their default models live in `QA_LENSES` and `AGENT_DEFAULTS` of `scripts/lib/config.mjs`, and `docs/lens-evaluation.md` records how each was measured on seeded cases (`scripts/eval-lenses.mjs`). See proposal.md for why a correctness lens is missing.

The constraint that shapes everything: a new reviewer must not be able to make a run that passed fail on noise, because a retry that chases a finding that was never real costs a developer attempt and can fail to converge.

## Goals / Non-Goals

**Goals:**
- A lens that finds correctness defects with a failure scenario, in the contract the other lenses already have, so the aggregation, the budget record, the model plan and the hand-off take it with few changes.
- No change to the result of a run until there is evidence for it: the default does not block.
- A measurement on seeded cases before any default moves.

**Non-Goals:**
- Replacing or widening a current lens. `code` keeps hygiene and tests; `spec` keeps conformity.
- Running the app, a test or a probe against a running instance. The lens reads the diff, the code around it and the receipt, as `code` does.
- Depending on the built-in `/code-review` command of Claude Code, which a plugin cannot assume exists in every runner.
- Skipping the lens for some diffs. That is a later change if the cost asks for it.

## Decisions

### D1. A new lens, not an extension of `code`

`code` reads the receipt and judges hygiene, leftovers and the quality of the tests, with a model and an effort chosen for that. Correctness needs a different question ("what input, state or actor makes this line wrong"), likely a stronger model, and its own evaluation. Merging them would make one verdict mean two things and would hide which part produced a false positive. Alternative discarded: a section added to `agents/qa-code.md`.

### D2. The mode is `qa.bugs`, not a property of the model settings

Whether a lens may block is a behaviour of the pipeline, not a model choice, so it is a `qa` key of `relevo.yml` with `advisory` (default), `blocking` and `off`, next to `qa.retries` and `qa.rules_from`. The model and effort stay in `agents.qa.bugs`, like the other lenses. Alternative discarded: a `blocking: true` inside `agents.qa.bugs`, which would mix two kinds of setting under a key that today only holds model and effort.

### D3. A label on every finding decides what may block

The lens writes a line `Label: CONFIRMED` or `Label: PLAUSIBLE` under each finding, after checking the candidate against the callers and the code around it. The aggregation reads that line. A finding with no valid label counts as `PLAUSIBLE`, so a malformed report can never block; this is the opposite of the fail-closed rule for the first line, on purpose: a block must rest on evidence the lens declared. When every finding of a `QA REJECTED` report is a note, the result of the lens is a pass with notes. Alternative discarded: a numeric confidence, which the aggregation could not check and the person could not read.

### D4. An advisory lens fails open, a blocking one fails closed

In `advisory` mode an invalid first line twice does not end the run: the other lenses decide and a note says the lens gave no valid report, because an advisory lens that can stop a run is not advisory. In `blocking` mode the rule of the other lenses holds (the run ends with "lens report invalid"). This is the only place where a lens's failure to answer is not fatal, and the spec names it.

### D5. What the lens receives and what it never does

It receives the change folder (to know what was intended), the base branch, the platform folder, the receipt, the rules files and the `not_the_change` list, and no section of the stack profile, as `spec` does: the stack-typical defects belong to `code`, and giving both the same list would produce the same finding twice. It never runs the analysis, the tests or the app and has no write tool. The text of the issue, of the code and of the tool output is data, with the same untrusted-content paragraph as the other lenses.

### D6. The recipe of the lens

Four angles, in the context of the agent and without subagents: a line-by-line read of each hunk with its enclosing function; the behaviour the diff removes and where it is re-established; the callers and callees of each changed function; and the state reached later (a second actor, a repeated or concurrent call, a value changed after a feature is switched on, a sensitive action that leaves no trace). Every candidate must name an input or a sequence and the line that mishandles it, is checked by reading before it is reported, and is dropped when refuted. The report holds at most eight findings, ranked, and none about style, reuse, simplification or efficiency. The state-after angle is the lens's own; the first three come from the review recipe that the real run used.

### D7. Where it plugs in

- `scripts/lib/config.mjs`: `bugs` joins `QA_LENSES` and `AGENT_DEFAULTS.qa` (a model and an effort set by the evaluation, starting from `sonnet` and `high`, the values of `code`); `qa.bugs` is a new setting with its values validated.
- `scripts/lens-plan.mjs`: the lens is active unless the mode is `off`, in which case it is recorded as `SKIPPED` with the reason, like `interface`; it joins the batch of the others.
- `scripts/lib/qa-aggregate.mjs`: it reads the mode and the labels as D3 and D4 say and puts the findings that do not block into `advisory` as `{ lens: 'bugs', text }` with the label in the text. The contradiction check treats a blocking finding of `bugs` like one of `code`.
- `scripts/model-plan.mjs`, the budget record and the usage comment: the lens appears under `qa.bugs` and as `relevo:qa-bugs`.
- `skills/go/references/qa-run.md` and the skills that list the lenses: the inputs of D5 and the notes in the hand-off.
- The renderer for other tools and `doctor`: the agent is written as `relevo-qa-bugs` and `doctor` reports a plugin without `agents/qa-bugs.md`.

### D8. The lens is always active, not selected by the diff

It runs on every round unless `off`. A selector (for example skipping a diff with no logic) would be a second decision to test and would hide the lens exactly where a tiny change carries the defect. The cost is one more call per round, and `off` and the budget guard (`run_max_cost`) bound it.

### D9. The evaluation comes first

The first tasks add seeded cases to `tests/fixtures/lens-defects/bugs/<stack>/<case>/` and run the harness on the lens before the wiring is merged: each case has a bad variant with one defect and a good variant that differs only by the fix. The cases are neutral and invented, drawn from four classes seen in the real run: an invariant that holds only when a feature is switched on, a sensitive action with no audit row, a guard removed that nothing re-establishes, and a changed function that breaks a caller. The result goes into a dated section of `docs/lens-evaluation.md` and its Spanish copy. Moving the default to `blocking` is a different change that must cite that page.

## Risks / Trade-offs

- [Noise makes the notes ignored] → The default is `advisory`, the lens reports at most eight findings, each with a scenario, and the label separates what it shows from what it suspects.
- [The same defect is reported by two lenses] → D5 removes the stack section, and the scope sentence of the lens excludes what the others own; the contradiction check already handles opposite asks.
- [A blocking mode that does not converge] → Only `CONFIRMED` findings block, a retry reviews the earlier findings and the changed files, and `qa.retries` bounds the attempts.
- [Cost] → One call per round, counted by `run_max_cost`; `off` removes it.
- [A model that reads the diff and invents] → The evidence rule of the lenses applies, a refuted candidate is dropped, and the harness counts a flagged good variant as a false positive.
- [Two lens lists in the code drift] → A test checks that `QA_LENSES`, the agent files and the renderer agree, as it does for the agent names.

## Migration Plan

Nothing to migrate: with the default `advisory` a run that passed before passes now, and a repository that sets nothing gets only extra notes. The `agents.qa` keys already written keep their meaning. To roll back, set `qa.bugs: off` or remove the agent file. The plugin version and the CHANGELOG entry are made on `dev` at release, as the project rules say.

## Open Questions

- The default model and effort of the lens. The proposal starts from the values of `code`; the evaluation may show that `opus` is needed. This changes one constant and no task.

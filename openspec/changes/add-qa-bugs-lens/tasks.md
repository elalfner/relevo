# Tasks

## 1. Seeded cases and the first measurement of the lens

- [x] 1.1 Read `tests/fixtures/lens-defects/code/*/case.json` and `tests/lens-defects.test.mjs`, then add the folder `tests/fixtures/lens-defects/bugs/` with one case per class of design D9 (an invariant that holds only after a feature is switched on, a sensitive action with no audit row, a falsy check that treats a valid zero as missing, a changed function that breaks a caller), each with a `bad` and a `good` variant, using invented neutral examples that name no real project, client or runner; verify with `node --test tests/lens-defects.test.mjs` that the loader accepts every case
- [x] 1.2 Write `agents/qa-bugs.md` with the contract of the other lenses (first line, numbered findings, `Class:`, the `Label:` line of design D3, the evidence rule, the `Rule:` citation, the untrusted-content paragraph, no write tool, never runs the analysis, the tests or the app) and the four angles and the limit of eight findings of design D6; verify with `node --test tests/agents.test.mjs` that the agent file is valid and read-only
- [x] 1.3 Make `scripts/eval-lenses.mjs` and `scripts/lib/lens-eval.mjs` accept the lens `bugs` (the case folder, the agent file, the report judged by the expected text); verify with `node --test tests/eval-lenses.test.mjs`, adding a case of the stub runner for a `bugs` miss and a `bugs` false positive
- [x] 1.4 Run the harness on the `bugs` cases (an opt-in run that spends model usage, with the person's approval of the cost), and record the defects found, the good variants flagged, the cost and the time in a dated section of `docs/lens-evaluation.md` and of `docs/lens-evaluation.es.md`; verify that both pages carry the same figures and that the section states the limits of the sample

## 2. Configuration of the lens

- [x] 2.1 Add `bugs` to `QA_LENSES` and to `AGENT_DEFAULTS.qa` in `scripts/lib/config.mjs` with the model and the effort that the measurement of 1.4 supports (starting from those of `code`), and add the setting `qa.bugs` with the values `advisory`, `blocking` and `off`, the default `advisory` and the error that lists the values; verify with new cases in `tests/config.test.mjs` for each scenario of the `configuration` delta
- [x] 2.2 Make `scripts/model-plan.mjs` and its report include `qa.bugs` and accept `bugs` in `--lenses`, including `auto` with a floor and a ceiling; verify with new cases in `tests/model-plan.test.mjs` and `tests/model-plan-report.test.mjs`
- [x] 2.3 Document `qa.bugs` and `agents.qa.bugs` in `docs/configuration.md` and `docs/configuration.es.md`; verify that the keys and the values match `scripts/lib/config.mjs` (the documentation tests of the project pass)

## 3. Planning and deciding with the lens

- [x] 3.1 Make `scripts/lens-plan.mjs` list `bugs` as active unless the mode is `off`, record it as `SKIPPED` with the reason when it is `off`, and put it in the first batch with the other lenses (and in the batches of `--max-parallel`); verify with new cases in `tests/lens-plan.test.mjs`
- [x] 3.2 Make `scripts/lib/qa-aggregate.mjs` read the mode and the `Label:` line as designs D3 and D4 say: in `advisory` every finding goes to `advisory` as `{ lens: 'bugs', text }` and the lens never blocks, including when its report is invalid twice (a note says it gave no valid report); in `blocking` a `CONFIRMED` finding blocks, a `PLAUSIBLE` or unlabelled one is a note, and an invalid report twice ends the run as for the other lenses; verify with new cases in `tests/qa-aggregate.test.mjs` for each scenario of the `qa-lenses` delta, including a `QA REJECTED` report whose findings are all notes
- [x] 3.3 Check that the contradiction rule treats a blocking finding of `bugs` like one of `code`, that a hard rule or a `security` finding still never takes part in a contradiction, and that `scripts/qa-findings.mjs` and `scripts/qa-notes.mjs` carry the label to the hand-off; verify with cases in `tests/qa-aggregate.test.mjs` and `tests/qa-findings.test.mjs`

## 4. The flow of `go`, `fix` and `review`

- [x] 4.1 Update `skills/go/references/qa-run.md` with the inputs of the `bugs` lens (the change folder, the base branch, the platform folder, the receipt, the rules files and `not_the_change`, and no section of the profile), the saving of its report, the budget record as `relevo:qa-bugs` and the retry that gives it its earlier report and the files changed since, and update the places of the skills `go`, `fix` and `review` that list the lenses; verify with `node --test tests/agent-workflow.test.mjs` and a search that no text still says "four lenses" for the lenses of the plugin
- [x] 4.2 Make the usage record and the usage comment list the lens with its model, attempts and cost like the others; verify with a case in the tests of the usage comment (find them with a search for `qa.code` in `tests/`)
- [x] 4.3 Make `review` list a note of the `bugs` lens as a pending checklist line that names the lens and its label; verify with a case in the tests of the review checklist (find them with a search for `relevo:qa-notes` in `tests/`)

## 5. Other tools and doctor

- [x] 5.1 Make the renderer for other tools write `relevo-qa-bugs`, rewrite its references and keep the test of valid agent names green; verify with `node --test tests/agents.test.mjs` and the renderer test, and check that no `relevo:qa-` token remains in the rendered output
- [x] 5.2 Make `doctor` report a plugin that lacks `agents/qa-bugs.md` and report the mode of `qa.bugs` when it is not the default; verify with cases in `tests/doctor.test.mjs`

## 6. Documentation and integration

- [x] 6.1 Update the pages that list the lenses and what each owns (the guide, how it works, security and execution, in English and Spanish) and the README files, with the new lens, its mode and the fact that it never blocks by default; verify that the English and Spanish pages agree and that `GLOSSARY.md` terms are respected
- [x] 6.2 Add the entry to `CHANGELOG.md` under the unreleased section, without changing the version of `.claude-plugin/plugin.json` (it changes at release); verify the entry names the new lens, the key and the default
- [x] 6.3 Run the whole suite with `npm test` and `openspec validate --all`, and verify that both exit 0 and that a run of `go` on an example with the default mode gives the same result as before the change

## Workflow follow-up

- Move the default of `qa.bugs` to `blocking` only in a later change that cites the evaluation of task 1.4.
- Archive the change after the project's review requirements are satisfied, then run `npm test` and `openspec validate --all` again.

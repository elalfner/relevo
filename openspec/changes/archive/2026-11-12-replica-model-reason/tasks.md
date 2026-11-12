# Tasks

## 1. Tests that fail first

- [x] 1.1 In `tests/replica-plan.test.mjs`, test that `model --task 2.1` with `RELEVO_PROGRESS_DIR` writes `replica-models.json` with `{ task, model, failures, why }`, that a second call for the same task appends, that nothing is written without `--task` or without the folder, and that the printed output is the same in every case
- [x] 1.2 In `tests/usage.test.mjs`, test the comment and the marker of a run whose replicas have recorded reasons (the three scenarios: not on auto, cheaper model, a target launched again), a run with no record (as before), and a record whose task has no replica in the log
- [x] 1.3 In `tests/messages-language.test.mjs`, cover the new phrase in English and Spanish (the reason quoted as written)
- [x] 1.4 In `tests/skill-go.test.mjs`, test that step 3 of a replicated build passes `--task <task id>` to `replica-plan.mjs model`
- [x] 1.5 Run the four and see them fail before the code exists

## 2. The change

- [x] 2.1 `scripts/replica-plan.mjs`: the optional `--task`, and the record in `replica-models.json` (never failing the run, nothing without the folder)
- [x] 2.2 `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs`: read the file from `--progress-dir`, give each replica its reason (the last record of its task), show it in the comment and put `why` in the entries of `replicas` of the marker (and accept it when the marker is read)
- [x] 2.3 `scripts/lib/messages.mjs`: the phrase in English and Spanish
- [x] 2.4 `skills/go/SKILL.md`: `--task <task id>` in the command of step 3
- [x] 2.5 Run the new tests and the whole suite (`node --test`), and `openspec validate --all`

## 3. Documentation

- [x] 3.1 `docs/execution.md` and `docs/execution.es.md`: the usage comment of a run with replicas gives the reason of each model
- [x] 3.2 `CHANGELOG.md`: entry under Unreleased, Added

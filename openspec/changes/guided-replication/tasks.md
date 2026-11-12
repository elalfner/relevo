## 1. Reading the pattern

- [x] 1.1 `Pattern:` line in `scripts/lib/issue-parse.mjs` (`pattern`, `patternProblems`), with tests in `tests/issue-parse.test.mjs`
- [x] 1.2 `scripts/lib/pattern.mjs` and `scripts/pattern-check.mjs`: find the merged change of #N (injected client), write its diff outside the working tree, with tests
- [x] 1.3 The pattern state in `scripts/lib/build-preflight.mjs` and `scripts/build-preflight.mjs --stage issue` (`inputs`; a failed lookup is unverified), with tests

## 2. The recipe

- [x] 2.1 `scripts/lib/replica-plan.mjs` and `scripts/replica-plan.mjs check`: parse and validate the recipe, with tests
- [x] 2.2 Replica groups in `scripts/lib/task-groups.mjs` (own group, not joined by the small-change rule), with tests
- [x] 2.3 The recipe check in `build-preflight.mjs --stage spec` (`missing`), with tests
- [x] 2.4 `replica-plan.mjs model`: the model of a replica from the ladder and the plan, with tests

## 3. The build

- [x] 3.1 `skills/go/SKILL.md` step 4 and `agents/dev.md` (replica mode): template check before the first replica, one launch per replica, the gate after each, the model and the count of failures, with a test of the skill in `tests/skill-go.test.mjs`
- [x] 3.2 A test that a replica stays bound by the guards: protected path refused by the checkpoint, budget check before each launch

## 4. Documentation

- [x] 4.1 `docs/issue-format.md`, `docs/issue-format.es.md`, `docs/execution.md`, `docs/execution.es.md`, `CHANGELOG.md` (unreleased section)

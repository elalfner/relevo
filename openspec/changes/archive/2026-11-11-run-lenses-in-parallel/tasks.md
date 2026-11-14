# Tasks

## 1. The lens plan

- [x] 1.1 Add `batchLenses(plan, max)` to `scripts/lib/lens-plan.mjs` and `batches` plus `--max-parallel` to `scripts/lens-plan.mjs`. Verify with new cases in `tests/lens-plan.test.mjs` (one batch by default, batches of 2, skipped lens in none, bad value is exit 2).

## 2. The time of each lens

- [x] 2.1 Add the `end` event to `recordLens`/`readLensLog` and pair starts and ends in `lensSeconds` (`scripts/lib/phase-log.mjs`); add `--end` to `progress.mjs lens`. Verify in `tests/phase-log.test.mjs` and `tests/progress-cli.test.mjs`: overlapping lenses, no end, old sequential log.

## 3. The skill and the agent

- [x] 3.1 Rewrite step 3 of `skills/go/references/qa-run.md` (parallel launch, receipt per batch, budget per batch, failed lens, end records, resolved script path), keeping "The model of a retry" consistent. Edit `skills/go/SKILL.md` minimally (the foreground rule and the step 5 sentence) and `agents/qa-spec.md` (use the given path). Verify with `tests/skill-go.test.mjs` assertions for each rule, and `grep -rn "<plugin>" agents skills` finds nothing.

## 4. Documentation and check

- [x] 4.1 Add one entry to `CHANGELOG.md` under Unreleased (no version bump). Update docs that say the lenses run one at a time (`grep -rn "one at a time" docs README*`). Verify with `npm test` passing.

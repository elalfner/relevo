# Proposal

## Why

Issue #150 (part of #115). In a sandbox run of issue #90 the `spec` lens asked the tests to read the dialog question from a constant; the developer did it; the `code` lens then rejected the same assertions because they could no longer fail if the wording changed. Each side of the disagreement used an attempt, the retries ended with `QA rejected after the retries`, and the run cost about $1.70 with no pull request. Another attempt can never satisfy both lenses, so it is money spent for nothing.

## What Changes

- `qa-aggregate.mjs` learns about the previous attempt: `--previous <lens>=<file>` gives the report each lens wrote on the attempt before. With them the script compares, without a model, a blocking finding of this attempt with the findings of another lens that the developer addressed in the previous attempt.
- When every blocking finding of the attempt reverses a finding that another lens had asked for and no longer asks for, the output carries `contradiction` (the pairs: both lenses, both findings, the shared quoted words) and `qa-run.md` step 5 does not relaunch the developer. The run takes the failure path with the new reason `QA rejected: the lenses contradict each other`.
- The failure comment shows both lenses and both findings, quoted, in English and Spanish.
- The rule is deliberately narrow (see `design.md`): it needs words that both findings quote, never touches the `security` lens or a hard rule, and when it cannot tell, the retry runs as today.

Out of scope: changing what a lens checks; any model-based judgement; the `templates/workflows/*.yml`; a new exit class for the usage statistics (the run counts as `other`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qa-lenses`: a new requirement, "Lenses that contradict each other stop the retries", next to "A script decides the result and it fails closed".

## Impact

- `scripts/qa-aggregate.mjs`, `scripts/lib/qa-aggregate.mjs` (new input and output), `scripts/lib/messages.mjs` (the `qa_failed` text), `skills/go/references/qa-run.md` (steps 4 and 5), `skills/go/SKILL.md` and `skills/fix/SKILL.md` (the new reason in the failure path).
- Tests: `tests/qa-aggregate.test.mjs`, `tests/messages.test.mjs`, the language test.
- `CHANGELOG.md` under Unreleased. No version bump.

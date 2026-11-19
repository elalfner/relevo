# Tasks

## 1. The rules file

- [x] 1.1 Add `scripts/lib/rules-file.mjs`: read a rules file into entries `{ file, line, text, advice }`, with `[advice]` on a line or on a heading and what it holds. Verify in `tests/rules-file.test.mjs` (line numbers, advice on a line, advice on a heading until the next heading of the same level, code fences skipped, empty file).

## 2. The conflicts of an issue

- [x] 2.1 Add `scripts/lib/rule-conflicts.mjs` with `findConflicts({ body, rules })`: the `Out of scope` against requirement rules and against scenarios, the override by a decision, the prohibition that agrees, English and Spanish, the output quoting both lines. Verify in `tests/rule-conflicts.test.mjs` (the three scenarios of the issue, advice, override, a prohibition, a rule without the requirement word, a one-word bullet, an override naming a line that is not a rule, no rules).
- [x] 2.2 Call it from `checkIssueDraft` (optional `rules` argument, one block) and have `scripts/check-issue.mjs` read the `--rules-file` files. Verify in `tests/issue-check.test.mjs` (a conflicting draft fails with both lines quoted; the same draft with an override passes; no rules still compares with the scenarios).

## 3. The build preflight

- [x] 3.1 Add the `conflict` finding to `checkIssueStage` (reason `conflict`) and read the rules files in `scripts/build-preflight.mjs` (without a valid `relevo.yml` there are no rules files, so only the comparison with the scenarios runs). Add `conflict` to `missingText`. Verify in `tests/build-preflight.test.mjs` (decision, reason, text, override, exit codes, no `relevo.yml`).
- [x] 3.2 Add the reason `conflict` to `scripts/lib/next-step.mjs` (command, who, hint in English and Spanish, `NEXT_STEP_REASONS`). Verify in `tests/next-step.test.mjs` and `tests/messages.test.mjs` that the `needs_spec` comment with `reason: conflict` renders its next step.

- [x] 3.3 Pass the `notes` of `build-preflight.mjs --stage issue` to the hand-off in `templates/workflows/relevo-go.yml`, in the existing `RELEVO_INPUTS_TO_CONFIRM` line with the prefix `check: ` (a dedicated line of the `built` message needs `skills/go/SKILL.md`, which issue #130 edits). Verify in `tests/workflow-go.test.mjs` by running the command of the step on a result with a note.

## 4. QA blocks on a hard rule

- [x] 4.1 In `scripts/lib/qa-aggregate.mjs` parse `Rule:` citations, verify them against the entries of `rules-file.mjs`, promote the `interface` advisory finding on the last attempt, turn a `QA PASSED` report with a verified citation into a rejection with a synthesized finding, list `unverified`, and treat an `[advice]` rule as advisory; add `--rules-file` to `scripts/qa-aggregate.mjs`. Verify in `tests/qa-aggregate.test.mjs` (every scenario of the `go` delta, no rules file, exit codes, invalid citation line, the fail-closed first line is unchanged).

## 5. Agents and the QA reference

- [x] 5.1 Edit `skills/go/references/qa-run.md` (step 4 passes `--rules-file`, the citation rule, the `unverified` list in the output; leave the sections on the parallel launch and "The model of a retry" as they are) and the four `agents/qa-*.md` (cite the rule as `Rule: <file>:<line> "<quote>"`, never a note for a violation of a rule; `[advice]` rules are notes). Verify in `tests/agents.test.mjs` and `tests/skill-go.test.mjs`: each lens names the citation format, and `qa-run.md` still has the sections of the parallel launch and the model of a retry.

## 6. The issue skill

- [x] 6.0 Pass `--rules-file <qa.rules_from>` in the two calls of `check-issue.mjs` in `skills/issue/SKILL.md` and `skills/issue/references/update.md`, and say who decides. Scope added after review of the first PR: without it the check of a draft never read the project rules in a real `/relevo:issue` session. Verify in `tests/skill-issue.test.mjs`.

## 7. Documentation and check

- [x] 7.1 Document the `[advice]` marker and the `Overrides:` line in `docs/configuration.md`, `docs/issue-format.md` and their `.es.md` twins, and add the entry to `CHANGELOG.md` under Unreleased (no version bump, minimal edit). Verify with `npm test` passing (including the docs and readme sync tests).

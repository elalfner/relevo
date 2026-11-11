# Tasks

## 1. The shared check store

- [ ] 1.1 Add `scripts/lib/check-store.mjs`: the profile and platform resolution used by the gate, the diff hash against the base without generated files, the key, `reusable(record)`, `recordResult` (counts `passes` and `failures`) and `ensureExcluded`. Verify with `tests/check-store.test.mjs` (key changes with diff, command and path; a failure makes the key never reusable; a pass is reusable).

## 2. The gate reuses and records

- [ ] 2.1 Change `scripts/validation-gate.mjs` to reuse a reusable result, record each real run, add `--fresh`, and write `reused`/`original_duration_ms` in the receipt (`scripts/lib/validation-gate.mjs`). Verify in `tests/validation-gate.test.mjs`: reuse on same diff, no reuse after a change, flaky never reused, red never reused, `reused` in the receipt, overall status unchanged.

## 3. The long-run script

- [ ] 3.1 Add `scripts/long-run.mjs` and `scripts/lib/long-run.mjs`: `start`, `status`, `wait`, `tail`, the supervisor, the log by file descriptor, `--check` by name with the record at the end. Verify with `tests/long-run.test.mjs`: start returns at once, status/wait lines and exit codes, a command that fails, a killed supervisor leaves a readable log and `interrupted`, a check by name records and the gate reuses it, a changed tree records nothing, the folder is git-ignored, bad ids and arguments.

## 4. Durations in the comment

- [ ] 4.1 Read the receipt in `scripts/run-usage.mjs` and `scripts/lib/run-usage.mjs`: `Checks:` sentence and `checks` in the marker (`--receipt`, default `.relevo-receipt/receipt.json`). Verify in `tests/usage.test.mjs`: with receipt, reused, none, malformed.

## 5. The procedure

- [ ] 5.1 Edit `skills/go/references/qa-run.md` (the gate through `long-run.mjs`, every lens gets the receipt and never runs tests, consistent with "The model of a retry" and the parallel lenses), `agents/dev.md` (cost guide line) and one sentence of `skills/go/SKILL.md` (the resolved path of `long-run.mjs` for the developer). Verify with assertions in `tests/skill-go.test.mjs` and `tests/agents.test.mjs`.

## 6. Documentation and check

- [ ] 6.1 Update `docs/execution.md` and `docs/security.md` (reuse, the store is a convenience, C1/C2), add one entry under Unreleased in `CHANGELOG.md` without a version bump, run `openspec validate --all` and `npm test`.

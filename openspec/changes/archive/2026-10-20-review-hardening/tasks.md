# Tasks

## 1. The audit and the state

- [x] 1.1 Make `auditLog` return `REVIEW INCONCLUSIVE` for an empty log or a log where the requested package has no pids, change `filterByApp`'s callers and `auditReport` accordingly, and make `decidePr` refuse it with its own reason. Verify with additions to `tests/logaudit.test.mjs` and `tests/review-state.test.mjs`: the empty log, a log of other apps only, an app log without errors still passing, a missing application id with a non-empty log still audited as a whole, `decidePr` refusing the inconclusive verdict.
- [x] 1.2 Add waivers: `waive`, `waived`, the recomputed verdict `REVIEW PASSED (with waivers)`, `syncState` clearing them, the report section and the `decidePr` rule. Verify with `tests/review-waivers.test.mjs` through the script in a throwaway directory: a waiver with a reason, without one, for an inconclusive audit, for a number that does not exist, every finding waived, one left, the same finding after a second audit, `sync` clearing the waivers, the markdown of the section.
- [x] 1.3 Add `drain` and `audit --accumulated`. Verify with a test through the script: two drains accumulate, the audit reads both, an empty accumulated file is inconclusive.
- [x] 1.4 Add `scripts/review-who.mjs`. Verify with `tests/review-who.test.mjs`: same login, different case, different login, missing arguments.

## 2. The skill

- [x] 2.1 Update `skills/review/SKILL.md`: `git pull --ff-only` before the base merge, the change folder from `openspec list --json`, the check of who runs it, `drain` after each message, the commit of the micro-fix, the inconclusive and waiver rules (the waiver is the person's and the agent never proposes one), the waived section in the pull request body, the lookup of an existing pull request and the rejected push; add `review: ['list']` to `scripts/lib/openspec-commands.mjs`. Verify with additions to `tests/skill-review.test.mjs` and `tests/openspec-commands.test.mjs`: each scenario of the `review` delta has its sentence, every script named exists and its flags are implemented, the pull happens before the merge, the lookup before `gh pr create`, no `--force`, the commit of the micro-fix before the push.

## 3. Documentation and integration

- [x] 3.1 Update `docs/commands.md`, `docs/commands.es.md` and `CHANGELOG.md`. Verify with `tests/readme-sync.test.mjs` and the changelog test.
- [x] 3.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 3.3 Try what can be tried without a device: the audit on a real `logcat`-format sample (empty, other app, app with an exception), a waiver round trip, and `review-who` against `gh api user` when `gh` is logged in. Record what happened and what could not be tried (the buffer of a device, a second person, a real pull request) in `docs/pilot-findings.md`.

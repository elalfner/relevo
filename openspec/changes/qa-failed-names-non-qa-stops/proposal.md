# Proposal

## Why

Issue #181, found while verifying #167 in a real run of `relevo-sandbox` (run 43357427211). An issue whose text was edited after a cancelled run was applied `ready` again. The run stopped at the branch check with the reason `branch already exists`, in about a minute and before any developer or QA step. The comment said `failed QA ❌` and "What happened: QA still rejected it after the retries (branch already exists)". Neither is true.

In `scripts/lib/messages.mjs` the `qa_failed` message has one title for every reason, and `happened` says that QA rejected the work after the retries unless the stop is a limit (`run limit reached`), the one entry of `POLICY_STOPS` (`protected path in the diff`) or the case with no retries. The failure path of `skills/go/SKILL.md` has many more reasons that are not a QA rejection (`branch already exists`, `issue changed after ready`, `specification invalid`, `specification incomplete`, `tasks left unfinished`, `invalid decision`, `profile not resolved`, `lens report invalid`, `automated validation could not run`, `automated validation failed after the retries`, `restricted file in the diff`, `outside the platform`, `possible credential or temporary marker in the diff`). Only `branch already exists` was seen in a real run; the rest is read from the code. Part of #115 (C2: no guard changes).

## What Changes

- A `qa_failed` comment names QA only when QA rejected the work: the reasons `QA rejected after the retries` and `QA rejected: nothing the developer agent can fix`, and a comment with no reason, which keeps today's wording.
- For any other reason the title and the "What happened" line say that the run stopped for that reason and that QA did not reject the work. A reason the catalog does not know falls here, so a new reason added to the skill is never described as a QA rejection.
- The title changes with the reason: `failed QA ❌` / `no pasó QA ❌` stays for the QA rejections.
- The reasons that already have their own text (`run limit reached`, `protected path in the diff`) and the next-step line are unchanged.
- Every text stays in the catalog, in English and Spanish, with the language test.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `issue-lifecycle`: a `qa-failed` comment for a stop that is not a QA rejection says what stopped the run and does not say that QA rejected it.

## Impact

`scripts/lib/messages.mjs` (the title and `happened` of `qa_failed`), `tests/messages.test.mjs`, `tests/messages-language.test.mjs`, `CHANGELOG.md` (unreleased). The version is not changed. Out of scope: which reasons exist, what the failure path does, the `Your next step` line, and any workflow template.

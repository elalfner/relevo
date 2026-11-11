# Proposal

## Why

In a measured 39-minute build, about 18 minutes were the same test suite run three times: by the developer (7.5 minutes, first killed at the 2-minute limit of the agent's shell tool and then relaunched in the background with `&` and four `sleep` polls), by the validation gate (9 minutes) and by one QA lens. The gate wrote `duration_ms` per command in its receipt, but nothing published it, so the comment only said "green". Issue #124, part of #115.

## What Changes

- A new script, `scripts/long-run.mjs`, runs a command that takes minutes in the background, detached from the agent's tool, with a log and a status file; `status` and `wait` (bounded below the 2-minute limit) report it in one cheap line. The log stays readable if the script or its job is killed.
- The same script can run a **check** of the profile (`--check analyze|test`): the command comes from the profile, not from the agent, and a result that finishes green on an unchanged diff is recorded for the gate.
- The validation gate reuses a check whose inputs (diff hash, command, folder) match a green record already made in this working folder, and records `reused` in the receipt. A red result is never reused, and a key that ever failed is never reused, so a flaky test cannot be hidden.
- The gate itself is run through `long-run.mjs` in `qa-run.md`, because it can last longer than the tool limit.
- `qa-run.md` gives every lens the receipt and says no lens runs analysis or tests; `agents/dev.md` points the developer at `long-run.mjs` for the full suite.
- `run-usage.mjs` reads the receipt and adds the seconds per check (and `reused`) to the run comment and to the hidden marker.

## Capabilities

### New Capabilities
- `long-commands`: a script that runs a long command in the background with a log, a status and a bounded wait, and records the result of a profile check.

### Modified Capabilities
- `validation-gate`: reuse of a green check on an unchanged diff, `reused` in the receipt, every lens reads the receipt.
- `execution-modes`: the run comment shows the seconds per check from the receipt.

## Impact

`scripts/long-run.mjs` and `scripts/lib/long-run.mjs` and `scripts/lib/check-store.mjs` (new), `scripts/validation-gate.mjs`, `scripts/lib/validation-gate.mjs`, `scripts/run-usage.mjs`, `scripts/lib/run-usage.mjs`, `skills/go/references/qa-run.md`, a short edit of `agents/dev.md` and one sentence of `skills/go/SKILL.md`, docs (`docs/execution.md`, `docs/security.md`), tests, `CHANGELOG.md` (unreleased). The version is not changed. Out of scope: which tests a project runs (`checks.test`).

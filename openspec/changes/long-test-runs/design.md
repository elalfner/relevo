# Design

## Context

- The agent's shell tool cuts a foreground command at 2 minutes; `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: 1` only disables the tool's own background mode, not the shell's. The gate (`scripts/validation-gate.mjs`) runs `analyze` and `test` with `spawnSync`, so a gate started by the agent in the foreground is itself cut.
- The receipt (`.relevo-receipt/receipt.json`) already holds `duration_ms` per command. It is not a security boundary (docs/security.md); the guards of the commit are the enforcement.
- Constraints of the issue: C1 the receipt stays a convenience; C2 the agent has no way to mark a check green without running it; reuse never hides a red.

## Goals / Non-Goals

**Goals:** one script for long commands that does not depend on the 2-minute limit; the gate does not repeat a green check on the same diff; lenses read results; durations are published.

**Non-Goals:** choosing the tests of a project; a security boundary around the receipt; resuming a killed job.

## Decisions

### D1. `long-run.mjs` is a detached supervisor with files, not a daemon
`start --id <id> -- <argv>` spawns a detached `node long-run.mjs _supervise` (own session), which spawns the command with stdout and stderr going **straight to the log file** (a file descriptor, not a pipe through the supervisor), so a killed supervisor or job leaves the log readable. State lives in `.relevo-run/<id>/` (`status.json`, `log`), added to `.git/info/exclude` like the receipt. `status` reads the files: `running`, `passed`, `failed` (with `exit=<n>`) or `interrupted` (state `running` but the supervisor pid is gone). `wait --max-seconds <n>` polls in-process (not with shell `sleep`), capped at 110 so it stays under the tool limit; the agent repeats it while the first word is `running`. Output is one line plus an optional `--tail <n>`. Exit codes: 0 passed, 1 failed, 2 running, 3 usage, 4 interrupted. Alternative discarded: `&` plus `sleep` in the agent's shell (what the pilot did): no status, no log guarantee, many tool calls.

### D2. A profile check is run by name, so the command is not the agent's
`start --id test --check test --base <ref> --platform <p> [--config relevo.yml]` resolves the command from the stack profile (the same resolution as the gate, extracted to `scripts/lib/check-store.mjs`). The agent chooses only the name. When the job ends with exit 0 and the diff hash (against the base, without the generated files, the same function as the gate) equals the one taken at the start, the supervisor records `{ key, exit_code: 0, ... }` in `.relevo-receipt/checks.json`. A failing exit, or a diff that changed during the run, records a failure for the key (a failure) or nothing (changed tree). Alternative discarded: a `record` subcommand: it would let the agent write "green" without running (breaks C2).

### D3. The key and the reuse rule
`key = sha256(diff hash | command | platform path)`. The gate reuses a record only when it has `passes >= 1` and `failures === 0` for that key. Any red for the key (from the gate or from `long-run`) makes it never reusable again in this folder, so a flaky test that passed once and failed once is always run. A red result is never reused because only `passed` records are reused and a failing run is re-run. `--fresh` on the gate ignores the store. The receipt entry of a reused command has `reused: true`, `duration_ms: 0`, `original_duration_ms`, and the `output_tail` of the real run, so the summary a red/green consumer reads is unchanged in shape. A new diff gives a new key: "the tree changed after the earlier run: no reuse".

### D4. C1 and C2
Only code paths that really ran a command write a record: the gate and the supervisor. No flag, subcommand or argument of any script records or forces a result. The store is a file in the working folder and an agent that writes files could forge it, exactly as it could forge the receipt: that is stated in docs/security.md, and the guards of the commit and the CI of the pull request remain the enforcement. The receipt the lenses depend on is still checked by `receipt-check.mjs` against the diff.

### D4b. Lenses read, never run
`qa-run.md` gives the receipt path to every lens and tells them to read results from it; `agents/qa-code.md` already says so. The other lenses had no rule against running tests, so the orchestrator's instruction now says it for all four.

### D5. Durations in the comment
`run-usage.mjs` reads `.relevo-receipt/receipt.json` from the working folder (or `--receipt <file>`) and adds `Checks: analyze 12 s, test 454 s (reused)...` to the sentence and `checks: [{name, seconds, reused}]` to the marker. The workflow template is not changed because the step already runs in the workspace where the gate wrote the receipt. A missing or malformed receipt adds nothing.

## Risks / Trade-offs

- Reuse relies on the diff hash, which does not see untracked files the developer did not report or changes outside the diff (installed dependencies). Accepted: it is the same limit as the receipt, and the CI of the pull request runs the checks again.
- A job started by `long-run.mjs` is orphaned when the runner kills the process group; the status says `interrupted` and the log remains. No resume.
- The dev agent can ignore the instruction and run the suite itself: the gate then runs it too (no reuse). Cost, not correctness.

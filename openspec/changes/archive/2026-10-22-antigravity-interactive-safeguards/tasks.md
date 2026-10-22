# Tasks

## 1. Antigravity Adapter Prompts

- [x] 1.1 In `scripts/lib/adapters/antigravity.mjs`, update `WHERE_RUNS_FOR_ANTIGRAVITY` to specify invoking `TypeName: "self"` with `Role: "relevo-builder"`, arming the watchdog timer via `schedule(DurationSeconds: 1200, TimerCondition: "<builderId>")`, and executing `manage_subagents(Action: "kill")` to tear down the worktree. Verify by running `node --test tests/adapter-antigravity.test.mjs`.
- [x] 1.2 In `scripts/lib/adapters/antigravity.mjs`, update `FOREGROUND_FOR_ANTIGRAVITY` to instruct the builder to terminate `relevo-dev` and `relevo-qa` via `manage_subagents(Action: "kill")` immediately after verifying each report. Verify by running `node --test tests/adapter-antigravity.test.mjs`.

## 2. Test Verification & Suite Validation

- [x] 2.1 Update assertions in `tests/adapter-antigravity.test.mjs` to verify that the rendered Antigravity `go` skill enforces `TypeName: "self"`, watchdog timer scheduling, and explicit subagent teardown. Verify tests pass with `node --test tests/adapter-antigravity.test.mjs`.
- [x] 2.2 Run the full test suite (`npm test`) and validate the change with `openspec validate antigravity-interactive-safeguards`.

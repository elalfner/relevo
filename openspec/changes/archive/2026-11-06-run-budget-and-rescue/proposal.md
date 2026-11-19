# Proposal

## Why

A pilot on a real project (tracked in #115) showed three gaps around the limits of a cloud run.

- `limits.run_max_turns` is counted by the runner on the main agent only. Builds used 106, 124 and 144 turns against a limit of 100, because 88 to 113 of them were subagent turns. Relevo already reports this after the run; nothing stops it (#116).
- When a run is cut by `--max-turns`, `--max-budget-usd` or the 60-minute job timeout, the work lives only in the runner's working tree and is lost. One build was cancelled at 59 minutes: nothing was saved, nothing was costed, and the log held no agent output (#117).
- The usage comment gives one cost for the whole run. Which agent spent it, on which model, is not visible, so nobody can tune models with data (#116).

## What Changes

- **A budget guard between agents.** After each subagent finishes, `go` records its tool calls and time from the `<usage>` block that ends its report, and before it launches another agent it asks the guard whether a limit was reached. The guard stops at `limits.run_max_turns` (counting the subagents together) or at the new `limits.run_max_minutes`, and `go` takes the failure path with the reason `run limit reached`, naming the agents that did not run.
- **The work is kept when a run stops at a limit.** The failure path commits and pushes the work in progress as `wip: stopped by limit (#N)` (same script, same scans). When the runner cuts the agent or the job is cancelled, a step of the go workflow that always runs does the same for the working tree that is left, and the comment says the work was kept.
- **`limits.run_max_minutes`**, default 50, the soft time limit of a run. `doctor` warns when it is not at least five minutes below the `timeout-minutes` of the build job.
- **The usage comment shows each agent.** Model, effort, turns, minutes, tokens and an estimated cost for the main agent and each subagent, and the real cost of each model; the hidden marker carries the same figures.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: a budget guard for subagents and time, and work kept at a limit or a cut.
- `configuration`: the `limits.run_max_minutes` setting.
- `execution-modes`: the consumption of a run is shown by agent and by model.

## Impact

- New: `scripts/run-budget.mjs`, `scripts/lib/run-budget.mjs`, `scripts/rescue-work.mjs`, `scripts/lib/rescue-work.mjs`.
- Changed: `scripts/lib/wip-commit.mjs`, `scripts/lib/run-usage.mjs`, `scripts/run-usage.mjs`, `scripts/lib/config.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/failure-comment.mjs`, `skills/go/SKILL.md`, `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, `templates/relevo.yml`, `templates/workflows/relevo-go.yml`.
- Docs: `docs/configuration.md`, `docs/execution.md`, `docs/commands.md` and their `.es.md` versions; `CHANGELOG.md`.
- Out of scope: counting the main agent's turns inside the run (the runner still cuts it), per-task checkpoints (#133), retrying after a usage limit (#118), choosing models (#134), and the digest.

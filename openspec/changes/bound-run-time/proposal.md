# Proposal

## Why

`limits.run_max_minutes` only stops the start of another agent, so a run passes it by as long as whatever is already running takes: one build passed a limit of 50 minutes by 43, and three sandbox builds passed a limit of 5 with a developer agent or the validation gate still running (#220). That run also posted no usage comment, and nothing says why a comment can be missing.

## What Changes

- Every unattended build gets a hard stop: the limit plus a fixed margin of 10 minutes, and never later than 5 minutes before the end of the build job.
- At the hard stop, a long command of the run (the test suite, the validation gate) is cut and says that it was cut by the time limit, and a subagent is refused further tool calls so that it ends and reports. The orchestrator then keeps the work through the existing path for `run limit reached`.
- A launch of a Relevo agent after the limit is refused by a hook of the plugin, so the check no longer depends only on the model asking the guard.
- The failure comment says how many minutes passed and what was cut.
- When a cloud run has no usage figures to report, a comment says so and why, where today nothing is posted.
- No setting is added. The default of `run_max_minutes` and the job template timeout do not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: a hard stop for what is already running, and the refusal of agent launches after the limit.
- `long-commands`: a command that passes the hard stop is cut and records no result.
- `execution-modes`: a run without usage figures says so instead of posting nothing.

## Impact

- New `hooks/hooks.json` and `scripts/time-guard.mjs`; the plugin starts shipping hooks, which run in every session where it is enabled and must do nothing outside a build.
- `scripts/long-run.mjs`, `scripts/lib/long-run.mjs`, `scripts/lib/run-budget.mjs`, `scripts/run-usage.mjs`, `scripts/lib/messages.mjs`.
- `skills/go/SKILL.md`, `skills/go/references/qa-run.md`, `agents/dev.md`.
- `templates/workflows/relevo-go.yml` (a project gets the job cap and the new usage comment only after `init` updates its workflow).
- `package.json` (`files`), `docs/configuration.md`, `docs/execution.md`, `docs/security.md` and their Spanish pages, `CHANGELOG.md`.
- Out of scope: Antigravity runs, which have their own time limit; the turns of the main agent; why the observed job outlived the 60 minutes of the template.

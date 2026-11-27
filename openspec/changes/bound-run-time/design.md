# Design

## Context

See proposal.md for the motivation. What exists today:

- `budgetStatus` (`scripts/lib/run-budget.mjs`) compares the minutes since the first entry of the phase log with `run_max_minutes`. `go` calls it before it launches an agent; nothing else reads the time.
- The developer's full test run and the validation gate go through `scripts/long-run.mjs`, whose detached supervisor spawns the command and has no time limit.
- The state of a build is its progress folder: `RELEVO_PROGRESS_DIR` in the cloud, found from the worktree on a machine (`scripts/lib/phase-log.mjs`).
- The build job of the template has `timeout-minutes: 60`; `doctor` already reads that value from the installed workflow.
- The step "Report what the run used" exits with no comment when there is no execution file, and posts nothing when `run-usage.mjs` prints nothing.
- The Claude Code documentation says that `PreToolUse` hooks of a plugin also fire for the tool calls of subagents, with `agent_id` and `agent_type` in the input. Not verified here: that they load with `--plugin-dir` inside `claude-code-action`.

Evidence from three sandbox builds is in #220: the checks between groups were made, and the overshoot was the step already running.

## Goals / Non-Goals

**Goals:**
- A bounded overshoot, with the work kept by the paths that exist today.
- The bound does not depend on the model remembering to ask.

**Non-Goals:**
- Killing the agent runner or the orchestrator. The runner and the job timeout stay as the last resort, with their rescue step.
- A security boundary: an agent with a shell can edit the state folder, as with the receipt of the gate.

## Decisions

### D1. One function gives the deadline
`run-budget` computes the hard stop for every consumer: first phase plus `run_max_minutes` plus 10, and, when the folder has a job deadline, the earlier of the two. The cloud workflow records the job deadline (start of the job plus `timeout-minutes` minus 5) when it starts the progress report, reading the timeout from the checked-out workflow with the function `doctor` uses. Why: one number, no second copy of the timeout. Alternative: an environment variable next to `timeout-minutes`; rejected, two values that can drift. Alternative: a new setting; rejected by the maintainer in favour of a fixed margin.

When the cap falls before the limit itself, the cap still applies and no agent is launched past it.

### D2. Enforcement lives where the time goes
Long commands: the supervisor starts the command in its own process group, ends the group at the deadline (a termination signal, then a kill after a few seconds) and writes the state `cut`, with its own exit code. `status` and `wait` print `cut` as the first word. A cut check is not recorded. Subagents: a `PreToolUse` hook refuses their calls. Alternative: a shorter `--max-turns`; rejected, turns are not time and the runner does not count subagent turns.

### D3. A hook of the plugin, deciding only on `agent_id` and the tool
`hooks/hooks.json` runs `scripts/time-guard.mjs` before every tool call. It denies (a) an `Agent` or `Task` call for a `relevo:*` agent after the limit, and (b) any call that carries `agent_id` after the hard stop. Everything else gets no decision, so the permission flow is unchanged. It never returns `allow` and never rewrites an input. The hook acts only when the progress folder has a phase log and no recorded outcome class, and the deadline passed less than 6 hours ago, so that a leftover worktree cannot block a later session. Any error exits 0 with no output.

Alternative: denying the orchestrator too; rejected, it has to commit, push and comment.

### D4. The skill treats a cut as a limit
After each agent, and when `wait` says `cut`, `go` asks the guard before it reads anything else of the result. A passed limit takes the failure path `run limit reached`: the open questions of a cut developer are not a spec defect, a `cut` gate is not restarted (unlike `interrupted`), and the finding names what was cut. `agents/dev.md` says that a refusal for time means: write the report and end.

### D5. The usage report says when it has nothing
`run-usage.mjs` keeps printing nothing for a caller that asks only for figures, and gets an option that prints, when there are none, a catalog message (English and Spanish) with the reason (`no execution log` or `no result in the log`) and the run link, without the marker. The workflow uses it only when the agent step was not skipped, and writes a warning annotation when posting the comment fails.

## Risks / Trade-offs

- [Hooks do not load with `--plugin-dir` in the action] → the first task verifies it in the sandbox before anything is built on it. If they do not, stop and revise this design.
- [The hook starts a Node process on every tool call of every session with the plugin] → it reads the environment and the folder first and exits at once; the task measures the cost.
- [A foreground command of a subagent started just before the hard stop runs on, up to the limit of the shell tool (10 minutes)] → long work is already told to use `long-run.mjs`; stated in the documentation as the remaining overshoot.
- [A subagent keeps trying after refusals] → each refusal repeats the instruction to end, and the turn and cost limits still apply.
- [A project whose normal suite needs more than the margin gets it cut] → the comment says so and the next step raises `run_max_minutes` and resumes from the checkpoints.
- [An installed workflow that is not updated has no job deadline] → the hard stop is the limit plus 10; `doctor` already warns when the limit is too close to the job timeout.

## Migration Plan

Released as any version. Long commands and the hook apply as soon as a project pins it. The job deadline and the new usage comment need `init` to update the workflow. Rollback: pin the previous version.

## Open Questions

- Why the observed build was not cut by the job timeout, and why it posted no usage comment. Neither changes this design: the hard stop does not rely on the job timeout, and a missing figure is now said.

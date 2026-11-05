# Design

## Context

What the pilot logs showed, and what was checked in them:

- The report of every subagent that the orchestrator receives ends with `agentId: …` and a block `<usage>subagent_tokens: N`, `tool_uses: N`, `duration_ms: N</usage>`. The orchestrator can therefore count the turns of each subagent as `tool_uses + 1`, the estimate `run-usage.mjs` already uses after the run.
- The execution log has, per run: `result.modelUsage` (cost and tokens per model), `system/task_started` (`tool_use_id`, `subagent_type`), `system/task_notification` (`tool_use_id`, `usage.total_tokens`, `tool_uses`, `duration_ms`), and `assistant` messages with `message.model`, `message.usage` and `parent_tool_use_id` (empty for the main agent).
- The runner's `--max-turns` counts only the main agent (31 turns in a build whose subagents took 113). `--max-budget-usd` includes the subagents.
- The failure path of `go` is run by the agent itself. A job cut by the runner or by `timeout-minutes` never runs it. The steps with `if: always()` of the build job do run after a cancellation (the report step did), and the working tree is still there until the cleanup step.

## Goals / Non-Goals

**Goals:**
- No new agent starts after a limit is reached, and the work done so far is on the branch.
- A cut run keeps its work through the same scans as any commit.
- The usage comment tells which agent used how much, so models can be tuned with data.

**Non-Goals:**
- Counting the main agent's turns inside the run, or stopping an agent in the middle of its work. The runner keeps doing the first; nothing here does the second.
- Checkpoints during the build (#133) and retries after a usage limit (#118).

## Decisions

1. **The turn limit covers the subagents as a second, separate cap.** The runner keeps limiting the main agent to `limits.run_max_turns`; Relevo limits all the subagents together to the same number. It is documented as two caps, not a sum, because the main agent's turns cannot be read inside the run without a hook or the session transcript, and neither was checked on a real runner. Alternative: a hook that counts every tool call (exact sum, but untested plumbing and it would have to let the rescue commands through).
2. **The guard fails open.** `run-budget.mjs` exits 0 and says `unknown` when it cannot read its inputs. It stops a run only on a figure it can see. Errors in the guard must not kill a build.
3. **The ledger is a file next to the phase log.** `$RELEVO_PROGRESS_DIR/budget.jsonl`, one line per finished agent, written with integers only. The orchestrator passes the numbers as arguments; it never passes the text of a report, which is untrusted. Without `RELEVO_PROGRESS_DIR` (a local run) the commands do nothing and `check` reports within limits, as `progress.mjs` does.
4. **Time starts at the first phase announced.** The phase log already records when `go` entered `planning`. The soft limit is `limits.run_max_minutes` from that moment. Default 50, so that the rescue step has the last minutes of the 60 of the job.
5. **One wip commit, two subjects.** `wip: rejected by QA (#N)` stays for QA. The new `wip: stopped by limit (#N)` is made for the limit and the cut. `isWipCommit` recognises both, so `fix` and the failure comment need no new logic; `fix` already continues from the last commit when it is a work-in-progress one. The branch is the one of the issue, as for QA, and no pull request is opened.
6. **The rescue is a script with the same guards.** `rescue-work.mjs` takes the decision the workflow already has, lists the files that changed in the working tree, and commits them through `commit-change` (protected paths, restricted files, temporary markers and credentials). It pushes only when the commit is made, never force-pushes and never touches a branch that already exists on the remote. It never fails the step: it prints `branch_state` (`kept`, `unsafe`, `not_pushed`, `existing`, `nothing`).
7. **The rescue runs only when the run ended without an outcome.** The workflow step checks, as the report step does, that the issue is still `building` or `ready`. A run that took the failure path itself already kept its work. The rescue runs before the report step, which then says whether the work was kept, and before the cleanup step.
8. **The new reason joins the failure path.** `run limit reached` is added to the reasons that keep the work and to the outcome class list as `limit`, so the usage marker and the digest can tell it from the others.
9. **Cost per agent is an estimate; cost per model is not.** The log has the real cost per model. Within a model, the cost is shared among the agents by their weighted tokens (input 1, output 5, cache read 0.1, cache write 1.25), which follow the structure of the published prices. The comment says "about" for each agent and states the real figure per model. Where a log lacks a piece, that figure is left out.
10. **`limits.run_max_minutes` is validated against the workflow.** `doctor` reads `timeout-minutes` of the build job of the installed workflow and warns when the setting is not at least five minutes below it. The template keeps 60.
11. **Version.** The templates change, so the version moves to 0.14.5 in `plugin.json`, `package.json`, the template headers and `RELEVO_VERSION`; the CHANGELOG entry is written on `dev` first.

## Risks / Trade-offs

- [The `<usage>` block is a runner detail, not a contract] → the parser reads only the three integers, ignores anything else, and the guard fails open; the comment states what could not be read.
- [Stopping between agents does not stop one long agent] → the time limit leaves ten minutes before the job timeout and the rescue step covers the hard cut.
- [A rescue commit can hold half-finished code] → it is on the issue's branch with no pull request, marked as work in progress, and `fix` verifies it before anything else.
- [The cost per agent can be off by the price ratios] → labelled "about", with the real per-model figure beside it.
- [The workflow step is not run on a real runner here] → the CHANGELOG says so under "Known limits", as earlier changes did, and the scripts are tested against real-shaped logs and temporary git repositories.

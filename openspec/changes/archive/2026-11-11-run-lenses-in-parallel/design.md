# Design

## Context

`qa-run.md` step 3 launches each lens in the foreground in a loop (receipt check, `progress.mjs lens`, launch, save, record). `lensSeconds` ends a lens when the next one begins or the next phase is announced. `agents/qa-spec.md` runs `node <plugin>/scripts/issue-sections.mjs`, a placeholder nobody resolves, which is why the agent searched with `find /`. The model plan (#134) and `escalate` are in place and untouched.

## Goals / Non-Goals

**Goals:** overlap the lenses; keep C1; correct per-lens seconds; no script search.

**Non-Goals:** the models of the lenses; parallel launch of the developer; changing the aggregation.

## Decisions

- **D1. One turn, several Agent calls.** The skill tells the agent to issue all the launches of a batch in one message. Alternatives: background agents with polling, rejected because the run is unattended and a turn that ends while one runs stalls it (the reason of "Subagents run in the foreground"). Parallel foreground calls keep that rule: the turn does not end until all report.
- **D2. C1 by checking before each batch.** Lenses are read-only, so a valid receipt stays valid for the whole batch; the check runs right before it, once per batch. The budget guard is also asked once per batch; a limit names the lenses of that batch and the next ones as not run.
- **D3. Batches come from a script.** `lens-plan.mjs --max-parallel <n>` adds `batches` (`[["spec","security","code","interface"]]` by default). The skill falls back to `--max-parallel 2` style batches only when a launch is refused for concurrency; the agent does not decide the grouping.
- **D4. Start and end records.** `lenses.jsonl` entries get an optional `event` (`start`, the default, or `end`). `lensSeconds` pairs each start with the first later end of the same lens and attempt; without an end it falls back to the next phase or the end of the run. Old logs (starts only, sequential) still read, with the next-phase bound. The decision that "a lens lasts until the next begins" is dropped.
- **D5. A failed lens is asked once more, alone.** It reuses the existing `lens report invalid` reason, so messages and the failure path need no new reason.
- **D6. Script paths.** `go` passes `issue_sections_script` (`${CLAUDE_PLUGIN_ROOT}/scripts/issue-sections.mjs`, resolved) to the `spec` lens and `qa-spec.md` uses it. It is the only agent script reference with a placeholder (checked with grep).

## Risks / Trade-offs

- A runtime that caps concurrency → the batches of D3.
- The agent launching them one by one anyway → the speed gain is lost, correctness is not (the receipt and reports are the same).
- Without an end record a lens is timed to the phase end, which overstates it → the skill records the end as each report arrives.

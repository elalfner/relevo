# Design

## Context

See proposal.md for the motivation. The usage marker of each run already carries `agents`, a list with one entry for the main agent (`name: 'main'`, with its `turns` and an estimated `cost`) and one per subagent, and `parseUsageMarker` returns it when every entry is well formed. The digest receives those parsed runs and today adds up only `turns`, `cost` and `tokens` (`sumUsage`). The estimates of the agents of a model add up to the real cost of that model (see `breakdown` in `run-usage.mjs`), so the cost of the main agent over the total cost of the same run is a share that adds up across runs.

## Goals / Non-Goals

**Goals:**
- One line in the digest that makes the share of the main agent visible over a week, from the data that already exists.

**Non-Goals:**
- Changing the marker, the usage comment of a run, `go`, the model plan or any limit.
- Deciding anything: a threshold, an alert or a change of model.

## Decisions

### D1. The share is computed from the runs the digest already reads
No new key in the marker and no new API call: the digest takes the `agents` of the parsed runs. Runs recorded before this change count at once, as long as their marker has the agent detail. *Alternative:* write a `main` figure into the marker. Rejected: it duplicates `agents`, and the runs already recorded would not have it.

### D2. A separate function, not a change of `sumUsage`
`mainAgentShare(runs)` in `run-usage.mjs` returns `{ runs, of, cost, total, turns, allTurns }` or null: `runs` is how many runs have both the cost of the main agent and the cost of the run, `of` how many runs the usage line counts, `cost` and `total` the sums of the main agent's cost and of the cost of those runs, `turns` and `allTurns` the sums of the main agent's turns and of all turns of those runs. `sumUsage` keeps its shape, because its result is compared whole in existing tests and read by other callers. `buildStatus` calls it next to `sumUsage` and puts the result in the report.

### D3. The share is a ratio over the same runs
The numerator and the denominator come from the same runs, so a run without the detail does not lower the share. A run needs the cost of its main agent and a positive cost of its own to count; the turns are added over the same runs. The cost may be notional: the ratio is the same.

### D4. The line, in both languages
`Main agent: about 55 % of the cost and 300 of 420 turns (3 of 4 runs).` In Spanish, `Agente principal: unos 55 % del costo y 300 de 420 turnos (3 de 4 ejecuciones).` Above half it adds `That is more than half: see "What a cloud run reports" in docs/execution.md.` (and its Spanish counterpart). Half is a way of reading, not a setting: the issue names it as the point at which a decision is taken, so the line says it in words and nothing else happens.

### D5. Placement
Right after the line of usage, before the line of outcomes, so that the lines about cost read as one block. With no run that has the detail the line is not written, and with no usage at all nothing changes.

## Risks / Trade-offs

- [The per-agent cost is an estimate (a share of the model's cost by the weighted input side)] → The line says "about", like the rest of the usage lines, and the docs say where the figure comes from.
- [A week of runs may be few, so the share moves a lot] → The line gives the number of runs it covers, so the reader can judge it.
- [Readers take "more than half" as an alarm] → The docs say it is a prompt to decide, name the three options and say that nothing is applied automatically.

## Migration Plan

None. A project gets the line when it raises `RELEVO_VERSION` of the digest workflow. Rollback is to not raise it.

## Open Questions

- Whether the median of the share per run is more telling than the share of the sums: left for when a week of data exists, and not needed to build this line.

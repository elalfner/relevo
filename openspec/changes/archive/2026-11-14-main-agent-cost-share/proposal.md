## Why

In the sandbox run of issue #90 the main agent (the orchestrator of `go`) used about 55 % of the cost of the run, on a model that the model plan does not choose, while the developer cost about 2 %. That is one run. The usage comment of each run already says the cost and the turns of the main agent apart from the other agents, but the daily digest adds up only the totals, so nobody can see the share over several runs, and the decision (a cheaper model for the orchestrator, fewer turns, or leaving it) has no data to rest on. See #151.

## What Changes

- **The daily digest gains one line about the main agent**, after the line of usage: the share of the cost that the main agent used over the runs of the last seven days, and the turns it used out of all of them. It is built from the `agents` that each usage marker already carries, so the marker of a run does not change and the runs that were recorded before this change count as soon as the digest is updated.
- **Only runs that say it are counted, and the line says how many.** A run whose marker has no agent detail, or no cost for the main agent, is left out of the share, and the line gives the number of runs it covers out of the runs of the usage line. The share is a ratio over the same runs, so it holds when the cost is notional.
- **The line points at the decision, and makes none.** When the share is above half, the line says so in words; the choice among a cheaper model for the orchestrator, fewer turns or leaving it stays with a person. Nothing changes the model, the turns or `limits.run_max_turns`, and `limits.run_max_cost` stays the hard stop.
- **The documentation says how to read the line**, in English and Spanish: where the figures come from, what a share over half means, and that the runner counts only the turns of the main agent against `limits.run_max_turns`.

Out of scope, as the issue says: changing the model of the orchestrator, or its turns, before there is data. Also out: a setting for the threshold (half is a way of reading, not a limit), and any change to the usage comment of a single run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status`: the daily digest shows the share of the cost and the turns of the main agent over the runs of the last seven days that have the detail, and says how many runs it covers.
- `documentation`: the execution page and its Spanish counterpart explain the line and how to use it.

## Impact

- `scripts/lib/run-usage.mjs` (`sumUsage` adds the main agent's figures), `scripts/lib/status.mjs` (the digest line, in both languages).
- `tests/usage.test.mjs` and the status tests; `docs/execution.md` and `docs/execution.es.md`.
- No change to the marker, to `go`, to the workflows or to `relevo.yml`. With no run that has the detail, the digest is as it was.

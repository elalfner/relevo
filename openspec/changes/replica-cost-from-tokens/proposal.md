# Proposal

## Why

Real runs in GitHub Actions (`relevo-sandbox`, #169) showed that the usage comment cannot say what the replicas cost. The execution log of a cloud run keeps the messages of the main agent only (no `parent_tool_use_id`), so the cost of a subagent cannot be estimated from its own messages. The saving of replication in dollars, which #167 asks to verify, cannot be read from the comment.

## What Changes

- When no message of a subagent is in the log, `run-usage.mjs` prices a subagent from the real cost of its model (`modelUsage`) shared by the `total_tokens` of the subagents on that model, and writes it as an estimate like every other cost.
- It does so only when the split is not a guess: the model is not one the main agent used, every subagent is on a model the log can name, and the subagents of that model are all replicas or none is. Otherwise the cost is left out and no total is claimed, as today.
- A log that has the messages of the subagents is read as before.
- Docs (English and Spanish) and `CHANGELOG.md` say it.
- Out of scope: overage in the quota phrase, attribution of QA rejections per target, a rename script, a pattern from another repository, and a newer runner version that might log subagent messages.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `execution-modes`: the usage comment shows the cost of the replicas when the log of a cloud run has the main agent only.

## Impact

- `scripts/lib/run-usage.mjs`, `tests/usage.test.mjs`, `docs/execution.md`, `docs/execution.es.md`, `CHANGELOG.md`.
- No guard changes: protected paths, the credential scan, the budget guard and `limits.run_max_cost` are untouched; no action is added or re-pinned, and no text is added to the message catalog (the estimate uses the existing phrases).
- The marker format does not change; the digest reads it as before.
- The version in `plugin.json` is not bumped here.

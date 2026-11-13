# Design

## Context

`breakdown()` in `scripts/lib/run-usage.mjs` prices an agent as a share of the real cost of its model, weighted by the input side of the messages it sent (`parent_tool_use_id`). A cloud run logs no such messages for subagents (#169), so every subagent has no cost. The log still has `total_tokens` in each `task_notification`, the real cost per model in `modelUsage`, and the model asked for in each `Agent` call (an alias such as `haiku`).

## Goals / Non-Goals

**Goals:**
- A cost for each replica, as an estimate, when the log allows it without guessing.

**Non-Goals:**
- Weighting `total_tokens` by cache reads: the log does not split them for a subagent.
- Any change of the marker, the catalog or the digest.

## Decisions

- **Fallback, not replacement.** `subagentCost(id)` is `costOf(id) ?? costByTokens(id)`, and `costByTokens` returns null at once if any subagent has messages in the log. The existing path is untouched. Alternative: always use tokens; rejected, the weighted input side is closer to the price.
- **Name the model from the call.** The alias of the `Agent` call matches the key of `modelUsage` exactly or as a single case-insensitive substring (`haiku` in `claude-haiku-…`). Zero or several matches means unknown, and then nothing is estimated.
- **Sole-model rule.** The model must not be one of the main agent (its messages are in the log), every subagent must resolve to a model, and the subagents on the model must be all replicas or none. Then the real cost of the model is spent only by those subagents, and only the split between them is an estimate. Alternative: split a shared model by tokens too; rejected, the issue asks that the split not be a guess.

## Risks / Trade-offs

- Tokens count a cache read as an input token, so a replica that read more cache looks dearer than it was. The comment already says "about".
- A runner that logs subagent messages makes the fallback unused; nothing breaks.

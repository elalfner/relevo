# Proposal

## Why

PR #172 (#167) made the `kept` comment of a cut run say that `relevo:ready` resumes from the last checkpoint instead of "from the start". The renderer takes an optional `checkpoints` number and has a wording for a known count and for zero, but `templates/workflows/relevo-go.yml` never sends it, so every real comment uses the generic wording "resume from the last point saved on the branch". The specific wordings are tested only with synthetic data and never reach a person. This change closes that gap. Part of #167 (follow-up of the "Check 2" finding); part of #115, no guard changes (C2).

## What Changes

- The rescue step reports how many checkpoints the branch of the issue holds over the base branch (the commits with the subject `wip: checkpoint k/n (#N)` for this issue), next to `state`, `branch` and `detail`. When it cannot count (no base known, a git error, a branch that is not the issue's), it reports nothing, never `0`.
- The report step of the go workflow passes that number to `render-message.mjs` as `checkpoints`. An empty value stays absent, so the comment keeps the generic wording instead of claiming that no checkpoint exists.
- No text changes: the catalog already has the three wordings.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `go`: the comment of a run cut by the runner names the number of checkpoints the branch holds when it is known.

## Impact

`scripts/lib/rescue-work.mjs` or `scripts/lib/rescue-run.mjs` and `scripts/rescue-work.mjs` (count and output), `templates/workflows/relevo-go.yml` (two lines: the env of the report step and the JSON it builds), `tests/rescue-work.test.mjs`, `tests/workflow-comments.test.mjs`, `CHANGELOG.md` (unreleased). The version is not changed. The template edit is small and confined to the rescue and "ended without an outcome" steps; other changes also edit `relevo-go.yml`, so it is kept to those lines. Out of scope: any text of the catalog, the resume decision (`resume-check.mjs`), the usage-limit retry.

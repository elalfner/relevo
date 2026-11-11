## Why

A pilot team put guidance for the agents (run only the tests of what you touch, use a script for repetitive files, read bounded ranges, do not rerun what the gate ran) in the `context` of `openspec/config.yaml`. The developer never saw it: `go` gives the developer the apply output's context files and tasks, and nothing in `agents/dev.md` says that OpenSpec's `context`, the `rules` for `tasks` or the apply guidance exist. In the measured build the developer spent about half the cost re-reading a context of about 120 thousand tokens on every turn. Part of #115, issue #130.

## What Changes

- `go` hands the developer the configured guidance explicitly: `context` and `operationGuidance` from `openspec instructions apply --json`, and `rules` from `openspec instructions tasks --json`. A repository without any of them gets nothing extra, and the build log says only the default guide applies.
- `agents/dev.md` has a fixed cost guide (a few lines, always present): bounded reads, a script for repetitive files, run only the tests of what changed, never rerun what the gate ran.
- `agents/dev.md` says what the configured guidance is and how it ranks: it follows the project rules, so it wins over the default cost guide, and it never overrides the rules of Relevo.
- Tests for both, a CHANGELOG entry.

Out of scope: splitting the build into batches to shorten the context (own issue), the QA lens agents (another change edits them), the version number.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the developer is given the configured OpenSpec guidance.
- `role-skills`: the developer's default cost guide, with a size limit.

## Impact

- `agents/dev.md`, `skills/go/SKILL.md`, `CHANGELOG.md` (unreleased), `tests/agents.test.mjs` (or a new test file), documentation that lists what the developer is given, if any.
- No script, no dependency, no change to `relevo.yml` or to the version.

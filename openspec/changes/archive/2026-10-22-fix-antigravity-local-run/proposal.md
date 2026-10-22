# Proposal

## Why

The review of the last three commits found that `go-local.mjs` with `agent.build: antigravity` cannot start: it runs `agent-guard.mjs run -- agy -p "/relevo:go 42"`, and `agent-guard.mjs run` has no such form (it needs `--prompt`, `--summary` and `--timeout-minutes`, and starts `agy` itself), so it exits 2 with a usage error. The test added for it only compares the planned command and uses a fake runner, so the suite passes. The same commit set also left the review step that returns to the base branch unsafe when it runs from a worktree, and the changelog and the version control of `.agents/` unsettled.

## What Changes

- `go-local.mjs` with `agent.build: antigravity` calls `agent-guard.mjs run` with the arguments the guard accepts (`--prompt`, `--config`, `--timeout-minutes`, `--summary`), so the turn and token limits of `relevo.yml` apply as the spec already says.
- A test runs the real argument parser of `agent-guard.mjs` against the planned command (with a stub `agy`), so a command the guard rejects can no longer pass the suite.
- The step of `review` that switches back to the base branch only acts in the main checkout. In a separate worktree, or when the base branch is checked out elsewhere, it is skipped and says so, instead of failing after the pull request was opened.
- The changelog records the local Antigravity run, the isolated interactive run and the builder cleanup, and corrects the known limit that says `--local` starts `claude`.
- The generated OpenSpec files of Antigravity in `.agents/` (`skills/openspec-*`, `workflows/`) stop being versioned and are ignored; the skills installed with `npx skills` and `.agents/plugins/` stay tracked.

## Capabilities

### Modified Capabilities
- `execution-modes`: the local run with Antigravity SHALL start through arguments the run guard accepts and SHALL fail visibly, before creating anything beyond the worktree, if the guard rejects them.
- `review`: returning to the base branch SHALL only happen where the base branch can be switched to, and SHALL never fail the review after the pull request exists.

## Impact

- `scripts/lib/go-local.mjs`, `tests/go-local.test.mjs` (plus a test that spawns the real guard parser).
- `skills/review/SKILL.md` (shared by Claude Code and Antigravity), `tests/skill-review.test.mjs`.
- `CHANGELOG.md`, possibly `.gitignore` for `.agents/`.
- Claude Code users: no behavior change in `go`; `review` only becomes safer inside worktrees.

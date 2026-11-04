# Proposal

## Why

When a cloud build ends, the agent sets `built`, `qa-failed` or `needs-spec` with `github.token`. GitHub starts no workflow from an event made with that token, so `relevo-queue` never hears about the freed slot. Issues waiting as `relevo:queued` stay there until the `*/30` cron happens to run, and GitHub-hosted schedules can be hours apart. `relevo-ship.yml` already solves the same problem after its close; `relevo-go.yml` does not.

## What Changes

- `relevo-go.yml` gains a third job, `requeue`, that dispatches `relevo-queue.yml` once the build ended in any state (and when `decide` fails after claiming the issue).
- The job has its own permissions (`actions: write` only). The `build` job, whose token the agent can use, does not get `actions: write`.
- The job never fails the run and tolerates a repository without `relevo-queue.yml`.
- Template version bump to 0.14.3, so `/relevo:init` reports older copies as different.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: adds the requirement that a finished or failed build starts the queue evaluation at once, and that this does not widen the agent's token.

## Impact

- `templates/workflows/relevo-go.yml` (new job, version header and `RELEVO_VERSION`), `relevo-queue.yml` version header, `.claude-plugin/plugin.json`, `CHANGELOG.md`.
- `tests/workflow-go.test.mjs` (job shape, least privilege).
- Docs that describe when the queue runs (`docs/*.md` and their `.es.md` versions).
- Out of scope: the `relevo-queue` logic, a `workflow_run` trigger, and the local `/relevo:go` path (its labels come from the person's token and already fire events).

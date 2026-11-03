# Proposal

## Why

An issue that ended in `relevo:qa-failed` with no branch on the remote (for example because the safe commit refused the work) cannot be built again without being labelled `relevo:ready`. `go-plan` only plans issues that are `ready`, `queued` or `blocked`, and `gather` does not even read `qa-failed` issues, so `go-local.mjs <n>` finds nothing. Labelling `ready` starts the cloud run at once (`relevo-go.yml`, the `relevo:ready` label event), so a person who wants to rebuild on their own machine has to pause the cloud for the whole repository with `RELEVO_CLOUD_GO=off`.

## What Changes

- New `--retry` flag for `go-local.mjs`, for `/relevo:go <n> --local` and for `/relevo:go <n>`. It is passed to the planner: `go-plan.mjs --only <n> --retry --apply --claim`.
- With `--retry`, an issue in `qa-failed` is planned like a `ready` one: the same gates (permission, milestone, assignee, specification, dependencies, capacity) apply, and the claim moves it from `qa-failed` to `building`. The issue never gets `ready`, so the cloud workflow does not start.
- The person who runs it takes the place of the person who applied `ready` in the permission gate: write access, or maintainer when `trust` is `public`.
- A retry is refused when `origin/feature/<n>-*` exists, pointing to `/relevo:fix <n>` or to deleting the branch.
- No extra comment at the claim. The result is the usual `built` or `qa_failed` message.
- The `rebuild` next step added by the previous change mentions `go-local.mjs <n> --retry` next to relabelling `ready`.

Out of scope: the `assigned-secret` scanner pattern, pushing wip branches or uploading artifacts, and retrying issues in `needs-spec` or `blocked`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the planner can plan a `qa-failed` issue without a branch when asked to retry it.
- `execution-modes`: a local run can be started as a retry.

## Impact

- `scripts/go-plan.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/github.mjs` (read `qa-failed` issues and the permission of the person who runs the retry).
- `scripts/go-local.mjs`, `scripts/lib/go-local.mjs`, `skills/go/SKILL.md` (flag and step 1).
- `scripts/lib/next-step.mjs` (hint of `rebuild`), docs (`docs/execution.md`, guide).
- Tests of the planner, the local run, the skill and the next step.

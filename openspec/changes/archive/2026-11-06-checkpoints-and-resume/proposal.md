# Proposal

## Why

A build is one developer invocation of about 22 minutes, and everything before its end lives only in the working tree of the runner (#133, part of #115). The change `run-budget-and-rescue` keeps the work when a run stops at a limit or is cut, but only once, at the end: a cut still costs the minutes since the start, and the next run starts from nothing. The tasks of the OpenSpec change (`tasks.md`, with sections and checkboxes) are a natural grid for checkpoints.

## What Changes

- **The developer is launched once per section of `tasks.md`.** `go` splits the pending tasks into groups (one per section; a build with three pending tasks or fewer stays one group) with the new `task-groups.mjs`, launches `relevo:dev` for one group at a time, and after each group commits the changed files as `wip: checkpoint <k>/<n> (#N)` and pushes the branch of the issue. Each launch starts with a shorter context.
- **A checkpoint goes through the same safe commit as any other** (protected paths, restricted files, markers, credentials). A refused checkpoint stops the build with the existing reason for that refusal.
- **A later run resumes.** When `origin/<branch>` exists and every commit on it over the base is one of Relevo's own (the specification, a checkpoint, or the work kept at a limit), its tip carries the hash of the issue text, and the text has not changed, `go` continues from the branch and builds only the pending tasks. In any other case it stops with `branch already exists` as before.
- **The rescue and the failure path accept a branch that this run created.** "Never touch a branch that already exists" becomes "never overwrite": a push that is a fast-forward of the remote branch is allowed, any other is refused.
- The commits of the checkpoints stay in the history of the branch (no force push); the squash of `ship` removes them from the base branch.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: checkpoints per section of tasks, resuming from the branch, and the fast-forward rule.

## Impact

- New: `scripts/task-groups.mjs`, `scripts/lib/task-groups.mjs`, `scripts/checkpoint.mjs`, `scripts/resume-check.mjs`, `scripts/lib/resume-check.mjs`.
- Changed: `scripts/lib/wip-commit.mjs`, `scripts/lib/rescue-work.mjs`, `scripts/rescue-work.mjs`, `skills/go/SKILL.md`, `skills/fix/SKILL.md`, `docs/configuration.md`, `docs/execution.md`, `docs/guide.md` and their `.es.md` versions, `CHANGELOG.md`.
- Out of scope: guided replication (#135), per-task launches, checkpoints in `fix`, and counting the cost of a resumed run across runs.

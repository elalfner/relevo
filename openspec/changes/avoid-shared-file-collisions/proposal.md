## Why

In the Vue pilot (#115), screens built in parallel from the same pattern kept conflicting on the same few registry files: the navigation list, the router, the generated GraphQL types, the translation file and a glossary. At least six pull requests needed a merge of the base branch with a manual resolution, often by a person after the build. With `limits.concurrent_agents` above 1 the collision is predictable from what the issues say, but nothing in the queue looks at it, and nothing in `go` integrates the base branch before the hand-off.

## What Changes

- **The planner recognises issues that name the same files.** For each candidate issue it reads the files the issue names: the local paths of "Code pointers" and "Design reference", the `file:` inputs of "External inputs" and the entries of `Allow-paths:`. An issue that names a file that another issue also names, where that other issue is active (`building`, `built`, `in-review`, `pr-open`, `changes-requested`) or is ahead of it in the queue, waits.
- **The waiting issue is `queued` with its own reason.** One comment says which file and which issue it waits for, mentions nobody, and is not repeated. The issue starts when the other one is merged (closed as completed), through the existing queue evaluation. Nothing else about the order changes: only the issue behind waits, and a `blocked` issue ahead does not hold anyone.
- **The wait has a bound.** `limits.shared_file_wait_hours` (default 24) is counted from the first time the issue waited for that reason. When it passes, the issue starts anyway and its hand-off message says which files it shares with which issues. The wait never starves the queue and never turns into a dependency.
- **Two shapes of overlap do not wait.** A file that matches `queue.append_only` in `relevo.yml` (a list that issues only add lines to, where a merge is trivial) does not count as shared. A generated file is not a shared file either, because it is resolved by regenerating; see the next point.
- **`go` integrates the base branch before the hand-off.** After QA passes and before the branch is pushed, `go` asks whether the base moved. If it did and the merge is conflict-free (`probeMerge`), it merges the base, re-runs the gate (the QA checks that run commands) and hands off only if it still passes. A generated file that conflicts is regenerated with the command the project gives in `integration.regenerate` and the merge goes on. Any other conflict ends in the existing `conflict` class with the list of conflicted files in the message, and the branch is pushed unmerged so a person (or `fix`) can resolve it. The files `review` already hands to the developer agent keep that path.
- **The documentation says it**, in English and Spanish: the configuration page, the guide and the execution page.

Out of scope: redesigning the registries of the target project (that belongs to the project), choosing the order of merges, and merging pull requests. Guessing from the tasks which files an issue will touch is also out: the queue decides before the specification is written, so it can only read what the issue says. An issue that names no files is never held.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: a shared-file gate in the queue (after the dependencies, before the limits), a bound on that wait, and an integration of the base branch with a re-run of the gate before the hand-off.
- `issue-lifecycle`: `queued` has a third reason, a file shared with another issue, with its single comment that names the file and the issue and mentions nobody.
- `configuration`: `queue.append_only`, `integration.generated`, `integration.regenerate` and `limits.shared_file_wait_hours`, validated like the other settings and documented.
- `documentation`: the pages above, in both languages.

## Impact

- `scripts/lib/issue-parse.mjs` (the files an issue names), `scripts/lib/plan.mjs` (the gate and its bound), `scripts/lib/github.mjs` (read the active lifecycle states and the time the wait began), `scripts/lib/config.mjs` and `scripts/lib/messages.mjs` (settings and the comment).
- `skills/go/SKILL.md` and `scripts/lib/merge-probe.mjs` plus `scripts/lib/conflict-handoff.mjs` (the integration step and the generated-file regeneration).
- `templates/workflows/relevo-queue.yml` needs no change: the queue already evaluates on every relevant event and on a schedule.
- Depends on the in-progress change `build-preflight-gates` only for the `conflict` outcome class that it adds to the usage record.
- No breaking change: with no overlap, or with the new settings left at their defaults, the queue behaves as before.

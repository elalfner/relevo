# Proposal

## Why

When a run stops at a limit, the rescue commits what is in the working tree as `wip: stopped by limit (#N)`. In the real runs of #167 that commit held finished tasks (the replica `2.1` and the fixes of QA) but named none of them: only the checkpoints carry the `Relevo-Tasks:` trailer, because the skill passes them the tasks of their group, and the rescue step of the workflow does not know any. So a lookup by task (`replica-plan.mjs template --section 2`) could not find the work in that commit, and, worse, a run cut during the template group leaves the template in a commit that no lookup by section can find, so the resumed build has to read it from `git log`.

## What Changes

- The rescue commit of a run stopped at a limit names the tasks it holds as `Relevo-Tasks: <ids>`: the tasks checked `[x]` in the `tasks.md` of the change, in the working tree, that no earlier commit of the branch over the base already names. With none, or when `tasks.md` cannot be read, the commit is as before, with no trailer.
- `replica-plan.mjs template --section K` also finds a `wip: stopped by limit (#N)` commit whose trailer names a task of section K, next to the checkpoints.
- The checkpoints keep taking their tasks from `--tasks`, and the commit after a QA rejection (`wip: rejected by QA`) is not changed.
- `docs/execution.md` and its Spanish version say it; `CHANGELOG.md` entry under Unreleased.
- Out of scope: the QA-rejection commit, and counting the limit commit as a checkpoint (the count of checkpoints and the resume check stay as they are).

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `go`: the work kept at a limit names the tasks it holds, and the template of a replicated build is found in it.

## Impact

- `scripts/lib/rescue-work.mjs` (and `rescue-run.mjs`), `scripts/lib/task-groups.mjs` (a reader of the checked tasks), `scripts/replica-plan.mjs`, the docs, and their tests (`tests/rescue-work.test.mjs`, `tests/replica-resume.test.mjs`, a test of the reader).
- No guard changes: the commit still goes through the same safe commit and scans, protected paths, credential scan, budget guard and `limits.run_max_cost` are untouched, and no action is added or re-pinned. The trailer holds only ids like `2.1`, through `cleanTaskIds`.
- A branch with limit commits made before this change has no trailer and is found as before. The version in `plugin.json` is not bumped here.

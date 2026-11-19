# Design

## Queue count: fix the text, not the count

`plan.mjs` builds `runningSet` from the running runs and the `building` issues, then adds each issue it starts in the same pass. A queued issue's `active` and `active_issues` come from that set. Counting only the already-running issues would need a second set, and would hide that a slot is taken by an issue that starts a moment later, which is what the person waits for. The smaller and more accurate change is the label: "Running or starting now". The planner and its tests are untouched.

## The kept comment

`resume-check.mjs` decides what a re-applied `ready` does. On the issue branch of a `kept` rescue the tip is a checkpoint or the `wip: stopped by limit` commit, so the run resumes unless the issue text changed or a person committed. The renderer gets an optional `checkpoints` number:

- `checkpoints` ≥ 1: resumes from the last checkpoint (k saved), builds only the pending tasks.
- `checkpoints` = 0: no group was checkpointed; it resumes from the specification and the kept work and builds the tasks not done.
- absent (what the workflow sends today): resumes from the last point saved on the branch.

All three add that a changed issue text or a commit by a person stops the run with `branch already exists`, and that deleting the remote branch starts over. The `rescue/` branch keeps its text. The workflow template is not edited here; passing `checkpoints` would need `templates/workflows/relevo-go.yml` and is left to a later change.

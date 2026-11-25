# Design

## Context

See proposal.md for the motivation. The facts that shape the approach:

- The progress check (`readTreeFacts` in `scripts/lib/progress.mjs`) counts the boxes of `tasks.md` in the working tree. A local build, an interactive one and a cloud one read the same files, so a mark made earlier shows up in all of them with no script change.
- `agents/dev.md` has one rule about marks, in its "Tasks" section, and it does not say when. `go` launches the developer once per group, and after each group `checkpoint.mjs` reports the `unmarked` tasks of the group and `go` relaunches the developer once for them.
- The developer never commits. `go` commits a checkpoint between launches through the safe commit, and the rescue commit (`wip: stopped by limit`) keeps the working tree of a run that is cut, naming the tasks that are checked.
- OpenSpec's `spec-driven` schema declares `apply.tracks: tasks.md` and the instruction "mark complete as you go". Relevo's developer is an agent of its own, so that behaviour has to be written into it.

## Goals / Non-Goals

**Goals:**
- The progress of a build rises task by task, whatever the number of groups.
- The rule is one place and one wording for build, fix and replica.

**Non-Goals:**
- A commit per task, or a launch per task.
- Any change to the scripts, the checkpoint, `--resume`, the replicas or the rescue.
- Reading the progress from `openspec instructions apply` instead of the boxes (see the change `read-tasks-like-openspec` for how the boxes are read).
- A guard that saves a mark made before a runner died.

## Decisions

- **D1. The rule is one sentence in the "Tasks" section of `agents/dev.md`.** It keeps the existing "only when its code exists and works" and adds when: as soon as the task is done and its own checks pass, one edit per task, before the next. A task that is the full test run is marked when that run passes. Alternative: have `go` tick the boxes from the checkpoint. Rejected: the developer is the only one that knows a task is done, and the only edit it is allowed is that very box.
- **D2. No commit per task.** Only `go` commits, so a commit per task means one developer launch per task, each re-reading the whole change, which is what grouping avoided. A cut at a limit already keeps the work, and the checkpoint only matters when a runner dies, where a group is lost at most. Alternative considered: cap the size of a group to get finer checkpoints. Left for when a real loss is seen, because it costs launches and pushes for a risk that has not shown up.
- **D3. One rule for every mode.** The fix mode builds the corrections as tasks, and the replica has one task that it already marks at the end, so the single section covers all three.
- **D4. A lost mark is accepted.** A mark lives in the working tree until the checkpoint commits it. If the runner dies in between, the mark is lost with the code it describes, which is consistent, and no extra save is added.
- **D5. A mark is never removed.** Taking a mark back would make the progress go down and would make `--resume` rebuild work. A task that turns out wrong is corrected in place; QA catches what is left.
- **D6. A test pins the wording.** `tests/agents.test.mjs` already asserts rules of the developer agent (never commits, never edits the specification). One more assertion keeps this rule from being edited out.
- **D7. The unmarked-tasks relaunch stays.** It is the safety net when the developer still forgets, and it costs nothing when every task is marked.

## Risks / Trade-offs

- [One edit per task adds turns, about 5 to 20 per build, and they count against `limits.run_max_turns`] → the limit is a default that a repository can raise, and the cost is small against a build of about 100 turns. The changelog says it.
- [A model may still mark everything at the end] → the test pins the wording but cannot force the behaviour; the unmarked relaunch covers the missing marks, and a real build of three tasks or fewer must show the count rising (the verification task).
- [A mark on the wrong line] → the checkpoint's `unmarked` list finds a task left open, but not a box ticked by mistake; QA reads `tasks.md` against the code. Accepted as before.
- [The renderer of another agent copies `agents/dev.md`] → the text is neutral and edited once, so the rule reaches the other adapters, and their tests run with the suite.

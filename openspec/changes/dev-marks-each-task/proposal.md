# Proposal

## Why

The progress comment of a build says `Tasks: 0 of N` for the whole development when the build is small enough to be one group (three tasks or fewer), and rises only group by group in a longer one. The developer agent marks its tasks as `[x]` when its launch of a group ends, because its rule says only that a task is marked "when its code exists and works" and not when. Nothing is wrong with the reader: the progress check counts the boxes of `tasks.md` in the working tree every 30 seconds. The boxes simply are not ticked until the end. The two pilot builds in `docs/pilot-findings.md` showed it (`0 of 2` during development, `2 of 2` only at QA), and `go-visibility` left it out on purpose, saying it would be "one line in the developer agent if builds still look stopped afterwards". They do.

OpenSpec already defines the behaviour. The `spec-driven` schema says of the apply phase "mark complete as you go", and its apply skill ticks each task as it finishes it. Relevo does not use that skill (its developer is an agent of its own, unattended and paired with QA), so the behaviour did not come along.

## What Changes

- **The developer marks each task as it finishes it.** The rule of `agents/dev.md` says when: as soon as the code of that task exists and its own checks pass, one edit per task, before the next one, never all at the end of the launch. A task that is itself the full test run is marked when that run passes. The checkbox stays the only edit the developer may make to the change's files, and one rule covers build, fix and replica modes.
- **A mark is never taken back.** A developer that finds an earlier task wrong while building a later one corrects the code and leaves the box; QA is who catches what is still wrong.
- **A test keeps the rule.** `tests/agents.test.mjs` asserts that `agents/dev.md` asks for the mark when the task finishes.
- **The documentation says what is true.** The sentence of `docs/execution.md` (and its Spanish page) that says the developer marks its tasks when its launch ends is corrected, and the changelog records the change and its cost.
- No script changes. The checkpoint, the unmarked-tasks relaunch, `--resume`, the replicas and the rescue commit behave as before.
- Not here: a commit per task. The developer never commits, `go` does, between launches, so a commit per task would need a launch per task, and a run cut at a limit already keeps its work as `wip: stopped by limit`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the developer marks each task when it finishes it, and never takes a mark back.

## Impact

- `agents/dev.md` (the "Tasks" section), `tests/agents.test.mjs`, `docs/execution.md` and `docs/execution.es.md`, `CHANGELOG.md`.
- Cost: one edit per task, about 5 to 20 turns in a build, counted against `limits.run_max_turns` like any turn of a subagent.
- Not tested end to end: that the progress comment of a real cloud build now rises inside one group.

# Proposal

## Why

Relevo builds on OpenSpec's `spec-driven` schema and reads `tasks.md` by itself to split the work into groups, show the progress, find the tasks left open and plan replicas. That is done with several regular expressions in `scripts/` (`tasks-file.mjs`, `task-groups.mjs`, `replica-plan.mjs`, `fix-guard.mjs`, `build-preflight.mjs`, and the progress reader), and two things follow.

- **They do not agree with OpenSpec, nor with each other.** OpenSpec says a box holding only `x`, in either case and with any spacing, is done (`- [ x]` too), and that every other marker (`- [~]`, `- [-]`, `- []`) is unfinished and still part of the list. `countTasks` matches only `- [ ]`, `- [x]` and `- [X]`, so the other forms count neither as done nor in the total, and `uncheckedTasks` finds only `- [ ] N.M`. The build preflight accepts `*` and `+` bullets, the group splitter only `-`. The number Relevo shows can differ from the one `openspec instructions apply` reports, and the code that decides what is left to build can differ from the code that decides what to count.
- **Nothing checks the schema.** OpenSpec lets a project choose another schema, and the schema says which file tracks the tasks (`apply.tracks`). Relevo assumes `spec-driven` and `tasks.md` and searches for neither in `doctor`, the build preflight or `go`. A repository on another schema would be split into wrong groups and shown a wrong progress, with no message.

## What Changes

- **One reader of the boxes, following OpenSpec's contract.** A single function in `tasks-file.mjs` says which lines are tracked tasks and which are done, as OpenSpec does, and every script that reads boxes uses it. A contract test compares it, on a set of fixtures, with the numbers that `openspec instructions apply --json` reports for the same file.
- **A build refuses a schema it does not understand.** Before the developer starts, `go` reads the schema of the change and whether task tracking is configured from the apply instructions, and stops when the schema is not `spec-driven` or the tasks are not tracked, with a reason that names what to change. The message exists in English and Spanish.
- **`doctor` reports the same problem before a build is asked for.** It reads the default schema of `openspec/config.yaml` and reports a failure, with its fix, when it is not `spec-driven`.
- No change to how groups, checkpoints, replicas or `--resume` behave for a project on `spec-driven`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the tasks are counted as OpenSpec counts them, and a build stops on a schema it does not understand.
- `init-doctor`: `doctor` checks the schema of the OpenSpec project.

## Impact

- `scripts/lib/tasks-file.mjs` and the readers named above, `scripts/lib/build-preflight.mjs` or the `go` step that reads the apply instructions, `scripts/lib/doctor.mjs`, `scripts/lib/messages.mjs` (English and Spanish), their tests, `docs/execution.md`, `docs/guide.md` and their Spanish pages, `CHANGELOG.md`.
- A project that wrote tasks with `*` or `+` bullets, if OpenSpec does not count them, will see its tasks not counted: the contract test settles which bullets OpenSpec accepts and the function follows it.
- Not tested end to end: a build on a repository whose schema is not `spec-driven`.

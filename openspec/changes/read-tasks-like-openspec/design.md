# Design

## Context

See proposal.md for the motivation. What was found in the code and in OpenSpec 1.16.0:

- The boxes are read by regular expressions in `tasks-file.mjs` (`countTasks`, `uncheckedTasks`, `correctionSection`), `task-groups.mjs`, `replica-plan.mjs`, `fix-guard.mjs` and `build-preflight.mjs`. They differ in the bullets they accept (`-` only, or `-`, `*`, `+`) and in the boxes they accept (`[ xX]`).
- OpenSpec's `spec-driven` schema declares `apply.tracks: tasks.md` and states the contract for boxes (done is a box with only `x`, any case and spacing; every other marker is unfinished; a line with no box is untracked).
- `openspec instructions apply --change <id> --json` returns `schemaName`, `taskTrackingConfigured`, `state`, `progress` (`total`, `complete`, `remaining`) and a flat list of `tasks` with a position as `id`, the description, `done`, `sourcePath` and `line`. It has no sections, and the task id is not the `1.1` of the file.
- `go` already runs that command (twelve call sites), reads `progress.remaining` after the last group, and has a closed list of OpenSpec commands that includes it.
- `doctor` reads the project through its probes (`scripts/lib/doctor.mjs`) and already knows whether `openspec/config.yaml` exists.

## Goals / Non-Goals

**Goals:**
- One rule for what a task is and when it is done, equal to OpenSpec's, used by every reader of the boxes.
- A schema Relevo does not support stops a build before it spends a model, and `doctor` says so earlier.

**Non-Goals:**
- Supporting another schema. Relevo supports `spec-driven` and says so.
- Replacing the reader with the CLI. The groups need sections and the `1.1` ids, which the JSON does not carry, and the progress check would spawn a process every 30 seconds for numbers it can read from the file.
- Changing the task format that the issue and the specification write.

## Decisions

- **D1. One function decides, and the others call it.** `tasks-file.mjs` gets one reader that returns each tracked line with its marker, its id (`N.M` when it has one) and whether it is done; `countTasks`, `uncheckedTasks` and the readers of the other scripts are built on it. Alternative: tighten each regular expression in place. Rejected: that is how they drifted apart.
- **D2. A contract test ties the function to the CLI.** On a set of fixture files (`- [ x]`, `- [~]`, `- []`, upper-case `X`, plain bullets, nested lists, `*` and `+` bullets), the test creates a temporary change, runs `openspec instructions apply --json` and compares `total` and `complete` with the function. The fixtures that disagree decide the open question below. The test is skipped with a message when `openspec` is not installed; the CI installs it.
- **D3. The schema is read from the apply instructions, not from the configuration, at build time.** `go` reads `schemaName` and `taskTrackingConfigured` from the output it already asks for, because a change may carry its own schema and the configuration only says the default. The failure reason is `unsupported schema: <name>`, which names the schema found, and the recovery is a new entry `schema` of the table of next steps, in English and Spanish. A script, `schema-guard.mjs`, makes the check so that no model decides it. Alternative: parse `config.yaml` in `go`. Rejected: it misses a change with its own schema and duplicates what OpenSpec resolves.
- **D4. `doctor` reads the default schema from `openspec/config.yaml`.** There is no change to ask in a repository at rest, so the configuration is the source. Another schema is a failure with a fix, not a warning: a build will refuse it. The file is read by its `schema:` line and not with the YAML reader of Relevo, which does not read the block scalars (`context: |`) that OpenSpec configurations usually have.
- **D5. Where the check runs in `go`.** In the step that reads the apply instructions before the first launch of the developer, so no model is spent. An optimisation as the preflight is: the build also fails later if the tasks cannot be read.

## Risks / Trade-offs

- [Narrowing the accepted bullets rejects tasks that an issue wrote with `*` or `+`] → D2 settles whether OpenSpec counts them; the function follows OpenSpec, and the changelog says it if something stops being counted.
- [A fixture set cannot cover every form OpenSpec accepts] → the test fails when a fixture disagrees, and a new form found later is one more fixture.
- [The `schema` reason adds a recovery to the table of next steps] → it needs the message in both languages and an entry in the table, as any reason does; the tests of the messages catch a missing one.
- [OpenSpec may rename `schemaName` or `taskTrackingConfigured` in a later version] → the contract test and the checks of `go` run in CI against the installed OpenSpec, and an absent field is treated as an unsupported answer, not as a pass.

## Open Questions

- Which bullets (`-`, `*`, `+`) does OpenSpec count as tasks? The contract test answers it; it changes one line of the function and one fixture, not the specifications or the task list.

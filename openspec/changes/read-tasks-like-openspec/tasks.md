# Tasks

## 1. One reader of the boxes

- [ ] 1.1 Add to `scripts/lib/tasks-file.mjs` one reader that lists the tracked task lines with marker, id and done state as OpenSpec defines them, and rebuild `countTasks` and `uncheckedTasks` on it; verify with unit tests for `- [ x]`, upper-case `X`, `- [~]`, `- []`, plain bullets and nested lists
- [ ] 1.2 Add a contract test that creates a temporary change per fixture, runs `openspec instructions apply --json` and checks that `total` and `complete` equal the reader's, skipping with a message when `openspec` is not installed; verify it passes, and that it fails when the reader is changed to ignore `- [~]`
- [ ] 1.3 Use the reader in `task-groups.mjs`, `replica-plan.mjs`, `fix-guard.mjs`, `build-preflight.mjs` and the progress reader, keeping the bullets that 1.2 shows OpenSpec accepts; verify the existing tests of each script pass and that no script outside `tasks-file.mjs` keeps its own regular expression for a task box (`grep` for `\[ xX\]` and `- \[ \]` in `scripts/`)

## 2. The schema guard

- [ ] 2.1 In the step of `go` that reads the apply instructions before the first launch of the developer, read `schemaName` and `taskTrackingConfigured`, and end in `build-failed` with the new reason `schema` when the schema is not `spec-driven` or the tasks are not tracked, with its message in English and Spanish and its entry in the table of next steps; verify with tests that another schema and untracked tasks stop the build before any agent, and that `spec-driven` goes on
- [ ] 2.2 Add to `scripts/lib/doctor.mjs` the check of the default schema in `openspec/config.yaml` (failure with fix for another schema, judged by OpenSpec's default when there is no `schema` line, unreadable when it cannot be parsed); verify with tests for the three scenarios of the specification

## 3. Documentation and checks

- [ ] 3.1 Document in `docs/execution.md` and `docs/guide.md` and their Spanish pages that Relevo supports the `spec-driven` schema, what the `schema` reason and the doctor failure say, and how tasks are counted; verify that the pages in both languages carry it and that the documented command runs as written
- [ ] 3.2 Add an entry to the Unreleased section of `CHANGELOG.md` (Added: the schema check; Fixed: the counting, naming any form that stopped or started being counted); verify the entry under Unreleased
- [ ] 3.3 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the review requirements of the repository are satisfied.

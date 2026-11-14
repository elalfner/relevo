## 1. Developer agent

- [x] 1.1 Add a "Cost guide" section to `agents/dev.md` of at most six lines (bounded reads, script for repetitive files, only the tests of what changed, never rerun what the gate ran), stating that project rules win over it
- [x] 1.2 Add the project guidance (`context`, `rules`, `operationGuidance`) to the Inputs of `agents/dev.md`, ranked as project rules and never over the `You must never` list

## 2. go

- [x] 2.1 In `skills/go/SKILL.md`, run `openspec instructions tasks --change "<change_id>" --json` with the other instructions (already allowed as `instructions <artifact>`), and pass the non-empty `context`, `rules` and `operationGuidance` to every developer launch (build, fix, integrate); with none, say only the default guide applies in the report

## 3. Tests and docs

- [x] 3.1 Tests: dev.md has the guide and it is at most six lines; dev.md says project guidance outranks the guide; go passes the guidance in each mode and reads the tasks instructions
- [x] 3.2 Add a minimal entry to the Unreleased section of `CHANGELOG.md`; update documentation that lists what the developer receives, if any
- [x] 3.3 Run `npm test` and report any failure

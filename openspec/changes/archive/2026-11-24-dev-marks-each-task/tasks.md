# Tasks

## 1. The rule and its test

- [x] 1.1 Change the "Tasks" section of `agents/dev.md` so the developer marks a task `[x]` as soon as its code exists and its own checks pass, one edit per task and before the next one (the full test run is marked when it passes), keeps the checkbox as its only edit, never removes a mark, and applies the same rule in build, fix and replica modes; verify by reading the section and by the test of 1.2
- [x] 1.2 Add to `tests/agents.test.mjs` an assertion that `agents/dev.md` asks for the mark when the task finishes and not at the end of the launch, and one that it forbids taking a mark back; verify that `node --test tests/agents.test.mjs` passes and fails when the sentence is removed

## 2. Documentation

- [x] 2.1 Correct the sentence of `docs/execution.md` that says the developer marks its tasks when its launch of a group ends (and that a one-group build keeps its tasks at 0), and make the same change in `docs/execution.es.md`; verify that neither page still says it and that both say the tasks rise as each one is finished
- [x] 2.2 Add an entry under "Changed" in the Unreleased section of `CHANGELOG.md`: the count of the progress comment advances task by task, the cost is one edit per task, and no script changed; verify that the entry is under Unreleased and names the cost

## 3. Checks

- [x] 3.1 Run `npm test` and `openspec validate --all` and verify both pass
- [x] 3.2 In the sandbox, from this branch as the memory describes (a pinned sha, `npm pack` of the folder), build an issue of three tasks or fewer and verify that the progress comment shows the tasks rising before QA; write what was seen in `docs/pilot-findings.md`

## Workflow follow-up

- Archive the change after the review requirements of the repository are satisfied.

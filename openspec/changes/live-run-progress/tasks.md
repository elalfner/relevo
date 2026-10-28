# Tasks

## 1. Progress library

- [ ] 1.1 Add `countTasks(text)` to `scripts/lib/tasks-file.mjs` (checked and unchecked items, the sections added by corrections included) and verify `tests/fix-tasks.test.mjs` or a new test covers a file with none, some and all checked
- [ ] 1.2 Add `scripts/lib/progress.mjs` with `deducePhase`, `renderProgress`, `shouldWrite` and the marker constants, and verify `tests/progress.test.mjs` covers Scenarios "No announcement", "Nothing changed" and "A check runs after the closing" (a closed comment is never written)
- [ ] 1.3 Add the kinds `run_progress` and `run_progress_closed` in English and Spanish to `scripts/lib/messages.mjs` and verify `tests/messages.test.mjs` renders both in each language, with the time in whole minutes
- [ ] 1.4 Add to `scripts/lib/progress.mjs` the comment client (create, find by marker among the comments of the Actions bot, edit) with `gh` injected, and verify tests with a fake client cover "First report", "Marker already present" and "GitHub refuses the edit" (the run continues)

## 2. Commands and the watcher

- [ ] 2.1 Add `scripts/progress.mjs` with `phase <name> [--attempt n]`, which writes `phase.json` under `$RELEVO_PROGRESS_DIR` and does nothing, exit 0, when the variable is unset; verify a test covers both cases and that nothing is written in the working tree
- [ ] 2.2 Add `watch` to `scripts/progress.mjs`: a round every 30 seconds, a write only when `shouldWrite` says so, the label read every fifth round, and exit on the stop file, on the issue leaving `relevo:building` or on the hard limit of minutes; verify with a fake clock and fake client that it ends on each of the three, and that a run with no task or phase change still advances its minutes ("The agent is silent")
- [ ] 2.3 Add `close` to `scripts/progress.mjs`: writes the closing line with the closed marker, and a second `close` or a late round does nothing; verify "Run ends with a result", "Run ends without an outcome" and "Closing while a check is running"
- [ ] 2.4 Make every command catch its own errors and exit 0, and verify a test where the client and the file system throw ends with exit code 0 and a line in the log ("Reporting progress never fails the run")

## 3. The go skill

- [ ] 3.1 Add to `skills/go/SKILL.md` a call to `node ${CLAUDE_PLUGIN_ROOT}/scripts/progress.mjs phase <name>` at the start of steps 2 to 7, with the attempt number on each retry of development and of QA, and a sentence saying it is best-effort and never a reason to stop; verify `tests/plugin-structure.test.mjs` still passes and a test checks that each phase of the spec is announced
- [ ] 3.2 Check the closed list of commands the skill may run (`openspec-commands` table and the allowed tools of the workflow) and verify `tests/openspec-commands-table.test.mjs` and `tests/agent-workflow.test.mjs` pass with the new calls
- [ ] 3.3 Check that the rendering of the skill for Antigravity (`scripts/lib/adapters`) keeps the new calls and their path, and verify `tests/adapter-antigravity.test.mjs` passes

## 4. The workflow

- [ ] 4.1 Add to `templates/workflows/relevo-go.yml`, after "Check the toolchain" and before the agent block, a step that starts the watcher detached, saves its PID, sets `RELEVO_PROGRESS_DIR` through `$GITHUB_ENV`, is `continue-on-error` and skips silently when the unpacked package lacks `scripts/progress.mjs`; verify a test in `tests/workflow-go.test.mjs` finds it outside the agent block and that `tests/agent-workflow.test.mjs` still shows the Antigravity workflow differing only inside the marked blocks
- [ ] 4.2 Add after the report of a run without an outcome the two `if: always()` steps that stop the watcher (stop file, wait for the PID) and close the comment, in that order, both `continue-on-error`; verify a test checks the order against the existing steps and the `if: always()` of both
- [ ] 4.3 Update the tests that read the region before the agent block (`tests/toolchain-check.test.mjs`, `tests/workflow-go.test.mjs`) so they still assert what they asserted: the toolchain check is first, it writes nothing in the workspace, and it stops the job when a tool is missing; verify `node --test` passes
- [ ] 4.4 Verify the new steps leave the working tree clean, as the preflight of the agent requires, with a test that nothing they write is under the workspace

## 5. Documentation and release notes

- [ ] 5.1 Document the progress comment in `docs/execution.md` and `docs/execution.es.md` (what each line means, the 30 seconds, that a growing time with the same tasks is the sign of a stuck run, that it is closed at the end) and verify `tests/docs-claims.test.mjs` passes
- [ ] 5.2 Add the entry under `[Unreleased]` in `CHANGELOG.md` (Added: the progress comment and the phase; Upgrading: take the new `relevo-go.yml` through `/relevo:init`) and verify `tests/changelog.test.mjs` passes
- [ ] 5.3 Run `npm test` and `openspec validate --all` and verify both pass

## 6. Real run

- [ ] 6.1 Run one cloud build on the sandbox repository with the new workflow and verify that the comment shows the phase with the attempt, the tasks and the minutes, that it is closed at the end with one line, and that the issue has no extra comment; record in `docs/pilot-findings.md` whether `RELEVO_PROGRESS_DIR` reached the tools of the agent

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged and the CI passes.
- Run `npm test` and `openspec validate --all` after archiving, because open changes can go stale.

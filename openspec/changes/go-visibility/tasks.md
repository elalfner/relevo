# Tasks

## 1. The progress folder of a machine

- [x] 1.1 Test a resolver of the progress folder: the variable wins; inside a worktree of `.relevo-worktrees/<repository>-<issue>` with a state folder it returns that folder; inside one without it, or anywhere else, it returns none; it never throws; run and see it fail
- [x] 1.2 Write the resolver beside `scripts/lib/worktree-path.mjs` with the path of the state folder (`.relevo-worktrees/.state/<repository>-<issue>/`), and use it in `scripts/progress.mjs`, `scripts/run-budget.mjs`, `scripts/tree-baseline.mjs` and every other script that reads `RELEVO_PROGRESS_DIR`; verify the new tests and the existing tests of those scripts pass, and that with the variable set nothing changed
- [x] 1.3 `scripts/lib/go-local.mjs` and `scripts/lib/go-worktree.mjs`: empty and create the state folder before the build and keep it when the worktree is removed; `go-local.mjs` gives it to its child as the variable; update `tests/go-local.test.mjs` and `tests/go-worktree.test.mjs`; verify they pass and that the working tree of the build stays clean

## 2. The group in progress

- [x] 2.1 In `tests/progress.test.mjs` and the tests of the two scripts, test that `task-groups.mjs` records the number of groups and `checkpoint.mjs` the group it committed when there is a progress folder, that neither fails or changes its output without one or when it cannot write, and that the progress text shows "group 2 of 3" after the first checkpoint of three, "group 1 of 1" for one group and no group when nothing was recorded; run them and see them fail
- [x] 2.2 `scripts/task-groups.mjs`, `scripts/checkpoint.mjs`, `scripts/lib/progress.mjs` and the `run_progress` text of `scripts/lib/messages.mjs`, in English and Spanish; verify the tests pass and `tests/workflow-progress.test.mjs` still passes

## 3. The state and the lines of a local build

- [x] 3.1 Test a function that builds the snapshot of a build from its state folder and its worktree: phase, group, tasks, start, last change, the lens and agent records, the outcome and the totals when present, tasks from the last written snapshot when the worktree is gone, and nothing for an issue with no folder; run and see it fail
- [x] 3.2 Write it in `scripts/lib/progress.mjs` or beside it, reusing `readTreeFacts` and `readAnnouncement`; verify the tests pass
- [x] 3.3 In `tests/go-local.test.mjs`, test with an injected runner and clock that `runLocal` prints a line when the phase, the group, the tasks or the newest lens or agent record changes, prints none when nothing changed, puts the minutes in each line, uses the language of `relevo.yml`, works for the Antigravity path, and builds as today when the folder cannot be created; run them and see them fail
- [x] 3.4 `scripts/lib/go-local.mjs` and `scripts/go-local.mjs`: run the agent without blocking, derive the change id from the title of the issue, print from the snapshot on an interval, and write the last snapshot at the end; the texts in `scripts/lib/messages.mjs`; verify the tests pass
- [x] 3.5 Test and write `go-local.mjs status <issue>`: a build in progress, a build that ended, and no build on this machine; it reads only; verify the tests pass

## 4. What a local build used

- [x] 4.1 Test that `runLocal` prints the answer of the agent and one sentence with the turns, the estimated cost and the tokens when the final answer of `claude -p --output-format json` has them, prints the raw output and nothing about usage when it is not that object, reads the summary of the guard on the Antigravity path, keeps the totals in the state folder, and posts nothing; run them and see them fail
- [x] 4.2 `scripts/lib/go-local.mjs`, `scripts/lib/run-flags.mjs` (the output format of a local run only; the test that compares the flags with the workflow still passes) and `scripts/lib/run-usage.mjs` (the sentence without the breakdown); verify the tests pass

## 5. The developer launches and the unmarked tasks

- [x] 5.1 In the tests of `checkpoint.mjs`, test that its output lists as `unmarked` the tasks of `--tasks` still unchecked in the `tasks.md` of the change, an empty list when all are marked, and no list when the tasks given are not task numbers; make it pass in `scripts/checkpoint.mjs` with `uncheckedTasks`
- [x] 5.2 In `tests/skill-go.test.mjs` and `tests/skill-fix.test.mjs`, test that every launch of the developer is described as one Agent call in the foreground, never in the background, with the turn held; that a group launch has the description `build <k>/<n>: <tasks>` and a correction one that names its attempt or iteration; and that step 4 handles `unmarked` (one relaunch when the report has no open question, the open-question path otherwise, `tasks left unfinished` at that group when it stays unmarked); run them and see them fail
- [x] 5.3 `skills/go/SKILL.md`, `skills/go/references/qa-run.md` and `skills/fix/SKILL.md`: the wording of the launches, the descriptions and the handling of `unmarked`; verify the skill tests pass
- [x] 5.4 In `tests/usage.test.mjs`, test that the usage comment shows the description of a launch beside its entry, tells three group launches apart, and keeps replicas in their own list; make it pass in `scripts/lib/run-usage.mjs`

## 6. The session

- [x] 6.1 In `tests/skill-go.test.mjs`, test that `/relevo:go <n> --local` starts `go-local.mjs` in the background, prints the status command, ends its turn without asking again, and reports the result when the command ends; make it pass in `skills/go/SKILL.md`
- [x] 6.2 In `tests/status.test.mjs`, test the section of the builds running on this machine (issue, phase, group, tasks, minutes, last change), its absence when there is none, and an issue `building` elsewhere listed without progress; make it pass in `scripts/lib/status.mjs`, its data reader and `skills/status/SKILL.md`
- [ ] 6.3 In an interactive build of a sandbox issue, verify that the resolver finds the state folder from the worktree: `go-local.mjs status <n>` from another terminal prints the phase and the tasks, and `run-budget.mjs check` reports numbers instead of "does not know"; record it in `docs/pilot-findings.md`

## 7. The tool list of an interactive build

- [ ] 7.1 Spike: in the desktop app and in an editor extension, run a skill whose frontmatter declares the allowed tools of the workflow; record in `docs/pilot-findings.md` whether the session stops asking for those tools and whether a tool outside the list is still asked for
- [x] 7.2 If 7.1 shows that the list is honoured: add it to the frontmatter of `skills/go/SKILL.md` and a test that compares it with `ALLOWED_TOOLS` of `scripts/lib/run-flags.mjs` and fails on a tool the workflow refuses. If it does not: change nothing in the frontmatter and add a test that the skill declares no tool list; verify the test of the case that applies passes

## 8. The documentation

- [x] 8.1 `docs/execution.md` and `docs/execution.es.md`: the comparison of the cloud build, the local build and the interactive build (what each shows, its limits, what it spends), the status command, the group in the progress comment, and the result of 7.1 with the way to allow the tools by hand if needed; verify `tests/docs-claims.test.mjs` passes
- [x] 8.2 `CHANGELOG.md`: an entry under Unreleased, Added; verify it names the status command

## 9. Integration

- [x] 9.1 Run the whole suite (`node --test`) and `openspec validate --all`; verify both pass
- [ ] 9.2 Run `go-local.mjs` for a sandbox issue with at least two groups in a terminal: verify the lines for each phase and group, the totals at the end, `go-local.mjs status` during and after the build, and that nothing about progress or usage was posted on the issue; record it in `docs/pilot-findings.md`
- [ ] 9.3 Build a sandbox issue in the cloud and verify that the progress comment shows the group, and that the usage comment tells the launches of the developer apart

# Tasks

## 1. Tests that fail first

- [x] 1.1 In `tests/task-groups.test.mjs` (or the test file of that module), test `doneTaskIds`: the ids of the `- [x]` lines, in order, with `[X]`, replicas, nested notes and unchecked tasks
- [x] 1.2 In `tests/rescue-work.test.mjs`, test the scenarios of the delta: a checked task not named by a checkpoint gets the trailer; one that a commit names is left out; none checked gives no trailer; a missing or unreadable `tasks.md` gives no trailer and does not fail; an explicit `tasks` (a checkpoint) is not derived
- [x] 1.3 In `tests/replica-resume.test.mjs`, test that `template --section K` finds a `wip: stopped by limit` commit that names a task of section K, still finds the checkpoints, and that `--k --of` and the resume check do not count the limit commit
- [x] 1.4 Run them and see them fail before the code exists

## 2. The change

- [x] 2.1 `scripts/lib/task-groups.mjs`: `doneTaskIds(text)`
- [x] 2.2 `scripts/lib/rescue-work.mjs` and `scripts/lib/rescue-run.mjs`: derive the tasks of a limit commit from the `tasks.md` of the change and the trailers over the base, when none were given; never fail the rescue
- [x] 2.3 `scripts/replica-plan.mjs`: `template --section K` also takes `wip: stopped by limit (#N)` commits that name a task of section K (update its usage comment)
- [x] 2.4 Run the new tests and the whole suite (`node --test`), and `openspec validate --all`

## 3. Documentation

- [x] 3.1 `docs/execution.md` and `docs/execution.es.md`: the limit commit names the tasks it holds, and the template is found in it
- [x] 3.2 `CHANGELOG.md`: entry under Unreleased, Added

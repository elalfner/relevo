# Tasks

## 1. Configuration

- [ ] 1.1 Add `limits.run_max_minutes` (whole number, minimum 5, default 50) to `scripts/lib/config.mjs`, to the `start` decision in `scripts/lib/plan.mjs` and to `templates/relevo.yml`; extend `tests/config.test.mjs` and `tests/plan.test.mjs` with the default, a valid value, and an invalid one; verify `node --test tests/config.test.mjs tests/plan.test.mjs` passes
- [ ] 1.2 Make `doctor` warn when the `timeout-minutes` of the build job of the installed go workflow is not at least five minutes above `limits.run_max_minutes`, and say nothing when it is or when no workflow is installed; extend `tests/doctor.test.mjs`; verify it passes

## 2. Budget guard

- [ ] 2.1 Add `scripts/lib/run-budget.mjs` and `scripts/run-budget.mjs` with `record` (integers only, into `$RELEVO_PROGRESS_DIR/budget.jsonl`) and `check` (JSON on one line, exit 1 only when a limit it can read was reached, otherwise exit 0 with `unknown` when it cannot read); test with temporary directories: within limits, turns reached, minutes reached, no directory, unreadable ledger, non-numeric arguments; verify `node --test tests/run-budget.test.mjs` passes
- [ ] 2.2 Wire the guard into `skills/go/SKILL.md` and `skills/go/references/qa-run.md`: record after every agent, check before the next launch (developer retry, each lens), and take the failure path with `run limit reached` naming the agents that did not run; add the reason to the list of reasons; verify with `tests/skill-go.test.mjs` (or the test that reads the skill) that the commands appear in the right steps

## 3. Rescue

- [ ] 3.1 In `scripts/lib/wip-commit.mjs` add the subject `wip: stopped by limit (#N)`, make `isWipCommit` recognise both subjects, add `run limit reached` to the reasons that keep the work, and add the class `limit` to `OUTCOME_CLASSES` in `scripts/lib/phase-log.mjs`; update `tests/wip-commit.test.mjs` and `tests/phase-log.test.mjs`; verify they pass
- [ ] 3.2 Add `scripts/lib/rescue-work.mjs` and `scripts/rescue-work.mjs`: from the decision, list the changed files of the working tree, commit them through `commit-change`, push without force only after a commit and only if the branch is not on the remote, and print the `branch_state`; test it in temporary git repositories for kept, nothing to keep, scan refusal, branch already on the remote, on the base branch, and a push that fails; verify `node --test tests/rescue-work.test.mjs` passes
- [ ] 3.3 Add the always-running rescue step to `templates/workflows/relevo-go.yml` (before the report and the cleanup, only when the issue is still `building` or `ready`), make the report comment say whether the work was kept, and make the plugin install step check for the new scripts; extend `tests/workflow-go.test.mjs`; verify it passes
- [ ] 3.4 Make `skills/fix/SKILL.md` and `scripts/lib/failure-comment.mjs` treat the new subject as work in progress; extend `tests/fix.test.mjs` or the test that covers it; verify it passes

## 4. Consumption by agent

- [ ] 4.1 Extend `readUsage` in `scripts/lib/run-usage.mjs` with `models` (from `modelUsage`) and `agents` (main agent and subagents, from `task_started`, `task_notification`, the `Agent` calls and the `parent_tool_use_id` of each message), with the estimated cost shared per model by weighted tokens so that it adds up to the real cost of the model; leave out what the log lacks; test with a synthetic log shaped like a real run (no data of the pilot project); verify `node --test tests/run-usage.test.mjs` passes
- [ ] 4.2 Make `usageLine` add the by-agent sentence and `usageMarker` the `agents` and `models` keys, read them back in `parseUsageMarker` when well formed, and keep the totals and the digest unchanged; add the limit named in the comment when a run stopped at one; verify the digest tests still pass

## 5. Docs and release

- [ ] 5.1 Update `docs/configuration.md`, `docs/execution.md`, `docs/commands.md` and their `.es.md` versions (the two caps for turns, `run_max_minutes`, what is kept at a limit or a cut, the usage by agent); verify the docs tests (`tests/docs-claims.test.mjs`) pass
- [ ] 5.2 Bump the version to 0.14.5 in `plugin.json`, `package.json`, the `relevo-template` headers and `RELEVO_VERSION` of the workflow templates, and add the CHANGELOG entry with its known limits; verify the version consistency tests pass
- [ ] 5.3 Run the full suite (`node --test tests/`) and `openspec validate run-budget-and-rescue --strict`; verify both are clean

## Workflow follow-up

- Commit on the working branch (check `git branch --show-current` first), open a draft pull request to `dev`, and archive the change after the review.

# Tasks

## 1. Shared pieces

- [x] 1.1 Add `scripts/lib/run-flags.mjs` (`ALLOWED_TOOLS`, `DISALLOWED_TOOLS`, `runFlags(config)` returning the argument list for `--max-turns`, `--max-budget-usd`, `--allowedTools`, `--disallowedTools`) and `scripts/lib/execution-mode.mjs` (`cloudBuilds`, `credentialMode(secretNames)`). Verify with `tests/run-flags.test.mjs` and `tests/execution-mode.test.mjs`: the flags for the limits of the template config; the claude_args of `templates/workflows/relevo-go.yml` carry the same tool strings and limits; `credentialMode` for key, token, both, none; `cloudBuilds` for the four combinations of workflow and variable.
- [ ] 1.2 Add `limits.building_alert_hours` (positive integer, default 3) to `scripts/lib/config.mjs` and `templates/relevo.yml`. Verify with additions to `tests/config.test.mjs` and `tests/template.test.mjs`: the default, 0 and 2.5 rejected naming the setting.

## 2. The cloud: switch, reserve, limit and consumption

- [x] 2.1 Add `--credential <true|false>` to `scripts/go-plan.mjs`: with `false`, a `start` decision becomes `{ action: 'local' }` with no label change and no claim, with the new message `cloud_not_configured` (English and Spanish, naming `/relevo:go <n>` and the two secrets; it is not a lifecycle state, so it has no entry in the next-step table); other decisions unchanged, and `requeue.mjs` takes the same flag and dispatches nothing without a credential. Verify with additions to `tests/go-plan-output.test.mjs`, `tests/messages.test.mjs` and `tests/requeue.test.mjs`: start with and without the flag, a blocked issue with the flag applied as usual, the output `action=local`, no `decision_b64` that starts a build, both languages, and the queue dispatching nothing without a credential.
- [x] 2.2 Update `templates/workflows/relevo-go.yml` and `relevo-queue.yml`: `vars.RELEVO_CLOUD_GO != 'off'` in the `if` of `decide` and of the queue job, `HAS_CREDENTIAL` mapped in the gate step and passed with `--credential`, comments explaining the variable. Verify with additions to `tests/workflow-go.test.mjs`: the guard in both files, the flag passed, the build job still runs only on `start`, and no secret value is printed or mapped anywhere new.
- [x] 2.3 Add `scripts/usage-limit.mjs --file <path>` (exit 0 when the log shows a usage limit, quota or credit failure, 1 otherwise or when the file is missing) and give the build job's final step the wording for it. Verify with `tests/usage-limit.test.mjs` on fixture logs (limit text in a JSON array, in JSON lines, plain text, none, missing file) and `tests/workflow-go.test.mjs`: the step passes the execution file and keeps `if: always()`.
- [x] 2.4 Add `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs --file <path> [--subscription]` (prints one line with turns, cost and tokens, or nothing; always exit 0) and a build-job step that posts it as a comment. Verify with `tests/run-usage.test.mjs`: a JSON array with a result, JSON lines, a result without tokens, a log without a result, an unreadable file, the notional wording with `--subscription`; and `tests/workflow-go.test.mjs`: the step runs after the agent with `if: always()` and cannot fail the job.

## 3. The local run

- [x] 3.1 Add `scripts/lib/go-local.mjs` and `scripts/go-local.mjs <issue> [--config relevo.yml] [--dry-run]` (worktree outside the repository, `claude -p "/relevo:go <issue>"` with `runFlags`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, removal on a clean end, kept and printed on failure, a warning when the cloud also builds, exit code of the run). Verify with `tests/go-local.test.mjs` in a throwaway repository with an injected runner: the worktree path and base, the exact `claude` arguments, removal on 0, kept on 1, the warning, an uncommitted change in the main tree not blocking, `--dry-run` printing the plan without running, a missing `claude` or `gh` explained.
- [x] 3.2 Update `skills/go/SKILL.md` to say it can be started by hand or with `go-local.mjs`, and that a hand-run needs a clean tree. Verify with `tests/skill-go.test.mjs`: the sentence is present, the script it names exists and its flags are implemented.

## 4. Doctor and init

- [x] 4.1 Add the execution-mode checks to `scripts/lib/doctor.mjs`: credential mode from the secret names, both as a warning, none as a warning when the go workflow is installed, the state of `RELEVO_CLOUD_GO` (read through the variables API), the policy reminder for `subscription`, and the warning for `subscription` with `concurrent_agents` above 1. Verify with additions to `tests/doctor.test.mjs`: every scenario of the `init-doctor` delta, and a healthy repository with an API key and no variable staying free of new warnings.
- [x] 4.2 Make `init` ask where `go` runs and with which credential (`answers.runs`, `answers.credential`), flip the credential line of the workflow template, skip the `go` and queue workflows for local only, write `limits.concurrent_agents: 1` for a subscription and add the reminder item about the secret; update `skills/init/SKILL.md`. Verify with additions to `tests/init.test.mjs` and `tests/skill-init-doctor.test.mjs`: the three choices, the credential line for each mode on the real template, the default (both, API key), no secret value read or written.

## 5. Status

- [ ] 5.1 Show the `ready` issues of the person with `/relevo:go <n>` when the cloud is not building, and the alert for an issue on `building` with no activity for `limits.building_alert_hours`, in `scripts/lib/status.mjs`, `scripts/lib/status-data.mjs` and the digest; update `skills/status/SKILL.md`. Verify with additions to `tests/status.test.mjs`: the four scenarios of the `status` delta, Spanish, and the digest listing the alert.

## 6. Documentation and integration

- [ ] 6.1 Add `docs/execution.md` and `docs/execution.es.md` (where `go` runs, the variable, the two credentials and what each means for the limits, the local run, the policy reminder), link them from the READMEs and `docs/configuration*.md`, and record the new output used in `docs/action-parameters.md`. Verify with `tests/readme-sync.test.mjs`.
- [ ] 6.2 Add the entry to `CHANGELOG.md` under Unreleased. Verify with `tests/changelog.test.mjs`.
- [ ] 6.3 Run `npm test`, `openspec validate --all`, `openspec validate execution-modes --strict` and `claude plugin validate .`. Verify that every test passes and that validation reports no new error.
- [ ] 6.4 In the sandbox repository, copy the new workflows, label an issue `ready` and check that the consumption comment appears, then set `RELEVO_CLOUD_GO` to `off`, label another issue `ready` and check that no run builds it. Verify by the runs; record in `docs/pilot-findings.md` the real shape of the execution log and whether the usage figures were found.

## Workflow follow-up

- A real local run with `go-local.mjs` and a real usage-limit failure need a person's machine and account; record their results when someone has them.
- Archive the change after the project's review requirements are satisfied, then verify the archived result.

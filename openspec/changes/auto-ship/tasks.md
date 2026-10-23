# Tasks

## 1. Label and configuration

- [x] 1.1 `scripts/lib/labels.mjs`: add the overlay label `ship` (`relevo:ship`), renamable in `labels`; check that transitions never treat it as a state and that `--clear` removes it; tests in `tests/labels.test.mjs`
- [x] 1.2 Check the next-step table and its "every state has an entry" test with the new label, and add an entry if the table covers overlays
- [x] 1.3 `scripts/lib/config.mjs` and `templates/relevo.yml`: `review.ship_without_ci` (boolean, default `false`) with validation and a commented line; tests in `tests/config.test.mjs`

## 2. The decision

- [x] 2.1 `scripts/lib/ship.mjs`: accept the baseline commit's rollup and an "archive only" flag; when the flag is set and the head has no checks, judge the baseline's checks; a head with checks is judged as is; tests in `tests/ship.test.mjs` for the three scenarios of the spec
- [x] 2.2 `scripts/ship-check.mjs`: with `--baseline` and a different head, compare the two commits through the API, set the flag when every changed file is under `openspec/`, and read the baseline's rollup with GraphQL; tests with a fake `gh`
- [x] 2.3 The label rules on top of the decision: `not-approver` stops with the `/relevo:ship <n>` message, `no-ci` stops unless `review.ship_without_ci`, a sender that is a bot stops; pure function with tests

## 3. The unattended run

- [x] 3.1 Messages in `scripts/lib/messages.mjs`, English and Spanish: `ship_stopped`, `ship_done`, `ship_needs_app`, `ship_no_ci`, `ship_not_approver`, `ship_failed`; tests in `tests/messages.test.mjs`
- [x] 3.2 Detection of required checks on the base branch (rules API and classic protection, 404 as none) in a library function shared with doctor; tests
- [x] 3.3 `scripts/ship-unattended.mjs` and its library: preflight, decision with the label rules, required checks versus push token, scan, archive state, validate and open tasks, archive, `check-archive`, stage, commit, push with the push token, wait for checks when the App was used (30-minute limit), second check with `--baseline`, conflict recovery inside `openspec/` only, merge with `--match-head-commit`, close, clear labels, queue dispatch when the workflow token closed it; every stop comments and removes the label; git runs without hooks
- [x] 3.4 Tests for 3.3 with a fake `gh` and `git`: merged path, each stop reason, App path with checks passing and timing out, rerun after a timeout resumes from the merge, conflict in `openspec/` recovered, conflict in code stopped, head moved before the merge, configuration read from the base branch
- [x] 3.5 `templates/workflows/relevo-ship.yml`: trigger `issues: labeled` for the `ship` label from a `User`, guarded by `RELEVO_CLOUD_SHIP != 'off'`; one run per issue; pinned `RELEVO_VERSION`; package install with the existence check; OpenSpec install; checkout of the default branch and `relevo.yml` from the base branch; feature branch in its own folder; optional App token step; the orchestrator; the final `if: always()` report; no model step
- [x] 3.6 Template test in `tests/template.test.mjs`: the trigger, the guard, no `claude-code-action`, no install or script from the feature branch, the App token used only for push, merge and close, the final report

## 4. The approval message

- [x] 4.1 `scripts/lib/review-events.mjs` and `scripts/review-event.mjs`: look up the ship workflow on the default branch and name the label next to the command in the approval comment, falling back to the command alone; tests in `tests/review-events.test.mjs`

## 5. Init and doctor

- [x] 5.1 `scripts/lib/init.mjs` and `skills/init/SKILL.md`: create the `ship` label and install `relevo-ship.yml` in every setup, including local-only; tests in `tests/init.test.mjs`
- [x] 5.2 `scripts/lib/doctor.mjs`: fail when last-push approval is required; when the ship workflow is on the default branch, check the label, the App secrets when checks are required (pass with a note otherwise) and warn when `RELEVO_CLOUD_SHIP` is `off`; tests in `tests/doctor.test.mjs`
- [x] 5.3 `skills/doctor/SKILL.md`: list the new checks

## 6. The interactive skill

- [x] 6.1 `skills/ship/SKILL.md`: step 4 says that the checks of the recorded head count when only the archive changed; the report mentions the label as the unattended alternative; `tests/skill-ship.test.mjs` follows

## 7. Documentation

- [x] 7.1 `docs/commands.md` and `docs/commands.es.md`: shipping with the label, who may use it, what stops it
- [x] 7.2 `docs/execution.md` and `docs/execution.es.md`: the ship workflow, `RELEVO_CLOUD_SHIP`, the checks carried over, creating the GitHub App (permissions, installation on one repository, the two secrets, not in any bypass list) and when it is needed
- [x] 7.3 `docs/configuration.md`, `docs/configuration.es.md`, `docs/security.md` and `docs/security.es.md`: `review.ship_without_ci`, and that the automation merges only on a person's label with configuration from the base branch
- [x] 7.4 Changelog under Unreleased

## 8. Check

- [x] 8.1 Run the full test suite and `openspec validate auto-ship`
- [ ] 8.2 In the sandbox repository, ship one issue by label without required checks and one with required checks and the App, and confirm the merge, the close, the labels and the queue dispatch

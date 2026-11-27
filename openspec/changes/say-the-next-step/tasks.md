# Tasks

## 1. The table

- [x] 1.1 Add `draft`, `closed`, the `local` variant of `in-review`, the `lost-runner` variant of `building` and the role `person` to `scripts/lib/next-step.mjs`; verify in `tests/next-step.test.mjs` that the entries are the label keys plus `draft` and `closed`, that every entry and variant renders in both languages, and that each is `nobody` or a role, with a hint
- [x] 1.2 Add `--labels` and `--after init` to `scripts/next-step.mjs`; verify with tests of default and renamed labels, no label, `needs-reviewer` next to `pr-open`, and `needs-spec` and `build-failed` with and without `--reason`
- [x] 1.3 Add the `draft` and `closed` rows and the files-project command of `in-review` to `docs/guide.md` and `docs/guide.es.md`, and adjust the sentence under the table; verify that `tests/docs-claims.test.mjs` passes

## 2. Messages

- [x] 2.1 Re-read every kind of `scripts/lib/messages.mjs` against the tables of the design, then add the test that classifies each kind and renders its variants in both languages; verify that it fails naming the kinds still to fix and that a kind with no class fails by name
- [x] 2.2 Reword `review_reminder`, `ready_denied`, `go_denied`, `urgent_denied` (and their `_maintainer` forms), `go_building`, `run_progress` and `ship_done` in English and Spanish; verify with message tests and `tests/messages-language.test.mjs`
- [x] 2.3 Give `go_already_built` its `state` from `scripts/lib/plan.mjs` and the line of the table; verify with planner and message tests for `built`, `in-review`, `pr-open` and `changes-requested`
- [x] 2.4 Give `fix_done` its `state` and line, mention the assignee without `ask`, and update step 7 of `skills/fix/SKILL.md`; verify with message tests for no recipient, assignee, reviewer and a local project, and `tests/skill-fix.test.mjs`
- [x] 2.5 Verify that the classification test of 2.1 now passes for every kind

## 3. Workflow lines

- [x] 3.1 Add the restart to the lost-runner comment in `templates/workflows/relevo-go.yml`; verify in `tests/workflow-go.test.mjs` that, in both languages, the posted line equals the one of `nextStep()` and no label changes
- [x] 3.2 Add the next step and the Spanish text to the fallback of `templates/workflows/relevo-ship.yml`; verify with a test that runs the step without the render script in both languages

## 4. Reports of the commands

- [x] 4.1 End the `Report` of `skills/review`, including its files-project bullet and the `needs-reviewer` case, as the design says; verify with a skill test
- [x] 4.2 End the `Report` of `skills/fix` with the step from the new labels, keeping the instructions of a fix that stops; verify with `tests/skill-fix.test.mjs`
- [x] 4.3 Make `skills/ship` end every stop and the merge with the step, including the files-project rules; verify with a skill test that no text of the report names `pr-open` as the state of any stop
- [x] 4.4 End the `Report` of `skills/init` with `--after init`; verify with a skill test

## 5. Records and integration

- [x] 5.1 Add the four entries of the issue to `GLOSSARY.md`, exactly as written and after the existing ones, and the `[Unreleased]` entry to `CHANGELOG.md`, saying that `/relevo:init` brings the workflow lines; verify with the diff of both files
- [x] 5.2 Run `npm test`, `openspec validate --all` and `claude plugin validate .`; verify that all pass
- [ ] 5.3 In the sandbox, from a pinned commit of `dev`, a person runs `/relevo:review`, `/relevo:fix`, `/relevo:init` and `/relevo:ship` once and reads the last lines of each report; record the run in `docs/pilot-findings.md`

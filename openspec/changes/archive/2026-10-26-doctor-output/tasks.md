# Tasks

## 1. The `note` level

- [x] 1.1 Add `note(id, message)` to `scripts/lib/doctor.mjs` and move the four informational lines to it (`execution.policy`, the reserved-skill line of `skills.<name>`, the iOS-on-macOS target line and `execution.credential` for a subscription token); verify in `tests/doctor.test.mjs` that each is reported with status `note` and that none counts as a failure, a warning or a change of the exit status
- [x] 1.2 Make `scripts/doctor.mjs` exit 1 only on `fail` and list `note` in `--json`; verify with a test that runs the script on a fixture with only notes and checks exit 0 and the JSON status

## 2. One result per cause

- [x] 2.1 Make the runner check emit one failure that names every differing file with one fix, keeping the persistence warning and the pass as they are; verify `tests/doctor.test.mjs` has the scenarios "Several workflows differ", "A workflow edited by hand", "Workflows and setting agree" and "Hosted runner", and that five differing files give one result
- [x] 2.2 Group `automation.workflow.<file>` results that share a status and a fix (two files not installed, two disabled) into one result that names the files, and collapse "installed and enabled" into one pass; verify with a test of the scenario "Workflows that are not installed" and one that checks that a pass per file no longer appears
- [x] 2.3 Make the summary count results, not files; verify the scenario "Two causes" (five workflows on another runner and two missing labels read `2 checks failed`)

## 3. The text report

- [x] 3.1 Rewrite `renderReport` with the header, the sections `FAILURES`, `WARNINGS` and `NOTES` with counts, an omitted empty section and a closing line with the count of passes; verify tests for "A report with problems" and "All green" in `tests/doctor.test.mjs`
- [x] 3.2 Build the header from the repository and `workflowSource` (the default branch named, or the working copy, or only local checks when there is no repository); verify the scenarios "Workflows read from the default branch" and "The branch cannot be read"
- [x] 3.3 Add `--all` to `scripts/doctor.mjs` and `relevo doctor` so that the text report lists every check in the order evaluated; verify the scenarios "The full list" and "The machine-readable output" and that `relevo doctor --all` passes the flag through (`tests/cli.test.mjs`)
- [x] 3.4 Update `tests/docs-claims.test.mjs`, which imports `renderReport` and checks the tags `[pass]`, `[FAIL]` and `[warn]` quoted by the documentation; verify the test describes the new layout and passes

## 4. Skill, documentation and release notes

- [x] 4.1 Update `skills/doctor/SKILL.md` for the new levels and layout (the output is still shown as it is; say that notes need no action and that `--all` lists the passes); verify `tests/skill-init-doctor.test.mjs` has a case for it
- [x] 4.2 Update `docs/commands.md` and `docs/commands.es.md` for `/relevo:doctor`: the sections, `--all`, `--json` and the `note` level, with an example of a report; verify both pages show the same sections and the parity and links tests pass
- [x] 4.3 Update the line that tells a newcomer how to read the list in `docs/get-started.md` and `docs/get-started.es.md`, and look for any other page in either language that quotes a report; verify with a search for `[pass]` and `[FAIL]` that none is left describing the old layout
- [x] 4.4 Add an entry to `CHANGELOG.md` that says the text report changed layout, that `--all` and `--json` keep the full list, and that the exit status is the same; verify `tests/changelog.test.mjs` passes
- [x] 4.5 Run the whole test suite and `openspec validate doctor-output --strict`; verify both pass

## Workflow follow-up

- Run `/relevo:doctor` on a real repository with a self-hosted runner and compare its report with the sample in proposal.md.
- Archive the change after review and sync its specs into `openspec/specs/`.

# Proposal

## Why

`/relevo:doctor` prints one line for every check, so the lines that ask for action are buried. On a real repository (`viali_panel_vue`) the report had 54 lines and 42 checks: 32 passed, 3 warned and 7 failed, and five of those seven failures were one cause (the runner of five workflows) repeated with the same fix. Three lines that are notices ("reminder: read the Anthropic terms", a reserved skill, the subscription token) are shown as `pass`. Nothing says that the workflows are judged on the default branch of GitHub, so "no CI workflow" reads as a mistake when the file exists only in the working copy.

## What Changes

- The text report puts what needs action first: failures, then warnings, then notes, each with a count. The checks that passed are shown as a count, and `--all` lists every check as today.
- A new level, `note`, for information that asks for nothing (the three notices above). A note is neither a failure nor a warning and does not change the exit status.
- One result per cause: the per-file runner failure of 0.8.0 becomes one failure that names every file, and the summary counts results, not lines.
- The report starts with a line that says what it judged: the repository and the branch the workflows were read from, or that it read the working copy.
- `--json` keeps listing every check, now with the level `note` where it applies. The exit status is unchanged: 1 when a check failed.
- `skills/doctor/SKILL.md`, the commands page and any page that shows a report follow, in English and Spanish.
- Out of scope: removing or merging checks, colour, and any new check. This change moves nothing in what `doctor` verifies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: "Doctor reports every check" gains the `note` level and moves the layout to new requirements; "Doctor checks the runner of the workflows" reports one result for all the files that differ; new requirements for the order of the report, what it judged, and one result per cause.

## Impact

- Code: `scripts/lib/doctor.mjs` (`renderReport`, the result shape, the runner check and the three notices), `scripts/doctor.mjs` (`--all`).
- Skill and docs: `skills/doctor/SKILL.md`, `docs/commands.md` and `docs/commands.es.md`, and every page in either language that shows a report (`get-started`, `install`), plus `CHANGELOG.md`.
- Tests: `tests/doctor.test.mjs` and `tests/docs-claims.test.mjs`, which imports `renderReport`.
- Consumers of the report: only `scripts/doctor.mjs` and `relevo doctor`, which prints its output. The JSON gains one possible value of `status`.
- Nothing is breaking for the exit status. A person who parses the text report finds a different layout; `--all` and `--json` keep the full list.

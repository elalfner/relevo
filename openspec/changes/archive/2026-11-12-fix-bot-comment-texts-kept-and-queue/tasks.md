# Tasks

## 1. Queue comment

- [x] 1.1 Write first a test in `tests/messages.test.mjs` that renders `queued_agents` with `active: 1, active_issues: '#116'` and expects `Running or starting now: 1 (#116)` (en) and `En ejecución o por arrancar ahora: 1 (#116)` (es); show it failing on the current text. Then change the two catalog lines in `scripts/lib/messages.mjs` and show it passing. Update the existing `queued_agents` assertions that read the old line.

## 2. Kept comment

- [x] 2.1 Write first tests in `tests/messages.test.mjs` for `run_no_outcome` situation `kept` on the issue branch: with `checkpoints: 2`, with `checkpoints: 0`, and with no value, in English and Spanish, expecting the resume wording and no "from the start"/"desde el principio"; the `rescue/` branch still says it builds from the start. Show them failing. Then change `runNoOutcome` in `scripts/lib/messages.mjs` and show them passing.
- [x] 2.2 Add `checkpoints` (optional) to the `kept` case in `tests/messages-language.test.mjs`, so the language test covers the three wordings and the same placeholders.

## 3. Close

- [x] 3.1 Add one entry under Unreleased in `CHANGELOG.md` (Fixed). Run `npm test` and report any failure. Do not edit `templates/workflows/*.yml`, `qa-aggregate.mjs` or the version. Open a draft PR against `dev`; do not archive or merge.

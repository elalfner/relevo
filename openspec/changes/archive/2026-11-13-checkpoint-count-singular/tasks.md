# Tasks

## 1. The singular in Spanish

- [x] 1.1 Write first a test in `tests/messages.test.mjs` that renders `run_no_outcome` (situation `kept`, a branch of the issue) with `checkpoints: 1` in Spanish and expects "(1 guardado)" and not "1 guardados", with `checkpoints: 2` expecting "(2 guardados)", and in English "(1 saved)" and "(2 saved)"; show it failing on the current text. Then choose the form from the count in `runNoOutcome` in `scripts/lib/messages.mjs` and show it passing.
- [x] 1.2 In `tests/messages-language.test.mjs` add `checkpoints: 1` to the cases of the kept comment so both languages render it with no placeholder left. Check that the zero case ("todavía no hay ningún checkpoint") and the unknown case are unchanged.

## 2. Close

- [x] 2.1 One entry under Unreleased in `CHANGELOG.md` (Fixed). Run `npm test` and report any failure. No version bump, no template edited. Draft PR against `dev`; say what is not verified (the real Spanish comment with one checkpoint was seen only before the fix) and what to test by hand (cancel a Spanish run after exactly one checkpoint). Do not archive or merge until the maintainer says so.

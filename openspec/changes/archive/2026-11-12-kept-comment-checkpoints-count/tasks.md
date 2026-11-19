# Tasks

## 1. Count the checkpoints in the rescue

- [x] 1.1 Write first a test in `tests/rescue-work.test.mjs` that runs the rescue on a branch with two `wip: checkpoint k/n (#N)` commits over the base and expects `checkpoints: 2` in the result and `checkpoints=2` in the output file; show it failing. Then count them with `isCheckpoint` over `origin/<base>..<branch>` in `scripts/lib/rescue-work.mjs` (or `rescue-run.mjs`) and write the output line in `scripts/rescue-work.mjs`; show it passing.
- [x] 1.2 Tests for the cases that must stay unknown: no base in the decision, a git error, a `rescue/` branch, and a branch with no checkpoint (`0`, a number). The unknown cases write no `checkpoints=` line.

## 2. Send it to the comment

- [x] 2.1 Write first a test in `tests/workflow-comments.test.mjs` that the report step of `templates/workflows/relevo-go.yml` passes `RESCUE_CHECKPOINTS` and builds `checkpoints` only when it is not empty, and that a rendered comment with `checkpoints: 2` and with it absent reads as expected (English and Spanish); show it failing. Then edit the two lines of the template; show it passing.
- [x] 2.2 Check the template against the pins and package tests (`tests/workflow-package.test.mjs`, `workflow-pins.test.mjs`).

## 3. Close

- [x] 3.1 One entry under Unreleased in `CHANGELOG.md` (Fixed). Run `npm test` and report any failure. No version bump. Draft PR against `dev`; list what is not verified (a real cancelled run) and what to test by hand (cancel with 0, 1 and 2 checkpoints, and a run with no base). Do not archive or merge until the maintainer says so.

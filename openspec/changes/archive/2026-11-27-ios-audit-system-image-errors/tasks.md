# Tasks

## 1. The rule and the finding

- [x] 1.1 In `scripts/lib/logaudit-ios.mjs`, ignore an `Error` with an empty subsystem written by a system image, matched as design.md says, and correct the comments that state the old rule; verify in `tests/logaudit-ios.test.mjs` the cases `/System/Library/`, `/usr/lib/`, both `RuntimeRoot` forms, another folder under `RuntimeRoot`, an image in the app's container, no `senderImagePath`, a `Fault` from `/System/Library/`, an own subsystem from a system image, and a log with only ignored errors giving `REVIEW PASSED`
- [x] 1.2 Show the file name of the image in the excerpt of an `Error` with no subsystem and add the image path to its grouping key; verify with tests that two images with one message give two findings with their counts, that no folder of the path appears, that no image gives `[no subsystem] <message>`, and that findings with a subsystem read as before

## 2. The report

- [x] 2.1 Return `ignoredByImage` from the iOS audit (also empty in the inconclusive results) and keep it in `state.audit` in `scripts/review-state.mjs`; verify with a test that a report written after a waiver still holds it
- [x] 2.2 In `scripts/lib/logaudit.mjs`, list at most five entries of `ignoredByImage` apart from the findings, and make the ignored-errors line, the no-findings line and the console line of `review-state.mjs` state the new rule instead of "Apple frameworks"; verify in `tests/review-state-ios.test.mjs` the list with its times, seven different errors giving five lines and a total of seven, no list for `com.apple.` errors only, and the updated wording

## 3. Documentation

- [x] 3.1 State the new rule, the image in the finding and the list of ignored errors in `skills/review/SKILL.md`, `docs/commands.md` and `docs/commands.es.md`; verify that none of the three still says that only Apple frameworks are noise
- [x] 3.2 Add the "System noise" entry of issue #230 to `GLOSSARY.md`, exactly as written, under `## Language` after the existing entries; verify with `git diff` that nothing else in the file changed
- [x] 3.3 Add a `Fixed` entry under Unreleased in `CHANGELOG.md`; verify it is under Unreleased

## 4. Checks

- [x] 4.1 Run `npm test` and `openspec validate --all` and verify both pass
- [x] 4.2 With the person, run `/relevo:review` from this checkout on an iOS simulator against the app where the case was seen, at its first launch; verify that `fopen failed for data file`, written by `libCoreFSCache.dylib`, is listed as ignored and does not reject the review. Checked on 2026-11-27 without the full `/relevo:review` (agreed with the person): on a clone of the simulator with the app reinstalled, `review-state.mjs audit` of this checkout, on a hand-written state, gave `REVIEW PASSED` and listed that error 2 times

## Workflow follow-up

- Archive the change after the review requirements of the repository are satisfied.

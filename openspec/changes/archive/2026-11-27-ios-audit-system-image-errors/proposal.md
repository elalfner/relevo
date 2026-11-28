# Proposal

## Why

The iOS review audit treats an `Error` as system noise only when its subsystem begins with `com.apple.`, so an Apple library that logs with no subsystem rejects the review with nothing to correct in the app (issue #230, seen in Relevo 0.19.0 with `libCoreFSCache.dylib` on an iOS 27.2 simulator).

## What Changes

- An `Error` with an empty subsystem written by a system image (`senderImagePath` under `/System/Library/` or `/usr/lib/`, also in the simulator runtime form) is system noise: counted, not a finding.
- An `Error` finding with no subsystem names the file of the image that wrote it, and is grouped by image and message.
- The report lists apart what was ignored because of the image (image, message, times; at most five), without changing the verdict.
- The report text, `skills/review/SKILL.md`, `docs/commands.md` and `docs/commands.es.md` state the new rule instead of "Apple frameworks".
- `GLOSSARY.md` gains the term "System noise", with the text the issue gives.

Unchanged: every `Fault` is a finding; an `Error` with a subsystem that is not `com.apple.` is a finding whoever wrote it; an `Error` with neither subsystem nor image is a finding; findings with a subsystem keep their text and grouping.

Out of scope: the audits of the other review adapters, and an architecture decision record.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: which errors of an iOS log are system noise, what a finding with no subsystem shows, and what the report lists about ignored errors.

## Impact

- `scripts/lib/logaudit-ios.mjs` (rule, grouping, excerpt, list of ignored errors).
- `scripts/lib/logaudit.mjs` (report) and `scripts/review-state.mjs` (keeping the list in the review state).
- `tests/logaudit-ios.test.mjs`, `tests/review-state-ios.test.mjs`.
- `skills/review/SKILL.md`, `docs/commands.md`, `docs/commands.es.md`, `GLOSSARY.md`, `CHANGELOG.md`.
- A waiver matches a finding by its excerpt, so one recorded for an error with no subsystem before this change does not match the new excerpt.

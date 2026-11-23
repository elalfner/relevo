# Tasks

## 1. The comparison by content

- [x] 1.1 In `scripts/lib/review-state.mjs`, give `ownerOf` a `titles` argument and return `{ ok: false, foreign: true, lines }` for a state with no recorded change whose lines share no title with the change; keep `unknown` for a state that shares at least one title or holds no line, and decide a state that records a change by its name alone. Verify: unit tests for "Older state of another review", "Older state", "Older state without lines", and that a state with a recorded change ignores its lines.

## 2. init and owner

- [x] 2.1 In `scripts/review-state.mjs`, pass the titles of `checklistFromChange` to `ownerOf` in `init` and `owner`; make `init` refuse a foreign state, naming how many of its lines are not in the change and leaving the file as it is, and make `owner` exit 1 with that message. Verify: command tests for the scenarios of "The state of a review belongs to one change" that concern an older state, including the 0.17.x-shaped state of another issue that this change exists for, and that `init` over an older state that shares lines still succeeds.

## 3. decide

- [x] 3.1 Let `decide` take `<change-dir> [--adapter api | --target ios]`, refuse with a reason when the state is of another change, another kind or another review by content, and decide as before without the argument. Verify: command tests for "Pull request over another review" and "Decide without the change", including a state whose lines are all confirmed and whose audit passed but that is of another change.

## 4. Skill and changelog

- [x] 4.1 Update `skills/review/SKILL.md`: say what `owner` exit 1 means for an older state of another review (stop, tell the person, remove nothing), and pass the change and the kind to `decide`. Verify: the tests that read the skill still pass and the text names `decide <change folder>`.
- [x] 4.2 Add a line under `Unreleased` in `CHANGELOG.md`. Verify: `npm test` passes, including the changelog tests.
- [x] 4.3 Run `npm test` and `openspec validate --all`. Verify: both exit 0.

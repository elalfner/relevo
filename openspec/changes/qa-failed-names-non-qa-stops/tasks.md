# Tasks

## 1. The title and the line that says what happened

- [ ] 1.1 Write first a test in `tests/messages.test.mjs` that renders `qa_failed` with the reason `branch already exists` (and `branch_state: existing` with a `recovery`) and expects no `failed QA` / `no pasó QA` in the title, no `QA still rejected` / `QA la rechazó` and "QA did not reject the work" / "QA no rechazó el trabajo"; the same for a reason the catalog does not know and for two more of the list (`issue changed after ready`, `specification invalid`). Show it failing on the current text. Then add the list of QA rejections and the computed `{{headline}}` in `scripts/lib/messages.mjs` (both languages) and show it passing.
- [ ] 1.2 Tests that keep what must not change: the reasons `QA rejected after the retries` and `QA rejected: nothing the developer agent can fix`, a comment with no reason, `run limit reached`, `protected path in the diff` and the `retries_skipped` case read exactly as before, and the next step line is the same for every reason tested.
- [ ] 1.3 In `tests/messages-language.test.mjs` add the new wording to the `qa_failed` cases so both languages are rendered with no placeholder left over.

## 2. Close

- [ ] 2.1 Check that no other test or document quotes the old title for a non-QA reason (`npm test`, and a search of `docs/` and `skills/` for `failed QA`). One entry under Unreleased in `CHANGELOG.md` (Fixed). Run `npm test` and report any failure. No version bump, no template edited. Draft PR against `dev`; list what is not verified (only `branch already exists` was seen in a real run) and what to test by hand (apply `ready` again after editing the issue text; check the title and the line). Do not archive or merge until the maintainer says so.

# Proposal

## Why

`docs/lens-evaluation.es.md` has no section "Cheaper models (2026-11-06)", which `docs/lens-evaluation.md` has: the Spanish page is 13 lines shorter and has one `##` less. The spec `documentation` already requires every page in both languages with the same structure and every page in the list that the parity test checks, but `lens-evaluation` is not in `PAGES` of `tests/readme-sync.test.mjs`, so the test never looked at it and nothing enforces the "every page is in the list" half of the requirement.

## What Changes

- Translate the section "Cheaper models (2026-11-06)" into `docs/lens-evaluation.es.md`, in the same place (between the second-run explanation and the `bugs` lens).
- Add the language switch line (`English · [Español](...)` and `[English](...) · Español`) to both `lens-evaluation` pages, as every other page has; the parity test requires it once the page is checked.
- Add `lens-evaluation` to `PAGES` in `tests/readme-sync.test.mjs`, so the existing checks (same headings, same table, list and link counts per section, same shell blocks, same external links, working links, listed in the documentation index) apply to it. Fix any other drift between the two pages that this reveals.
- Add a test that derives the pages from the `docs/` folder: every `docs/*.md` is in `PAGES` or in a short list of English-only notes, so a future page cannot be left out again.

## Capabilities

### New Capabilities

### Modified Capabilities
- `documentation`: the requirement "Every page exists in both languages with the same structure" gains the scenario that a page present in `docs/` and missing from the checked list fails the test.

## Impact

- `docs/lens-evaluation.md`, `docs/lens-evaluation.es.md`, `tests/readme-sync.test.mjs`, and one line in the Unreleased section of `CHANGELOG.md`.
- No script, setting or behaviour of Relevo changes.

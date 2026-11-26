# Design

## Context

`tests/readme-sync.test.mjs` already holds the parity checks, driven by a hand-written `PAGES` list. `docs/` has three pages that are English only by decision (`action-parameters`, `architecture-direction`, `pilot-findings`, which say so) and every other page has a `.es.md` twin. `lens-evaluation` was added to the docs without being added to `PAGES`. A probe that added it to `PAGES` made the language-switch check and the heading-count check fail, which is the drift this change fixes. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- The existing checks cover `lens-evaluation`.
- Forgetting to list a new page fails a test.

**Non-Goals:**
- Comparing prose between languages, or other pages' wording.
- Moving `PAGES` to be derived from the folder: the list also gives the order of the documentation index checks and is short.

## Decisions

- **Extend `PAGES`, do not write a second parity test.** The existing fingerprint (shell blocks, pictures, table rows, list items and links per section) is stricter than a heading count, so reusing it avoids two rules that can disagree. Alternative: a standalone heading-count test; rejected because it duplicates a weaker check.
- **A completeness test that reads `docs/*.md`.** It asserts that each page other than `README.md` is in `PAGES` or in an explicit `ENGLISH_ONLY` list of the three notes. A new page then fails until someone chooses. Alternative: derive `PAGES` from the folder; rejected because an untranslated page would silently drop out instead of failing.
- **Translate, do not copy.** The Spanish section keeps the table, the numbers and the code names of the English one and follows the voice of the page.

## Risks / Trade-offs

- [The fingerprint check finds more drift than the one section] → fix it in this change, since the check cannot be switched on otherwise.
- [`ENGLISH_ONLY` grows to hide a missing translation] → it is a visible list in the test, reviewed with the diff.

# Tasks

## 1. Close the drift in the lens evaluation page

- [x] 1.1 Translate the section "Cheaper models (2026-11-06)" into `docs/lens-evaluation.es.md`, between "Cómo se llegó al resultado" and "La lente `bugs`", and verify it has the same table rows and the same numbers as the English one
- [x] 1.2 Add the language switch line under the title of both `docs/lens-evaluation.md` and `docs/lens-evaluation.es.md`, and verify it matches the pattern the parity test uses for the other pages
- [x] 1.3 Add `lens-evaluation` to `PAGES` in `tests/readme-sync.test.mjs` and verify `node --test tests/readme-sync.test.mjs` passes, fixing any further difference between the two pages that it reports

## 2. Keep a page from being left out again

- [x] 2.1 Add a test to `tests/readme-sync.test.mjs` that lists `docs/*.md` and requires each page other than `README.md` to be in `PAGES` or in an `ENGLISH_ONLY` list (`action-parameters`, `architecture-direction`, `pilot-findings`); verify it fails when `lens-evaluation` is taken out of `PAGES` and passes with it back
- [x] 2.2 Add one line to the Unreleased section of `CHANGELOG.md` saying the Spanish lens evaluation page was completed and the parity test now covers it and every page of `docs/`

## 3. Validate

- [x] 3.1 Run `npm test` and `openspec validate --all` and verify both pass

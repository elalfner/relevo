# Tasks

## 1. The tests first

- [ ] 1.1 Add `tests/docs-claims.test.mjs` (D4) and add `guide`, `security` and `issue-format` to `PAGES` in `tests/readme-sync.test.mjs`. Verify: the new tests fail now for the missing pages and settings, and each failure message names the page or setting.

## 2. The pages

- [ ] 2.1 Write `docs/guide.md` and `docs/guide.es.md` (D1, D2). Verify with the parity test and the claims test, plus a test that the table of the life of an issue matches `next-step.mjs`.
- [ ] 2.2 Write `docs/security.md` and `docs/security.es.md` (D3). Verify with the parity and claims tests: every file, script, setting and label it names exists.
- [ ] 2.3 Translate `docs/issue-format.md` to `docs/issue-format.es.md`. Verify with the parity test.
- [ ] 2.4 Expand `docs/commands.md` and `docs/commands.es.md` (D6) and `docs/configuration.md` and `docs/configuration.es.md` (every setting, `platforms`, `checks`, `skills.allow_scripts`, the layers, the limits by credential). Verify with the parity and claims tests.
- [ ] 2.5 Link the new pages from `docs/README.md`, `docs/README.es.md`, `README.md` and `README.es.md`, and update `CHANGELOG.md`. Verify with the parity test (the index links every page) and the changelog test.

## 3. Integration

- [ ] 3.1 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [ ] 3.2 Read the guide as someone new would, following it against the sandbox: run the commands it names that can be run here (`doctor`, `status`, `stack-profile`, `review-adapter`, `archive-state`, `fix-tasks`) and check each does what the guide says. Record in `docs/pilot-findings.md` what did not match and was corrected.

# Tasks

Work on branch `fail-closed-guards-161-162-163` (from `dev`); run `git branch --show-current` before every commit. For each defect the test is written and shown failing on the current code before the code changes. If a test passes on the old code, the defect does not exist: say so with that output and change no code for it.

## 1. #161 an advice citation on an always-blocking lens

- [x] 1.1 In `tests/qa-aggregate.test.mjs`, add the tests of the scenarios "A real problem that cites advice on the side" (`security` lens, vulnerability text, cites an `[advice]` line, text does not name it: the result is `QA REJECTED`, in `findings`), the same on the `spec` lens, and "Advice and a hard rule, or advice and an unverified line"; run `node --test tests/qa-aggregate.test.mjs` and keep the output that shows the first two failing.
- [x] 1.2 Change the fixture of the existing `Advice` test so the text of the finding repeats the quote, and add the case of the `interface` lens on attempt 1 that cites advice only (unchanged: advisory) and one of the `code` lens with a real problem and advice on the side (blocks); confirm what is unchanged passes on the old code.
- [x] 1.3 Change the `adviceOnly` test in `scripts/lib/qa-aggregate.mjs` as design D1 says (an always-blocking lens needs the text of the finding, without the `Rule:` citation, to hold the quote of every advice line it cites); verify the file's tests pass and `git diff --stat` shows the edit is limited to that expression and one small helper.
- [x] 1.4 Update the sentence on advice in `docs/configuration.md` and `docs/issue-format.md` and their Spanish pages, and `skills/go/references/qa-run.md` where it says a finding that cites advice is a note, and verify with `node --test tests/docs-claims.test.mjs tests/readme-sync.test.mjs`.

## 2. #162 the model asked for by the issue and the default model

- [ ] 2.1 In `tests/model-plan.test.mjs`, change the test "The issue asks for a lower model - it is used, even below the floor" into the scenario that raises to the floor (it asserts the old behavior, so it is expected to fail on the old code), and add: `QA-model: haiku` with all lenses on `auto` and floor `sonnet` (every lens on `sonnet`, `why` says raised to the floor), a request between floor and ceiling (used), one `QA-model:` with lenses of different floors (each by its own range), a role not on `auto` (unchanged), and `Model:` of the developer below a raised floor; run the file and keep the output that shows the failures.
- [ ] 2.2 Add the test of the none path: no tasks and no scenarios with a floor above the default model of the role (expected `floor`, reason says the default was raised), a ceiling below the default, a default not in a custom ladder, and the default inside the range (same text as today); run it and keep the result, stating which of them fail on the old code.
- [ ] 2.3 Change `decide` in `scripts/lib/model-plan.mjs` as design D2 and D3 say, one helper for both paths; verify `node --test tests/model-plan.test.mjs tests/model-plan-report.test.mjs tests/issue-model.test.mjs` passes.
- [ ] 2.4 Update the model sentences in `docs/configuration.md`, `docs/issue-format.md` and their Spanish pages, in `skills/issue/SKILL.md`, and in the header comment of `model-plan.mjs`; verify with `node --test tests/docs-claims.test.mjs tests/readme-sync.test.mjs tests/skill-issue.test.mjs`.

## 3. #163 a scan exception and a second credential on the line

- [ ] 3.1 In `tests/scan-exceptions.test.mjs`, add the tests of the scenarios "A second credential on the listed line" (the `AKIAIOSFODNN7EXAMPLE` entry for `config/sample.env`, plus a second credential of another kind), "A second key of the same kind on the listed line", "A pattern that is not on the finding" (the pattern is in a comment next to the credential), and keep as they are "A listed line goes through", "The line moved", the glob case and the marker case; run the file and keep the output that shows the first three failing.
- [ ] 3.2 Add to `scripts/lib/scan.mjs` a function that returns every credential match with its offsets, without changing `findCredentials` or `scanDiff`; add a test in `tests/scan.test.mjs` that its names and counts agree with `findCredentials` for each pattern, and verify `node --test tests/scan.test.mjs`.
- [ ] 3.3 Change `scanWithExceptions` in `scripts/lib/scan-exceptions.mjs` as design D4 says (per finding, every match of the kind nested with an occurrence of the pattern; a finding with no span is reported); verify `node --test tests/scan-exceptions.test.mjs tests/commit-change.test.mjs tests/validation-gate.test.mjs` passes and the report format of `formatExceptionReport` is unchanged.
- [ ] 3.4 Update "Reviewed false positives of the credential scan" in `docs/security.md` and `docs/security.es.md` (the pattern has to sit on the credential it excuses; a second credential on the line is reported), and verify with `node --test tests/docs-claims.test.mjs`.

## 4. Changelog, spec check and the whole suite

- [ ] 4.1 Add an entry under `## [Unreleased]` in `CHANGELOG.md`, following its convention (`### Fixed` or `### Changed` as the file uses, issue numbers in the title, the breaking part of #162 stated), with no change to `.claude-plugin/plugin.json`; verify with `node --test tests/changelog.test.mjs`.
- [ ] 4.2 Run `openspec validate fail-closed-guards-161-162-163 --strict` and `npm test`; report each failure honestly, and verify that no file of #118 (`usage-limit.mjs`, `relevo-queue.yml`, `relevo-go.yml`, `run-usage.mjs`) or #135 (`skills/go/SKILL.md`, `agents/dev.md`, `issue-parse.mjs`) is in `git diff --stat dev`.

## Workflow follow-up

- Do not archive and do not merge: the maintainer tests first and may change the spec. Open the draft pull request against `dev`; its description lists what is not verified and what to test by hand.
- After the maintainer approves: `/opsx:archive` on `dev`, then the usual promotion; the version in `.claude-plugin/plugin.json` and the release entry of the changelog are set by the release, not here.

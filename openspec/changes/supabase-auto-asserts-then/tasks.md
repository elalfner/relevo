## 1. State

- [x] 1.1 In `scripts/lib/review-state.mjs`, store `covers` (a list of names) in the run in `recordRun`, and add to the proof guard for a Supabase line the three refusals: no covered name, a name not in the pgTAP file (read from `state.cwd` and the run's `filter`, a doubled quote read as one, an unreadable file refuses), and a name among the run's failing names; verify with tests for each refusal and for a passing proof.
- [x] 1.2 In `scripts/review-state.mjs`, accept `--covers "<name>[, <name>]"` on `ran` (split on commas like `--failing`) and say the names in the "recorded" message; verify with a test of the message.
- [x] 1.3 Make `runsSection` list the covered names of a Supabase run in the pull request body; verify with a test of the text.

## 2. Tests of the flows

- [x] 2.1 Update `tests/review-supabase.test.mjs` and `tests/review-autopilot.test.mjs` so every proof of a Supabase line records `--covers` with a name of the fixture file, and add the scenarios of the delta (no covered name, name not in the file, covered assertion failed); verify Laravel lines and the person's runs are unchanged.

## 3. Text

- [x] 3.1 Update step 5 of `skills/review/SKILL.md` for Supabase (record `--covers` with the names that cover the `THEN`, never invent one, and say what the script checks and what it does not); verify `tests/skill-review.test.mjs` and add a test that the skill names `--covers`.
- [x] 3.2 Update `docs/commands.md` and `docs/commands.es.md`, add a line under the `Fixed` or `Changed` entry of `## [Unreleased]` in `CHANGELOG.md`, and update the "Not caught" line of task 6.1 in `docs/pilot-findings.md`; verify `tests/docs-claims.test.mjs`.
- [x] 3.3 Run `npm test` and `openspec validate --all`.

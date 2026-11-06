# Tasks

## 1. Configuration

- [x] 1.1 In `scripts/lib/config.mjs` accept `agents.ladder` (a list of distinct non-empty names, default `[haiku, sonnet, opus]`), `model: auto` and the `floor` and `ceiling` of a role (names of the ladder, floor not above ceiling, defaults by the rule of the design); `--effective` prints them; extend `tests/config.test.mjs` with the defaults, a valid ladder, a repeated name, a floor above the ceiling and a name outside the ladder; verify `node --test tests/config.test.mjs` passes
- [x] 1.2 With `agent.build: antigravity` accept `auto` and report it as not applied, like the other settings of the agents; extend the test of the warning; verify it passes

## 2. The lines of the issue

- [x] 2.1 Add `scripts/lib/issue-model.mjs` that reads `Model:` and `QA-model:` from the text of an issue (one line each, the first wins, case of the key ignored, the value a single token), and test it with both lines, none, a repeated line, a value with spaces and a line inside a code block; verify `node --test tests/issue-model.test.mjs` passes
- [x] 2.2 Make `scripts/check-issue.mjs` and `scripts/issue-sections.mjs` accept the two lines without counting them as a section; extend their tests; verify they pass

## 3. The model plan

- [x] 3.1 Add `scripts/lib/model-plan.mjs`: from the effective configuration, the text of the issue, the tasks of the change and the active lenses, return for each role `{ model, effort, source, why }` by the rules of the design (size, the two raises, the security lens, the clamp of the issue, `trust: public`, a name outside the ladder, too few signals, a role not on `auto`); test every scenario of the go spec and that the same inputs give the same plan; verify `node --test tests/model-plan.test.mjs` passes
- [x] 3.2 Add `scripts/model-plan.mjs` that reads the files, prints the plan as one line of JSON, saves it as `model-plan.json` in `$RELEVO_PROGRESS_DIR` when there is one, and exits 0 even when it cannot make the plan (it then prints the configuration as the plan with the source `config` and the reason); test the command in temporary folders: auto, not auto, a failing input, no progress folder; verify `node --test tests/model-plan.test.mjs` passes

## 4. Use of the plan

- [x] 4.1 In `skills/go/SKILL.md` and `skills/go/references/qa-run.md` run the plan once before the first launch and launch the developer and each lens with the `model` and `effort` of the plan instead of reading `agents` directly; say what to do when the script fails; verify with `tests/skill-go.test.mjs` that the command appears before the first launch and that the launch text names the plan
- [x] 4.2 In `skills/fix/SKILL.md` and `skills/review/SKILL.md`, where they launch the developer or the lenses, use the same plan; verify with their tests

## 5. The report

- [x] 5.1 In `scripts/lib/run-usage.mjs` and `scripts/run-usage.mjs` read `model-plan.json` and add the sentence of the models and the `plan` key to the comment and the marker, leave out what is missing and give today's comment when there is no plan; make `parseUsageMarker` read the key when it is well formed and ignore it otherwise; verify the usage and digest tests pass and add the cases of a run with and without a plan
- [x] 5.2 In `skills/issue/SKILL.md` let `/relevo:issue` propose a `Model:` line with its reason, written only when the person confirms; verify with `tests/skill-issue.test.mjs` (or the test that reads the skill)

## 6. Docs and release

- [x] 6.1 Document `agents.ladder`, `auto`, `floor`, `ceiling`, the lines of the issue and the report in `docs/configuration.md`, `docs/execution.md` and their `.es.md` versions, and add the settings to `templates/relevo.yml` as comments; verify `tests/docs-claims.test.mjs` passes
- [x] 6.2 Add the CHANGELOG entry under 0.14.5 with its known limits (the effort is not scored, the signals come before the build, no escalation on retry, not verified in a real run); verify the version tests pass
- [x] 6.3 Run the full suite (`npm test`) and `openspec validate model-per-issue --strict`; verify both are clean

## Workflow follow-up

- Commit on the working branch (check `git branch --show-current` first), open a draft pull request to `dev`, and archive the change after the review.

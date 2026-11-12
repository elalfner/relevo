# Proposal

## Why

A code review of #160 found three places where a guard of an unattended run is weaker than the documentation says. Each is a way for one input (a line of the issue, a citation in a QA report, a line of a reviewed exception) to do more than its author reviewed, and each must fail closed (C2 of #115: no change weakens a security guard). They were found by reading; this change first writes the test that shows each one, and says so if one is not real.

- **#161, QA aggregate.** A finding of a lens that always blocks (`spec`, `security`, `code`: `ALWAYS` in `lens-plan.mjs`; the issue names the first two) that cites a rule line marked `[advice]` goes to `advisory`, whatever else it says. A real vulnerability that carries an advice line as a side remark does not block.
- **#162, model plan.** A model that the issue asks for (`Model:`, `QA-model:`) is clamped to the `ceiling` of the role but not to its `floor`, so one line of an issue puts a QA lens below the floor that `relevo.yml` (or the default of #134) set. The path with nothing to score returns the default model of the role without checking it against either bound.
- **#163, credential scan exceptions.** An exception excuses the whole line when its `pattern` is anywhere in it, so a second, different credential on the same line is excused with the reviewed one.

## What Changes

- **QA aggregate (#161).** On a lens that always blocks, a finding that cites only `[advice]` lines is an advisory note only when the finding itself names the rule: the words quoted from each cited advice line appear in the text of the finding, outside the `Rule:` citation. Otherwise it blocks, as a finding without a citation does. A hard rule still decides first, an unverified citation is unchanged, and the `interface` lens, which blocks only while a retry remains, is unchanged.
- **Model plan (#162).** For a role on `auto`, a model that the issue asks for below the `floor` is raised to it and the plan says so, as a request above the `ceiling` is lowered. Each QA lens is clamped by its own range. The default model of the role, used when there is nothing to score, is kept inside the range as well, and the plan says when it moved. **BREAKING for a person who relied on it:** an issue could lower a role below its floor; it cannot now. The documentation and the main spec say the opposite today ("lower the model freely", "MAY go below its floor"); both change.
- **Scan exceptions (#163).** An exception excuses only the credential finding that its `pattern` describes: the pattern has to sit on the text that the finding matched, not just somewhere in the line. Any other credential on the line is reported and the line is not excused. When it cannot be told which finding an entry covers, the finding is reported.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: four requirements change, all already in it:
  - `A violation of a hard rule blocks`: an advice citation downgrades a finding of an always-blocking lens only when the finding names that rule.
  - `What the issue asks for is clamped`: the request is also clamped to the floor.
  - `The plan scores the size of the change and two raises`: the default model used with nothing to score stays inside the range.
  - `A reviewed false positive of the credential scan can be listed with a reason`: an entry excuses the finding its pattern describes, not the line.

## Impact

- Code: `scripts/lib/qa-aggregate.mjs` (the `adviceOnly` test), `scripts/lib/model-plan.mjs` (`decide`), `scripts/lib/scan-exceptions.mjs` and a small addition to `scripts/lib/scan.mjs` that returns where each credential matched (the output of `scanDiff` does not change).
- Tests: `tests/qa-aggregate.test.mjs`, `tests/model-plan.test.mjs`, `tests/scan-exceptions.test.mjs`; one existing test asserts the behavior that #162 reverses and changes with it.
- Docs, in English and Spanish: `docs/configuration.md` and `docs/issue-format.md` (the model), `docs/security.md` (the exceptions), `docs/configuration.md` (advice); `skills/issue/SKILL.md` where it describes the clamp; `CHANGELOG.md` (Unreleased).
- No change to the version, to `relevo.yml`, to a workflow, or to the files that #118 and #135 own. `qa-aggregate.mjs` is edited in one place because #150 will touch it later.
- Out of scope: which lines of a rules file are advice; the default value of the floor (#134); which exception entries are too broad (already refused).

# Design

## Context

See `proposal.md` for the motivation. State of `dev` at ad8202d, read before writing this (the line references of the issues were not trusted):

- `qa-aggregate.mjs` computes `adviceOnly = !hard && checked.some(v) && checked.every(v && !v.hard)` and then `else if (blocks && !adviceOnly) → findings, else → advisory`. `blocks` is `ALWAYS.includes(lens) || !last`, so for `spec` and `security` `adviceOnly` is the only thing that can turn a rejection into a note. The lens instructions (`agents/qa-*.md`) tell a lens to mention an advice rule as a note *without* a `Rule:` line; a finding that cites one is already off the prescribed path. The script cannot read what a finding is about, only its text.
- `model-plan.mjs` `decide`: for `askedName` it compares only with the ceiling; `size === 'none'` returns `defaults.model`. Config validation already guarantees `floor <= ceiling` in the ladder. The main spec and `design.md` D5 of the archived `model-per-issue` say, on purpose, that the issue "lowers freely" and "a value below the floor is used". `tests/model-plan.test.mjs` has a test of that name. So #162 is not a slip of the code: it **reverses a documented decision**, and the maintainer wrote the issue, so this change follows the issue and changes the spec, the docs and that test.
- `scan-exceptions.mjs` groups the findings by line and excuses the line when every finding is a credential and `text.includes(pattern)`. `scanDiff` findings carry no span, and `findCredentials` returns one entry per *kind* of pattern, so two keys of the same kind on a line are one finding.

## Goals / Non-Goals

**Goals:**
- Each of the three checks fails closed: when the script cannot tell, it blocks (#161), uses the safe end of the range (#162) or reports (#163).
- A person can reproduce each verdict by reading the report, the config or the line, as the other guards of the repository allow.
- The behavior that stays the same stays the same, with the existing tests unchanged except the one that asserts the reversed behavior and the advice test fixture noted below.

**Non-Goals:**
- Which lines of a rules file are advice; the default floor (#134); which exception entries are too broad.
- The `configPlan` path (the plan could not be made): it still gives a role on `auto` the default model of the role, unclamped. See Open Question 2.
- The lenses that block only while a retry remains (`code`, `interface`): unchanged.
- No new setting, no new output field of `scanDiff`.

## Decisions

**D1 (#161). On an always-blocking lens, advice downgrades a finding only when the finding names the rule.** For each cited line: `ruleAt` finds it, the quote matches, it is advice (all of this is the existing `check`). New: the text of the finding, taken from the numbered line with the inline `Rule: …` citation cut off, must contain the quote of **every** advice line it cites (whitespace and case ignored, as `quoteMatches` does). If one is missing the finding goes to `findings` and the lens rejects. This keeps `hard` first and keeps a finding with an unverified citation blocking, as today. Applies only when `ALWAYS.includes(lens)`; for the other lenses `blocks` is a retry mechanism, not a guard, and `adviceOnly` works as before.
  - Why this and not a score of how "about" the rule a finding is: it is deterministic, fails closed, and the reader can verify it by looking at one line, like the hard-rule check.
  - Alternative A: on an always-blocking lens an advice citation never downgrades. Simpler and strictest, but it makes the second scenario of #161 ("says only that an advice rule was not followed → advisory, as today") impossible for `spec` and `security`.
  - Alternative C: a new field in the report (`Class: advice`) that the lens writes. Changes the report protocol and the four agent files, which `go` and #150 depend on. Not worth it for this.
  - Consequence: the fixture of the existing test `Advice` (`1. Names are long. Rule: CLAUDE.md:4 "Prefer short names"`, lens `spec`) is not advice-only any more, because its text does not repeat the quote; the test changes to a text that names it, and a second case with the side remark is added. A `spec` finding that paraphrases an advice rule now blocks: the cost of failing closed, and the prescribed way to give advice (a note with no `Rule:` line) is not affected.

**D2 (#162). Clamp to the floor in the same place as the ceiling.** In `decide`, a request whose index in the ladder is below `floor` returns `{ model: floor, source: 'issue', why: 'the issue asks for X, raised to the floor Y' }`. `decide` already runs once per lens with that lens's range, so a single `QA-model:` is clamped per lens with no new loop. The ladder check and the public-trust check stay before it; a role that is not `auto` returns first, as today.
  - The developer is clamped too: the issue says "a role", and the default floor of the developer is `haiku`, so with the default configuration `Model: haiku` still works. It matters only when the repository raises a floor.
  - The `source` stays `issue`: the issue did choose, and the `why` says what happened, like the ceiling clamp today.

**D3 (#162). The default model with nothing to score is kept in the range.** Same helper: if the default is below the floor it is raised to it, above the ceiling lowered to it, not in the ladder it is not used (it gets the floor, the end of the range that costs least and that the configuration allows). `source` stays `auto`; the `why` says the default was moved and why. A default inside the range is returned as today with the same text.

**D4 (#163). Match the finding by the span it matched.** `scan.mjs` gets a function that returns every credential match with its offsets (`{ name, start, end }`, for the patterns with an `accept` rule only the accepted matches); `findCredentials` and `scanDiff` keep their output. In `scan-exceptions.mjs`, for each line with credential findings and each finding, the finding is excused when an entry applies to the file and **every** match of that finding's kind on the line is *nested* with an occurrence of the entry's pattern: the pattern holds the match (`AWS_KEY=AKIA…` as a pattern, key as the match) or lies inside it (`password: 'hunter2` inside the matched assignment). Findings of other kinds on the line are never excused (as today). A finding without a match span, or with one match not covered, is reported. A line is "applied" once per entry that excused something on it; the report format does not change.
  - Why nested and not "overlapping" or "the pattern is somewhere in the line": a pattern that only touches the secret by one character, or sits in a comment next to it, would still describe nothing the person reviewed. Nested is the narrowest reading that keeps every pattern already in use working (the example of `docs/security.md`, `password: z.string`, and the test's `password: 'hunter2`).
  - Why every match of the kind: `findCredentials` reports one finding per kind, so a second key of the same kind would otherwise ride on the first.
  - Alternative: change `scanDiff` to return a finding per match with spans. Cleaner, but it changes the shape that `commit-change`, the gate and their tests read, which is more than this defect needs.

**D5. Test first, per defect.** Each task group writes the test that fails on the current code, runs it and records the failure, then changes the code. If a defect does not exist the test passes on the old code and the group says so and changes no code. #162's second half (the none path) is checked the same way and may turn out to be real only for a floor above the default.

## Risks / Trade-offs

- [A `spec` or `security` finding that paraphrases an advice rule now blocks (D1)] → It is the fail-closed side; the lens is told to give advice as a note, and the finding names how to get out (quote the rule in the text). Open Question 1 lets the maintainer choose alternative A or keep today's behavior.
- [A repository that relied on an issue lowering a role below its floor stops being able to (D2)] → That is the point of the issue; a repository that wants it lowers its own `floor` in `relevo.yml`. Documented as breaking in the changelog.
- [An existing exception whose pattern sits next to the secret and not on it stops excusing it (D4)] → It then reports the finding, which is the safe failure, and the report names the file; the entry is edited by a person. No entry in the repository has this shape.
- [Two lens-protocol changes at once with #150 in the same file] → The edit in `qa-aggregate.mjs` is limited to the `adviceOnly` expression and one helper.

## Open Questions

These are for the maintainer; the artifacts use the recommended answer.

1. **How should a script tell "the advice rule is what the finding is about" from a side remark (#161)?** The issue gives two scenarios and no rule. Recommended: D1 (the finding names the rule in its own text). Alternatives: A (never downgrade on `spec` and `security`), or keep the current behavior. This changes the spec scenarios and one existing test.
2. **Should the fail-open path `configPlan` (the plan could not be made) also keep a role on `auto` inside its range (#162)?** Today it gives the default model of the role, so a repository with `floor: opus` runs QA on `sonnet` when the plan fails. The issue's code pointers name only `decide`, and "the plan fails open" is a requirement of its own, so this change leaves it. Say if it should be included.

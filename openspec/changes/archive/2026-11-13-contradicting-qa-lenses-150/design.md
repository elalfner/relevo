# Design

## Context

See `proposal.md` for the motivation. Observed in the code on `dev` (not assumed from the issue):

- `aggregate()` in `scripts/lib/qa-aggregate.mjs` is stateless: it sees only the reports of the current attempt, so it cannot know what the developer was asked to do before. `qa-run.md` step 3 already gives each lens "its previous report", so the reports of the previous attempt exist in the scratch folder.
- Findings are free text with a number, a class and optional `Rule:` citations; there is no structured "target" or "direction". The text of a finding is written by a model.
- A finding of the `security` lens always blocks, a hard rule blocks on every attempt (#121, #161), and `all_non_fixable` already skips retries when nothing is fixable. `run_max_cost` and the budget checks of step 5 are untouched.

## Goals / Non-Goals

**Goals:** stop spending an attempt per side when one lens rejects what another lens asked for; decide in a script (C1); never weaken a guard (C2); say both findings in the comment.

**Non-Goals:** judging whether two sentences mean opposite things (impossible without a model); changing a lens; a new exit class in the usage statistics; touching the workflow templates.

## Decisions

### D1. A script-only rule is possible only for a narrow case, and the design says which

A script cannot read "read it from a constant" and "the assertion can no longer fail" and conclude they oppose each other. What it can check is a *reversal of attention*: lens B now blocks on a thing that lens A asked about in the previous attempt, which A no longer asks about (the developer addressed it), and which B had not raised before. Whether that is a true contradiction or a plain mistake of the developer in satisfying A cannot be told by a script, so the rule is restricted to the case where there is no other thing left to fix (D3). It does not detect a contradiction whose findings quote no common words; those retry as today. This is the narrowest rule that is reliable; guessing wider would stop retries that could have succeeded.

### D2. What the script compares

New input `--previous <lens>=<file>` (repeatable): the reports of the previous attempt, saved by `qa-run.md`. For each current blocking finding F of lens B, it looks for a finding O of the previous attempt of a lens A ≠ B such that all hold:

1. **Shared words.** F and O both quote the same *anchor*: a span in backticks or in straight or curly double quotes, of 3 or more characters, compared after squashing case and spaces. A span that looks like a path (has `/`, or ends in a file extension) or that is part of a `Rule:` citation does not count, because two lenses naming the same file is not a disagreement. It reuses the squash and quote handling of the `Rule:` parser (`namesQuote`) instead of a second one.
2. **A addressed it.** No current finding of A (blocking or not) shares an anchor with O. If A repeats it, the developer did not address it and there is nothing contradictory.
3. **B is new.** No finding of the previous report of B shares an anchor with F. If B repeats itself, it is the same lens repeating a finding: not a contradiction.
4. **Neither side is a guard.** B and A are not `security`; neither F nor O carries a `Rule:` citation that is verified as hard. (O is checked from its text: a `Rule:` line on it excludes it, verified or not, to fail closed.)

### D3. When it stops the retries

`contradiction` is reported when **every** blocking finding of the attempt is the second side (F) of such a pair. If any blocking finding is not (another real defect, a security finding, a hard rule, a finding with no anchor), `contradiction` is `null` and the retry runs as today, with the whole set of findings given to the developer. Reporting on the last attempt also helps (the comment names the disagreement), but it saves nothing there.

Output: `contradiction: null | { pairs: [{ first: { lens, number, text }, then: { lens, number, text }, quoted }] }`. `result` stays `QA REJECTED`; the exit code stays 1; nothing becomes a pass.

### D4. Fails closed

No `--previous`, a missing or unreadable file, or a previous report with no valid verdict contributes no findings, so no pair can form: the output is today's output. Only on an attempt ≥ 2. A parse failure never throws from this check.

### D5. What `qa-run.md` does, and the comment

Step 4 passes `--previous` on attempt ≥ 2 (the saved reports of the previous attempt; these are the files already kept for the lenses). Step 5: if `contradiction` is not `null`, do not retry: take the failure path with the reason `QA rejected: the lenses contradict each other`, which keeps the work like the other QA reasons and has the class of exit `other`. The failure comment (`qa_failed`) gets four new values (`lens`/`finding` of each side) and one line quoting both, in English and Spanish, through the message catalog; the language test covers it. `run_max_cost` and the budget remain the hard stop; this only adds an earlier stop.

### Alternatives considered

- **A model call to compare findings:** rejected, C1.
- **Compare whole-text similarity (tokens/Jaccard):** two findings about the same code share many ordinary words; false positives. Quoted anchors are what the lens chose to name.
- **Require the same file:line:** lenses cite files loosely and the same file appears in unrelated findings.
- **Stop the retries on any shared anchor even with other fixable findings:** would drop real fixes; D3 prefers to retry.

## Risks / Trade-offs

- [A model finding that quotes no code word is missed] → the retry runs as today; the cost is the status quo.
- [A reversal that is the developer's own mistake is read as a contradiction] → only when it is the sole thing left; the comment quotes both findings and the work is kept on the branch, so a person decides.
- [Lenses vary how they quote] → covered by tests with backticks and curly quotes; the manual check below uses a real run.
- [Messages conflict with the parallel change to the catalog] → the edits are new lines in `qa_failed`; resolved at merge.

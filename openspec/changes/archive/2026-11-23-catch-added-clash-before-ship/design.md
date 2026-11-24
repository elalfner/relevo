# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- `openspec archive` applies a delta to the main specification in a fixed order (renamed, removed, modified, added) and aborts the whole archive on the first header that does not fit: ADDED "already exists" (also when it differs only in case or spacing), MODIFIED or REMOVED "not found", RENAMED "source not found" or "target already exists". Nothing is written when it aborts.
- `ship` meets this only at the archive step, in `skills/ship/SKILL.md` step 3 and in `archive()` of `scripts/lib/ship-unattended.mjs`, after the person's written confirmation or after the label. The reason shown is the archive's own text.
- `review` already merges the base branch into the feature branch before the person tests (step 1 of `skills/review/SKILL.md`), so the base's current main specifications are on disk at that moment.
- `scripts/lib/archive-check.mjs` and `archive-state.mjs` already read the change folder; there is no script that reads a delta.

## Goals / Non-Goals

**Goals:**
- A delta that cannot be archived is found when the base moves, not when the person ships.
- One rule, in one script, used by `review`, the local `ship` and the unattended `ship`.

**Non-Goals:**
- Rewriting the delta. The way out is `/relevo:fix`, which already updates the specification first.
- Judging the text of requirements; only headers and operations.
- Running in `go`.

## Decisions

- **A script that mirrors the archive's header rules, not a dry run of the archive.** `openspec archive` has no dry-run option and writes to the folder, so using it as a probe would mean running it on a copy. A script `scripts/delta-check.mjs --change <folder> --base <ref>` reads `openspec/changes/<folder>/specs/*/spec.md`, collects the headers under each operation, reads the main specification of the same capability from the base (`git show origin/<base>:openspec/specs/<cap>/spec.md`) and applies the same rules in the same order, so a header that one operation of the delta removes or renames can be added again by another, as the archive allows. The rules read from `openspec archive` itself: ADDED fails when the name exists with different text (identical text is a no-op) or differs only in case or spacing; MODIFIED fails when the name is missing or when the block lacks a scenario the current requirement has (it would drop it); RENAMED fails when the source is missing and the target is too, or the target exists; REMOVED of an absent name only warns, and fails only for a variant that differs in case or spacing; MODIFIED and RENAMED on a capability with no main specification fail. Names are compared as OpenSpec does (a closing run of `#` is not part of the name; the fold ignores case and runs of spaces). Alternative considered: parse the output of the failed archive; rejected because that is what happens today and it comes too late. The cost of mirroring is that the rule can drift from OpenSpec's; a test runs the real `openspec archive` over a set of fixture deltas and compares the verdict, so a change of OpenSpec that moves the rule fails a test.
- **Compare against `origin/<base>`, not the working tree.** The archive will run on the branch after it has the base merged, but ship does not merge the base; it archives what the branch holds. The check therefore has two sources: the branch's main specifications (what the archive will really see) and the base's (what the branch will meet at the merge). A clash against the branch's own copy is certain; one that only the base shows is what a sibling issue's merge causes, and the review's synchronisation makes the two the same. In `ship` the check runs against the branch as it is, and the review's check runs after the merge of the base, so both are exact.
- **Output: one line per clash, exit 1.** `capability`, `operation`, `header` and a `reason` (`already-exists`, `variant-exists`, `not-found`, `scenario-dropped`, `target-exists`, `source-not-found`, `no-main-spec`), with the dropped scenario in `detail` when there is one, as JSON with `--json` for the skills and a plain line otherwise. Exit 0 and no output when nothing clashes. The script writes nothing.
- **Where it stops the flow.** In `review`, after the synchronisation succeeded and before QA re-runs on it: a clash leaves the issue `built` and ends the step with the message. In the local `ship`, in step 1 after the scan, before the confirmation. In `runUnattendedShip`, before `archive()` and only when the change is still `active`; an ordinary stop (`ship_stopped`) whose reason names the capability and the requirement and says that applying the label again does not help until the specification is corrected. The review reads the base from the git ref (`--base origin/<base>`) and `ship` from the working tree, which is what the archive will see. The archive's own failure stays as the last guard.
- **The message names the way out.** For ADDED clashes: the requirement already exists in the main specification, so the delta must modify it with its full text; for the others, the header it expected. Both say `/relevo:fix <issue>`.

## Risks / Trade-offs

- [The script's rule drifts from OpenSpec's] → the comparison test against the real archive in the fixtures; the archive itself remains the final guard, so a drift can only cause a late stop as today or a false early stop that the test is there to catch.
- [A false clash blocks a review that would have archived fine] → the script applies the operations in the archive's order, and the message names the exact header so the person can see it at once.
- [A branch with several capabilities has several clashes] → the script reports all of them in one run, not the first.
- [The unattended run now stops earlier on something it used to find at the archive] → the stop is the same kind of outcome (nothing archived, label removed), only with a message that says what to do.

## Migration Plan

None. The workflow template's list of scripts to require from the package gains `delta-check.mjs`; repositories get it when they raise `RELEVO_VERSION` after the release, and a package without the script stops the run before anything changes, as the template already does for the others.

## Open Questions

- Whether `go` should also run the check at the end of a build is left out; the review runs it again before approval, and the change can be revisited if builds that sit for days before review prove common.

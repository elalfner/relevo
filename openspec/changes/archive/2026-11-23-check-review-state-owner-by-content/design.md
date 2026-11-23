# Design

## Context

`ownerOf(state, { change, kind })` in `scripts/lib/review-state.mjs` compares the `change` recorded in the state and the kind of review. A state with no `change` (every state written before 0.18.0) comes back as `{ ok: false, unknown: true }`, and `init` only refuses when the owner is known and differs, so it overwrites an unknown one. `owner` exits 1 on it, but the review skill is what runs `owner`, and `decide` never compares anything: it reads `decidePr(state)` from the file alone. The state does hold what tells reviews apart even when it holds no change: each line has the `title` of a scenario (`checklistFromChange(changeDir)` yields the same titles from the change). See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A state that records no change is told apart from the review being started or resumed by its lines.
- The gate before the pull request refuses a state of another review.

**Non-Goals:**
- Comparing lines for a state that records a change: the name decides, and `sync` reconciles lines after a specification edit.
- Recording the platform name, or any new field, in the state.
- An `--adopt` option that stamps the change on an older state.
- Making `init` refuse to restart the review of the same change.

## Decisions

**1. Overlap of titles, only when the owner is unknown.** `ownerOf` also takes `titles`, the titles of the scenarios of the change, and counts how many titles of the state's lines are among them. With no `change` recorded: zero overlap and at least one line is `{ ok: false, foreign: true, lines: n }`, an overlap of one or more stays `unknown`, and a state with no line stays `unknown` (there is nothing to compare). A state that records a change is decided by the name alone. *Alternative: require a percentage of overlap.* After a specification edit part of the lines legitimately change, and any threshold would be a guess; zero overlap is the one case that has no innocent explanation. *Alternative: compare the platform.* The state does not hold it for a device review, and the lines already tell reviews apart.

**2. `init` refuses a foreign state; unknown stays allowed.** A state that is `foreign` is refused as a known mismatch is, with the count of its lines that are not in the change, and the file is left as it is. An unknown state with shared lines is still overwritten: it is most likely the same review restarted, as a state of the same change is.

**3. `owner` reports it.** It exits 1 for `foreign` with `the state is of another review: N of its lines are not scenarios of <change>`, and keeps the message and the exit for `unknown`. Its output is what the skill shows the person; the skill removes nothing.

**4. `decide` receives the change.** `review-state.mjs decide <change-dir> [--adapter api | --target ios]` runs `ownerOf` with the same kind rules as `init` and `owner`, and prepends a reason when the state is of another change, another kind, or `foreign`; an `unknown` owner with shared lines passes, because the person resumed it knowingly. With no argument it decides as before, so nothing that calls it without the change breaks. This is the last line of defence: it holds even if the review skipped `owner`.

## Risks / Trade-offs

- [A legitimate older state whose lines were all renamed is called foreign] → it can only be a state from before 0.18.0, a finite population; the message says to remove the file when that review is over, and `sync` is the normal way to reconcile lines.
- [A state of another review that shares a title, such as a generic scenario name, is called unknown] → the person is asked, as today, and `decide` is the next check by kind and by lines.
- [`decide` called with the change by an older skill text] → the argument is optional.

## Migration Plan

None. A state written by 0.18.0 or later is decided by its name, as before. Rollback is reverting the commit.

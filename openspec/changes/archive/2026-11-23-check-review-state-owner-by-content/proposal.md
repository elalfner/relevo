# Proposal

## Why

`harden-api-review-audit` (0.18.0) made `init` refuse to overwrite the review state of another change, and added `review-state.mjs owner`. Both read the `change` field of the state, which only 0.18.0 writes. The `evidence/` folder is never committed, so a state written by an earlier version survives an update of the plugin, and for it `init` finds an unknown owner, overwrites it without a word, and `owner` only says "unknown". A review that started over the state of another issue, with other lines and another platform, was neither warned nor discarded. Nothing else compares the state with the issue: `sync`, `set`, `audit`, `agree` and `decide` act on whatever file is there, and `decide`, the gate before the pull request, does not even receive the change.

## What Changes

- **A state that records no change is compared by content.** The titles of its checklist lines are compared with the scenarios of the change. When none of them is a scenario of the change, the state belongs to another review: `init` refuses to overwrite it and `owner` exits 1, saying how many of its lines are not in the change. When some are, the owner stays unknown and the review asks the person, as today.
- **`decide` takes the change.** `review-state.mjs decide <change-dir> [--adapter api | --target ios]` refuses to open the pull request when the state is of another change or kind, or when none of its lines is a scenario of the change. Without the argument it behaves as before.
- **The review skill passes the change to `decide`.**

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the state of a review belongs to one change, and an older state with no recorded change is told apart by its lines.

## Impact

- Code: `scripts/lib/review-state.mjs` (`ownerOf`, `decidePr`), `scripts/review-state.mjs` (`init`, `owner`, `decide`); their tests.
- Documentation: `skills/review/SKILL.md`, `CHANGELOG.md`.
- Out of scope: a state that records the same change but whose lines no longer match (a rewritten specification: `sync` reconciles it), a state of the same change that `init` restarts on purpose, an `--adopt` option that stamps the change on an older state, and recording the platform name in the state.
- Breaks: `init` over an older state that shares no line with the change now refuses where it used to overwrite; the person removes the file when that review is over.

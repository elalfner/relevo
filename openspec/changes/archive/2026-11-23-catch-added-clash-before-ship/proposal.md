# Proposal

## Why

`openspec archive` refuses a change whose delta no longer agrees with the main specifications: an ADDED requirement whose header already exists (a sibling issue added it first), or a MODIFIED, REMOVED or RENAMED one whose header is gone. Today that is found at the last moment, when `ship` archives. In the repositories that use the label it stopped two issues four times in all; on one the person applied the label three times in 26 minutes and got the same error each time, and it took days to resolve. The branch had been reviewed and approved with a specification that could not be archived, and a repeated application cannot fix that: the delta has to change.

## What Changes

- **A check of the delta against the main specifications of the base branch.** For every capability the change touches, it compares the headers of the delta with those of the main specification on the current base branch, with the same rules `openspec archive` applies: an ADDED header must not exist, a MODIFIED, REMOVED or RENAMED-from header must exist, a RENAMED-to header must not. It reads only; it never rewrites the delta.
- **`review` runs it after it synchronises with the base branch.** That is when the base has moved, so it is where a sibling issue's merge shows up. A clash stops the review before the person tests: it names the capability, the header and the operation, says what the delta must become (an ADDED requirement that already exists is a MODIFIED one with its full text), and tells the person to run `/relevo:fix <issue>`, which updates the specification first. The issue stays `built`.
- **`ship` runs it before it archives, and says the same thing.** The check runs in the unattended run and in the local one, before anything is pushed. The comment names the header and says that applying the label again does not help until the specification is corrected.
- **The same check is available as a script.** It prints the clashes and exits non-zero, so the skills and the workflow share one rule instead of each reading the archive error.

Not in this change: rewriting the delta automatically (turning ADDED into MODIFIED needs the full text of the requirement and a decision of the person); running the check in `go` (the branch starts from the current base and the review runs it again before approval); checking the body of requirements, only their headers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: after the synchronisation, a delta that no longer agrees with the base's specifications stops the review with the clash and the way out.
- `ship`: the same check before the archive, in the local and the unattended ship, with a stop that says that applying the label again does not help.

## Impact

- New script `scripts/delta-check.mjs` with its library and tests; it reads the change folder of the branch and the main specifications at `origin/<base>`.
- `skills/review/SKILL.md` and `skills/ship/SKILL.md` and their tests; `scripts/lib/ship-unattended.mjs` and its tests; `scripts/lib/messages.mjs` (a new stop, English and Spanish).
- `templates/workflows/relevo-ship.yml`: the list of scripts the job requires from the package gains the new one.
- `docs/` pages of review and ship, English and Spanish.

# Proposal

## Why

The `Daily digest` requirement of `status` says that a digest is posted "to a configured channel once per working day", and does not say what that channel is or which days are working days. Both are decided only by `scripts/digest.mjs` and the template: the channel is a comment on the issue named by `digest.issue`, and Saturday and Sunday (UTC) are not working days. Nothing in the specifications states either, so a change to the script could alter where the digest goes or on which days it is posted with no requirement to stop it. `digest.issue` is not in the specifications at all.

## What Changes

- **The destination is stated.** The digest is posted as one comment on the issue whose number is `digest.issue`. A digest that has text but no `digest.issue` to go to stops the run with an error that names the key, instead of being lost; a dry run or a run from an input file prints the text and posts nothing.
- **The days are stated.** No digest is posted on a Saturday or a Sunday, counted in UTC, whatever is waiting, and the answer does not depend on the calendar when an input file is read.

Not in this change: any change to the script, the template or the content of the digest. The behaviour already exists; this change records it. The weekend rule has a test (`tests/status.test.mjs`); posting to `digest.issue` and the error when it is not set have none, because they need a real `gh` and the input-file mode never posts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status`: two requirements about the digest, where it is posted and on which days.

## Impact

- Specification only: `openspec/specs/status/spec.md` after the archive. No code, template or documentation changes.

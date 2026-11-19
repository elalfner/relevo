# Proposal

## Why

A real run in `relevo-sandbox` (verification of #118, reported on #167) showed that an issue stopped by a usage limit does not return to the queue. The final step of the `go` workflow runs `gh issue edit … --remove-label relevo:queued … --add-label relevo:queued` in one command. GitHub applies the removal after the addition, so the issue ends with no state label at all. The comment says "back in the queue", but no queue pass can find the issue and the retry never happens. The tests of #118 did not see it because their `gh` only records the arguments.

## What Changes

- The final step of `templates/workflows/relevo-go.yml` leaves the issue with exactly one state label, `queued`, when a usage-limit retry is decided, whichever label it had before and whichever way a person renamed the labels.
- No `gh issue edit` of the templates adds a label and removes the same label in one command (checked by a test over the templates).
- The test of the final step runs against a `gh` that applies label edits the way GitHub does (additions first, then removals), and asserts the labels the issue ends with.
- Out of scope: the wording of the `kept` comment ("build from the start" while the run resumes from the checkpoint), and the other findings of #167.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `usage-limit-retry`: the issue that a usage limit returns to the queue ends labelled `queued` and nothing else of the lifecycle.

## Impact

- `templates/workflows/relevo-go.yml` (one step) and the tests `tests/workflow-limit-retry.test.mjs` plus one new test over the templates.
- Installed `go` workflows keep the defect until they are updated to this template. The version in `plugin.json` is not bumped here; the release notes go in the `CHANGELOG.md` entry under Unreleased.
- No guard changes (the protected paths, the credential scan and the budget guard are untouched) and no action is added or re-pinned.

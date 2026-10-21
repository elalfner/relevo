# Proposal

## Why

When QA rejects a cloud build, everything the developer wrote is lost. The failure path pushes the branch, but the code only exists in the working tree of the runner, which is discarded when the run ends: the branch holds the specification commit alone. In the first build of the sandbox (#37) the developer had done the work and QA only could not run the tests (no SDK); the person was told to run `/relevo:fix 37` and found nothing to correct. The only way out was to delete the branch and pay for the whole run again. The work that was done is worth keeping, and the person should decide what to do with it: correct it with `fix`, or rethink the issue.

## What Changes

- When the failure path is reached because QA rejected the work after the retries, or because tasks were left unfinished, `go` commits the work in progress to the issue's branch before it pushes. The commit goes through the same script as a successful build, so protected paths, files outside the platform, temporary markers and credentials stop it exactly as they do today; when the script refuses, nothing is pushed and the comment says so, as now.
- The commit message says the work is not approved: `wip: rejected by QA (#<n>)`. The issue stays `qa-failed`, no pull request is opened and the state does not advance.
- The failure comment gets a new branch state, `kept`: the branch holds the work that QA rejected, and it says it is not approved, what QA found, and the two ways forward. `/relevo:fix <n>` verifies and corrects it, and `/relevo:think` followed by `/relevo:issue <n>` rethinks the issue.
- `fix` recognises a branch whose last commit is that work-in-progress commit: it takes the finding from the last failure comment of the issue as the defect to correct, so the person does not have to describe it again, and says what QA could not check.
- Documentation of the failure comment and of the guide, English and Spanish, and tests.
- Out of scope: a check of the toolchain before the run spends turns, and any change to what `ship` or `review` accept: a `qa-failed` issue still cannot be reviewed or shipped.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: the failure path keeps the work that QA rejected, through the safe commit.
- `fix`: a branch with kept work is corrected from the finding in the failure comment.

## Impact

- `skills/go/SKILL.md` (failure path), `scripts/lib/messages.mjs` (the `kept` state, English and Spanish), `skills/fix/SKILL.md`, a small script to find the finding in the last failure comment, the tests of the skills and messages, the guide and commands pages in both languages, the changelog.
- A branch pushed after a rejection now contains code that was not approved. The label stays `qa-failed`, the message says it, and nothing in the pull-request flow can pick it up.

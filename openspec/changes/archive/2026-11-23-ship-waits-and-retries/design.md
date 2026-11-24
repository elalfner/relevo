# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- `runUnattendedShip` (`scripts/lib/ship-unattended.mjs`) reads the pull request through `check()`, which already waits for the pushed head to show up and for GitHub to compute mergeability (9 tries of 10 s). It then asks `shipDecision` (`scripts/lib/ship.mjs`); any reason stops the run, and a stop removes the label and comments.
- The reason "checks are still running" comes from `checks.state === 'pending'` in `ship.mjs`. It is a stop like any other, so the run ends in seconds with the label removed.
- The only wait for checks happens after the archive push, and only with the App (`hasApp`): a loop bounded by `waitLimitMs` (30 min) that polls every `pollMs` (20 s). The workflow's `timeout-minutes` is 45.
- The merge is `gh pr merge --squash --match-head-commit`. Any failure becomes the reason `GitHub refused the merge: <message>`.
- The local skill (`skills/ship/SKILL.md`) stops on the same reasons and already says to try again about 10 seconds later, up to 6 times, for the not-yet-computed mergeability.

## Goals / Non-Goals

**Goals:**
- A label applied while the only obstacle is time (checks running, the base moved a second ago) ends in a merge without a second application.
- The run still ends inside the workflow's limit, and never holds the runner without bound.

**Non-Goals:**
- Reacting to the events of a check to resume a stopped run. A stop keeps removing the label; there is no new workflow and no new permission.
- Changing what qualifies a pull request: conflicts, approvals, failing checks and the archive stay stops.
- Retrying a merge more than once.

## Decisions

- **Wait inside the run, in `check()`.** When `decision.allowed` is false and the only reason is the pending checks (`checks.state === 'pending'` and nothing else), `check()` sleeps `pollMs`, reloads the pull request and decides again, until the checks finish or the shared deadline passes. It reuses the loop shape that already exists after the archive. Alternative considered: keep the label and resume from a `workflow_run`/`check_suite` event; rejected for now because it is a second workflow with its own state (a stop today removes the label, which is what tells the person nothing is running), and the wait inside the run costs a runner for minutes, not hours. It can be revisited if waits routinely approach the limit.
- **One deadline for the whole run.** `runUnattendedShip` computes `deadline = start + waitLimitMs` once. The wait for pending checks, the wait after the archive and the retry of the merge all compare against it. The mergeability wait (90 s) stays as it is and counts against the same deadline. With `waitLimitMs` at 30 minutes and the work around it (checkout, install, archive, merge) under a few minutes, the 45 minute `timeout-minutes` still holds, so the template needs no new limit. Alternative considered: a separate limit for each wait; rejected because it can add up past the workflow's timeout, which would end the run with no comment (the final step would remove the label, but with the less helpful message).
- **Wait only when the pending checks are the only reason.** Waiting for checks of a pull request that also lacks an approval or has a conflict would hold the runner for something the person has to fix anyway. The condition is read from the decision's reasons, not from the text of a message.
- **Retry the merge once, after deciding again.** On a refusal whose message says that the base branch was modified, the run calls `check(baseline)` again (the head has not moved; the base has), applies the same label rules, and merges. A conflict or a new reason stops with that reason. A second refusal stops with GitHub's message. The match is on the message GitHub gives (`Base branch was modified`); any other refusal stays a stop as today. Alternative considered: retry any refusal; rejected because a refusal for protection rules or permissions does not change on a second try and the run would only hide it.
- **The comment says whether applying the label again helps.** The reasons that are only time (`checks` that did not finish within the limit, mergeability that never settled, merge refused twice) carry a line "applying the label again retries"; the reasons that need action keep what they say today. The kinds and the texts are in `messages.mjs` in both languages, and the tests that read them are updated with them.
- **The local skill gets the same two behaviours in its own words.** Step 1 waits with `gh pr checks <number> --repo <owner/name> --watch --fail-fast` for a bounded time when the only reason is pending checks, and step 5 tries the merge once more when GitHub says the base branch was modified, after running `ship-check.mjs` again. The person already confirmed in writing; nothing is archived or merged that the confirmation did not cover, because the checks and the decision are the same ones the confirmation was given on.

## Risks / Trade-offs

- [The run holds a runner while it waits, on a self-hosted runner shared with other jobs] → the wait is bounded by the shared deadline, and `concurrency` keeps one run per issue.
- [Checks pass on the approved head but a second push by someone else lands while waiting] → `check()` already stops with "the branch moved while shipping" when the head changes, and the approval is judged again on the new head.
- [A wait of up to 30 minutes with no message on the issue looks like nothing happens] → the label stays on the issue, which is the sign that a run is in progress; no comment is posted for a wait that ends in a merge.
- [Repositories keep the workflow copy of an older version] → they get the behaviour when they raise `RELEVO_VERSION`; `/relevo:init` already reports an older template as different.

## Migration Plan

Nothing to migrate. After the release, each repository raises `RELEVO_VERSION` in `relevo-ship.yml`. Rolling back is raising it back to the previous version.

## Open Questions

- The interval between looks at the checks (`pollMs`, 20 s today) and the limit (30 min) are the existing values; whether the first wait should use shorter polling is a tuning that does not change the specification.

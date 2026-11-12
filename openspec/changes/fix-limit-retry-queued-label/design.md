# Design

## Context

The `no_outcome` step of `relevo-go.yml` returns the issue to the queue with one command: it removes `ready`, `queued` and `building` and adds `queued`. In the real run of the sandbox, the bot's events for issue #116 were `labeled queued` at 06:37:45 and `unlabeled queued` one second later, so the removal won. See proposal.md for the reason.

## Goals / Non-Goals

**Goals:**
- The retry path ends with `queued`, checked against a model of how GitHub applies a label edit.
- A guard that keeps the pattern from coming back in any template.

**Non-Goals:**
- Changing the retry decision (`limit-retry.mjs`), the comment, the bound or the queue.
- The text of the `kept` comment.

## Decisions

- **One command that never names `queued` to remove it.** The retry path removes `ready` and `building` and adds `queued`. An issue that already has `queued` keeps it (the addition is a no-op); one that has not gets it. Alternative: two commands (remove, then add). It works too, but it is two calls and leaves a moment with no state label. Chosen: the single command.
- **The fake `gh` models GitHub.** It applies `--add-label` first and `--remove-label` after, per command, on a label set that starts from the labels of the scenario. The scenarios assert the final set. This test fails on the current template (the final set is empty) and passes with the fix.
- **A test over the templates.** For every `gh issue edit` line in `templates/workflows/*.yml`, the set of added labels and the set of removed labels do not intersect.
- The other exits (`qa-failed`, `needs-spec`) already add a label they do not remove, so they keep their commands.

## Risks / Trade-offs

- Whether GitHub orders the two operations the same way for every client is not documented; the evidence is one real run. The fix does not depend on the order, because no command both adds and removes `queued`.
- Workflows that people copied earlier keep the defect until updated; the changelog says so.

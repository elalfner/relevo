---
name: status
description: Shows who is waiting on what in this repository. For the person asking, it lists the issues waiting on them with the command to run, the pull requests they must review and the ones approved for them to ship; for the spec writer it puts returned and blocked specs first. It also summarises the milestone, warns when the queued work exceeds what the team can review before the due date, and alerts on overdue reviews and stale branches. Read-only: it never changes an issue, label or branch.
argument-hint: ""
---

# Relevo status

Show the state of the work. This command only reads; it never changes anything.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the rules (what counts as waiting, the capacity arithmetic, the alert thresholds); use them instead of working those out yourself.

## What you must never do

- Never run `gh issue edit`, `gh issue comment`, `gh pr edit`, `gh label` or anything else that writes. Only the script below runs, and it only reads.
- Never invent a due date, a capacity or an age. Show what the script prints.

## Steps

1. Preflight: `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` must exit 0. If not, show its output and stop. `gh auth status` must succeed; if not, tell the person to sign in.
2. Find the repository (`$GITHUB_REPOSITORY`, or `gh repo view --json nameWithOwner -q .nameWithOwner`).
3. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs --repo <owner/name>`. It identifies the person from their GitHub login.
4. Show the output as it is. If the person asks for more detail, run it again with `--json` and answer from that.

## Report

The output has, in this order: what the spec writer must act on (only for the spec writer), what is waiting on the person (with the command), pull requests to review, approved pull requests to ship, what waits on others, a milestone summary with a capacity warning when the work exceeds what can be reviewed before the due date (or a note that the milestone has no due date), and alerts for reviews past `limits.review_sla_hours` and branches far behind the base branch.

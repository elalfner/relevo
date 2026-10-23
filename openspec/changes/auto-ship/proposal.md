# Proposal

## Why

To ship an approved pull request today, someone has to clone the repository, check out the branch and run `/relevo:ship` in an agent session with an authenticated GitHub command line. A Claude web session has no authenticated `gh`, so it cannot ship, and a person on a phone cannot ship at all. Almost every step of `ship` is already a script (`ship-check`, `scan-diff`, `openspec archive`, `check-archive`, `gh pr merge`, `label-change`); the agent only asks for the confirmation and relays results. A workflow can run those steps without a model, on GitHub, started by one label.

## What Changes

- A new label, `relevo:ship`, is a request to ship. It is added next to `pr-open`, never replaces it, and the run always removes it.
- A new workflow template, `relevo-ship.yml`, runs when an eligible person applies that label to the issue. It runs no model and needs no model credential. It applies the same rules as `/relevo:ship`: the person who applied the label is the one `ship-check` judges, the label is their written confirmation, and every other check (approval on the current code, checks, conflicts, scan, validation, open tasks, archive scope) stays the same. When something stops it, it comments the reasons on the issue, mentions that person and removes the label.
- **The checks of the approved head carry over to the archive commit.** A push with the workflow token starts no workflows, so the archive commit would have no checks and `ship-check` would report "no CI". `ship-check` now uses the checks of the head recorded before the archive when the only difference is the archive (every changed file is under `openspec/`) and the new head has no checks of its own. This also applies to `/relevo:ship`.
- **A GitHub App for repositories that require checks.** When the base branch requires status checks, GitHub would refuse the merge of an archive commit without them. Such a repository stores a GitHub App's id and private key as secrets; the workflow then pushes, merges and closes with the App's token, so the project's CI runs on the archive commit, and the workflow waits for it.
- With no checks on any commit, the workflow stops and comments, unless `relevo.yml` sets `review.ship_without_ci: true`. The interactive command still asks the person, as today.
- Only the person who ships under `review.merger` may use the label: the approver (with `approver`) or the author (with `author`). An eligible person who did not approve keeps using `/relevo:ship`, which asks them to confirm that.
- The repository variable `RELEVO_CLOUD_SHIP` set to `off` pauses the workflow without a file change, as `RELEVO_CLOUD_GO` does for builds.
- `init` creates the label and installs the workflow. `doctor` checks the workflow on the default branch, that the base branch does not require approval of the last push, and that a repository that requires checks has the App secrets.
- The approval message names both ways to ship: apply `relevo:ship`, or run `/relevo:ship <n>`.
- Out of scope: shipping automatically on approval, merge queues, releases (still a separate pull request), and running the project's CI from Relevo.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ship`: a label starts an unattended ship that follows the same rules; the checks of the approved head count for the archive commit; how a run without checks ends in each mode.
- `issue-lifecycle`: the `ship` overlay label, and the approval message names it.
- `security`: the automation may merge only after a person's explicit act (the label), never the agent; the configuration that judges eligibility comes from the base branch.
- `configuration`: `review.ship_without_ci`.
- `init-doctor`: init creates the label and installs the workflow; doctor checks the workflow, the last-push approval setting, and the App secrets when checks are required.
- `execution-modes`: `RELEVO_CLOUD_SHIP` pauses the ship workflow.

## Impact

- New `templates/workflows/relevo-ship.yml`; changes to `scripts/lib/ship.mjs` and `scripts/ship-check.mjs` (checks carried over, label path), `scripts/lib/labels.mjs`, `scripts/lib/config.mjs`, `scripts/lib/messages.mjs`, `scripts/lib/review-events.mjs`, `scripts/lib/init.mjs`, `scripts/lib/doctor.mjs`, `skills/ship/SKILL.md`, and their tests.
- Docs in English and Spanish: commands, configuration, execution, security; the changelog.
- The workflow runs from the repository's default branch, so a project gets it only after it reaches that branch.
- A repository that requires status checks must create a GitHub App and store two secrets before the label works. Without them, the run stops at once and says so.

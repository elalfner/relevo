# Design

## Context

The `build` job closes the progress comment with two steps of its own, `Stop the progress report` and `Close the progress comment`, both `if: always()`. They run on the machine that ran the build. When that machine stops answering GitHub, GitHub ends the job as failed and none of them runs. See proposal.md for why that matters.

The `requeue` job already exists for a neighbouring case: it needs `decide` and `build`, runs with `if: always()`, has no checkout and installs nothing, and its first step closes a progress comment that still says the build waits for a runner (a build that no runner took). That step is plain shell over `gh api`: it finds the comment by its markers, reads the language from `relevo.yml` and patches the comment with the closing markers. `tests/workflow-go.test.mjs` runs that step against a fake `gh` (`runUnstarted`).

`progress.mjs close` cannot be reused there as it is: without `RELEVO_PROGRESS_DIR` every command does nothing, and the minutes of the run live in the state file of the build runner.

## Goals / Non-Goals

**Goals:**
- The comment is closed by something that does not depend on the runner of the build, for any build that ends as failed or cancelled.
- The closing is safe whatever else already wrote: a comment closed by the build job is left alone.

**Non-Goals:**
- Finding why the runner was lost, retrying the build, or changing the label of the issue. The issue stays `building`; the alert of `status` for a build with no activity already covers it.
- Showing the minutes of the run in the closing line. They are in the state file that was lost; the run page has them.
- Any change to what the progress text says while the build runs.

## Decisions

**1. A step in `requeue`, not a new job.** `requeue` already has the permissions (`issues: write`), the condition (`always()` once `build` was not skipped) and the same need. A new job would repeat all three and take another runner. Alternative: a job of its own with `needs: build`. Rejected for the cost of a second runner slot for a line of shell.

**2. Plain shell over `gh api`, like the step above it.** No checkout and no scripts are installed in `requeue`, and fetching the package for one patch would add a failure point to the job that frees the queue. The line is written in the workflow in English and Spanish and the language is read from `relevo.yml`, exactly as the neighbouring step does. Alternative: add a message to `messages.mjs` and call `progress.mjs`. Rejected: it needs the package, and the minutes are not available anyway.

**3. It acts on `failure` and `cancelled`, and on any open progress comment.** The step runs after `Return a build that no runner took to the queue` and before `Start the queue`. The earlier step handles `cancelled` with a waiting marker; this one then finds that comment closed. A build that ended in `failure` with the comment still saying it waits (the runner was lost before the first step of the build) is closed by this step with the new line. A `success` is skipped, as is a `build` that was skipped.

**4. The closing markers are the lock.** The step selects comments from the bot with the progress marker and without the closed marker, takes the last, and patches it with the line, the progress marker and the closed marker. A runner that comes back and still has its check running finds the comment closed before it writes (`writeProgress` reads it each time), so the order of the two closings does not matter.

**5. The line says what is known.** "The Relevo build ended without an outcome: its runner stopped answering." plus the link to the run. It does not claim a cause and does not say what to do; the person gets the way forward from `status` and from the labels.

## Risks / Trade-offs

- **`requeue` may need the same runner that was lost** (a repository whose jobs all run on one self-hosted machine) → the step runs when a runner takes `requeue`, as the existing step does; the comment is then closed late, not never. `runner.labels` lets a repository give `requeue` a GitHub-hosted runner.
- **The line is generic** (no minutes, no group) → the run page has them; the line links to it.
- **A cancel by a person where the build job could close its own comment** → the step finds it closed and writes nothing.

## Open Questions

- Whether the issue should also move out of `building` when its runner was lost. It changes the lifecycle of the issue, so it would be its own change.

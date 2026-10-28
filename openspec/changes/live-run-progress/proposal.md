# Proposal

## Why

While a cloud build runs, nobody can see how far it is. The issue carries only the `relevo:building` label and the job shows "in progress"; the only comments arrive when the run ends. The team cannot tell which phase the build is in, how many tasks are done, or whether the run is alive or stuck, so a stuck run looks the same as a slow one until the job times out.

## What Changes

- A cloud build keeps one progress comment on the issue, found by a hidden marker and edited in place. It shows the current state only: the phase (planning, specification, development, QA with its attempt number, delivery), the tasks done out of the total (from `tasks.md`) and how long the run has lasted, in whole minutes.
- The `go` skill announces the phase when it enters each step, into a file outside the working tree so that it never reaches the diff. When nothing was announced, the phase is deduced from what exists in the working tree.
- The workflow, not the agent, signals that the run is alive: every 30 seconds it reads the announced phase and the tasks done and edits the comment only when the text it would show has changed. A run that stops advancing is visible because its time keeps growing while its tasks and phase do not.
- When the run ends, the progress comment is replaced by a one-line pointer to the result, so it never stays behind as noise. One progress comment per run, never one per step.
- Out of scope: an estimate of the time left (needs the history of past runs, which another change adds), the aggregate usage in the digest, and the time spent in each stage.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: a cloud build publishes its progress in one edited comment, announces the phase of each step, checks every 30 seconds without depending on the agent, and closes the comment when the run ends.

## Impact

- `templates/workflows/relevo-go.yml`: the check that runs beside the agent and the closing step of the build job.
- A new script and library under `scripts/` that announce the phase and render and edit the progress comment, reusing the hidden-marker convention of `scripts/lib/sla.mjs`.
- `skills/go/SKILL.md`: an announcement of the phase at the start of each step.
- `docs/execution.md` (and its Spanish version): how to read the progress comment.
- No new service and nothing leaves the repository, in line with "No telemetry from Relevo's tooling".

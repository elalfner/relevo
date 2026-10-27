# Proposal

## Why

Today every `ready` issue waits its turn: it is started in first-in-first-out order, and an assignee who already has `limits.built_unreviewed_per_person` issues in `built` sees every new issue `queued` until they start a review. There is no way to say "this one cannot wait". `/relevo:go <n>` does not help, because it applies the same gates. A person who needs an urgent fix has to review something else first or change `relevo.yml`.

## What Changes

- New label `relevo:urgent` (key `urgent`, renamable in `labels` like the others). It is an overlay: it is added next to the current state and never replaces it.
- An issue with a valid `urgent` label is evaluated before every non-urgent one. Among urgent issues the order is still the time `ready` was applied.
- An issue with a valid `urgent` label skips gate 3 (the assignee's review capacity). It still passes every other gate: permission, milestone, assignee, spec, dependencies and the global limit `limits.concurrent_agents`. When no agent slot is free it stays `queued`, first in line.
- The label is valid only when the person who applied it has the permission that `ready` requires: write or maintain, and maintain only when `trust` is `public`. Otherwise `urgent` is removed and one comment says why; the issue is then evaluated as a normal one.
- The comment that tells the assignee a build is ready says when the build started by skipping the capacity gate, so the extra pending reviews have an explanation.
- The notice of a `blocked` issue says that `urgent` does not skip dependencies.
- `/relevo:init` creates the label and `/relevo:doctor` checks it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: "Gate 3, capacity" and "Queue order" gain the urgent exception and its permission rule.
- `issue-lifecycle`: a new requirement describes the `urgent` label as an overlay, next to the existing `ship` label, and the hand-off message states an urgent start.
- `init-doctor`: `init` creates the `urgent` label and `doctor` checks that it exists.

## Impact

- Code: `scripts/lib/labels.mjs`, `scripts/lib/github.mjs` (who applied the label, and their permission), `scripts/lib/plan.mjs` (order and gate 3), `scripts/lib/messages.mjs` (the denied notice and the urgent note in `built`, in English and Spanish), `scripts/lib/doctor.mjs` and `scripts/lib/init.mjs`.
- Workflows: none. `relevo-queue.yml` already reacts to `labeled`, so adding `urgent` to a `queued` issue re-evaluates the queue at once. `relevo-go.yml` is still started only by `relevo:ready`.
- Docs: `docs/` pages that list the labels, in English and Spanish, and `CHANGELOG.md`.
- Release: the version in `.claude-plugin/plugin.json` and the pinned `RELEVO_VERSION` in the workflow templates follow the release process, outside this change.
- No change to `relevo.yml` keys beyond the optional `labels.urgent` override. Nothing is breaking: an issue without the label behaves as before.

# Design

## Context

See proposal.md - Why. The gates live in one pure function, `planGo` (`scripts/lib/plan.mjs`): it sorts the candidate issues by `ready_at`, applies the gates in order and returns one decision per issue. `gather()` (`scripts/lib/github.mjs`) builds its input from GitHub: the `ready_at` and `ready_by` of each candidate come from the issue timeline, and `permissions` holds the repository permission of each `ready_by`. The `ship` label is the existing precedent for a label that is a request next to the state (`kind: 'overlay'`). `relevo-queue.yml` already runs on `labeled`, `unlabeled` and `closed`, and acts only on `queued` and `blocked` issues.

Two places treat every label as a state and need care for a new overlay: `canEditIssue` closes an issue to editing for any label but `needs-spec`, and the `next-step` test requires an entry for every label key.

## Goals / Non-Goals

**Goals:**
- An urgent issue is evaluated first and skips only gate 3, with the permission rule of `ready`.
- The decision stays in `planGo`, a pure function, so it is tested with data and not with GitHub.
- The workflows do not change.

**Non-Goals:**
- No priority levels, no `urgent` for the global limit, and no change to `relevo.yml` beyond the optional `labels.urgent` name.
- No new command: `/relevo:go <n>` keeps applying the same gates, which now include the label.
- `status` and the digest do not get a new section for urgent issues.

## Decisions

**D1. `urgent` is an overlay label, like `ship`.** It is added to `LABELS` with `kind: 'overlay'`. `transition()` only adds overlays and never removes the state, `fix.mjs` already ignores overlays when it looks for the state, and `init` and `doctor` create and check every entry of `LABELS` without a change. A state label would force an issue to lose `queued` or `ready` to be urgent. *Alternative*: a field in the issue body (`Priority: urgent`). Rejected: editing the body is closed once the issue is `ready`, and the queue could not react to it.

**D2. Who applied it is read from the timeline, as for `ready`.** `readyEvent` is generalised to take the label name, and `gather()` fills `urgent_by` on every candidate that carries the label. The permission lookup that exists for `ready_by` also covers `urgent_by`. The last `labeled` event wins, so an authorised person can apply it again after a denial removed it. A bot gets `none` from the permission lookup, so its label is not valid without a special case.

**D3. Validity is computed once and used twice.** `planGo` computes `urgent = has(urgent) && permission of urgent_by allowed` for each candidate before sorting, with the same sets `MAY_TRIGGER` and `MAY_TRIGGER_PUBLIC` as `ready`. The sort key becomes (not urgent, `ready_at`, number). The free agent slots are handed out in that order, so an urgent issue takes the next free slot before any older non-urgent one.

**D4. Gate 3 is skipped, nothing else is.** The capacity branch gains `&& !urgent`. The branch for the global limit stays as it is, so an urgent issue with no free slot is `queued` with the existing reason and stays first in line. Gates 1 and 2 come before gate 3 in the code and are untouched, so `needs-spec` and `blocked` still win.

**D5. A label that is not valid is removed in the decision of the issue.** The decision's `labels.remove` gains the `urgent` name and the issue is evaluated as a normal one. A decision carries one comment, and an issue may also need its `queued` or `blocked` notice, so the decision gets an optional second notice (`notice`) that `commandsFor` renders after `comment`. The denial message names who applied the label and, when `trust` is `public`, says that a maintainer is needed. No comment is posted for an issue whose decision is `skip` (an agent is already running): the label is left alone there.

**D6. The start decision says when the gate was skipped.** `start` gains `urgent: true` and `built_waiting` (the assignee's `built` count plus this issue) only when the issue had reached or passed the limit, so the hand-off message says it only when it explains something. The `go` skill passes both to `render-message.mjs built`, which adds one line when they are present. The decision travels to the build job as the existing base64 JSON, so no workflow input changes.

**D7. `urgent` does not close the issue to editing, and has a next-step entry.** `urgent` is added to `EDITABLE_LABELS` in `can-edit-issue.mjs`, with a reason for completeness. Without it, a `needs-spec` issue that carries `urgent` could not be corrected, which would stop the only way out of that state. `next-step.mjs` gets an entry for `urgent` with no command and nobody to act, as for `ship`: the state it is in decides the next step, and the entry keeps the test that every label has one.

**D8. The blocked notice mentions `urgent`.** The `blocked_notice` message takes an optional `urgent` flag and adds one sentence. It is set only when the issue carries a valid `urgent` label.

## Risks / Trade-offs

- [An urgent issue raises an assignee's `built` count above the limit and the next normal issue waits longer] → That is the point of the label. The hand-off message states the count (D6), and normal issues start again when the count drops below the limit.
- [A person with write access can skip the capacity gate on every issue] → The permission is the one that already starts builds with `ready`; the cost limit `concurrent_agents` is not skipped; the label is visible in the issue and in the hand-off message.
- [More API reads: one timeline per urgent candidate and one permission lookup per distinct applier] → The timeline of a candidate is already read for `ready`; `gather()` reuses that response for both labels, and the lookups are cached per login.
- [Evaluation order changes for urgent issues, so a test that assumes strict FIFO may break] → The existing scenarios have no urgent label and are unchanged; the new ones are added to `tests/plan.test.mjs`.
- [A repository with the old label set has no `urgent` label, and GitHub creates one without colour or description when it is first applied] → `doctor` reports the missing label and says `init` creates it.

## Migration Plan

Ship in a release with the usual steps (`CHANGELOG.md`, version in `.claude-plugin/plugin.json`, then the pinned `RELEVO_VERSION` of the workflow templates). A repository adopts it by running `/relevo:init` or creating the label, and by updating `RELEVO_VERSION` in its workflows; until it does, an applied `urgent` label does nothing. Rolling back means removing the label from the code; labels left in issues are inert.

## Assumptions

- The permission needed for `urgent` is exactly the one needed for `ready`, as decided in the exploration; there is no separate setting for it.
- An `urgent` label applied together with `ready` or before it is evaluated by the same rules; only the `ready` label starts the `go` workflow.
- The label is removed and explained when invalid, rather than ignored, as decided in the exploration.

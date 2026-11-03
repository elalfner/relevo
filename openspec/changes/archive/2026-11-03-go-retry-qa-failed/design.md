## Context

`gather` (`scripts/lib/github.mjs`) reads issues by the labels `ready`, `queued`, `blocked`, `building` and `built`, never `qa-failed`. `planGo` (`scripts/lib/plan.mjs`) takes as candidates only `ready`, `queued` and `blocked` issues, and the permission, milestone, assignee and specification gates run inside `if (has(issue, 'ready'))` using `issue.ready_by`. `moveTo(issue, 'building')` already removes `qa-failed`, an exclusive label. The cloud starts only on the `relevo:ready` label event (`templates/workflows/relevo-go.yml`).

## Goals / Non-Goals

**Goals:** rebuild a branchless `qa-failed` issue on a machine, with the gates of a normal start, without the cloud taking it and without `RELEVO_CLOUD_GO=off`.
**Non-Goals:** the scanner, saving unpushed work, `needs-spec` and `blocked` retries.

## Decisions

- **Retry is a stand-in for `ready`.** `planGo` receives `retry: { issue, by }`. The issue is a candidate and takes the `ready` branch of the gates when it is `qa-failed` and is the retried one; `ready_by` is `by`. Every existing gate and the `start` decision are reused, so the retry cannot be looser than a normal start.
- **`gather` reads `qa-failed` only when retrying**, for the retried issue, and reads the permission of `by`. Without `--retry` nothing changes.
- **Who runs it:** `go-plan.mjs` takes the login from `gh api user`. Alternatives (a `--by` argument, or the assignee) were discarded because they can be set to someone else.
- **Branch check in the script, not in the pure planner:** `go-plan.mjs` runs `git ls-remote --heads origin "refs/heads/feature/<n>-*"` and refuses with exit 2 and a message when something is listed. The state check (`qa-failed`) is in `planGo`, which returns a `skip` decision with the reason.
- **No claim comment.** The usual `built` or `qa_failed` comment reports the result. A denied retry reuses the existing `ready_denied` comments; their wording mentions the `ready` label, which is imprecise for a retry and is accepted for now.
- **Flag plumbing:** `go-local.mjs` passes `--retry` into the prompt (`/relevo:go <n> --retry`) for both runners; step 1 of the skill adds `--retry` to the `go-plan.mjs` call; the cloud-warning in `lib/go-local.mjs` is skipped for a retry. The workflow template is unchanged: it never retries.

## Risks / Trade-offs

- A race with a person labelling `ready` at the same moment: the claim is not atomic, as today.
- A retry of a scanner false positive fails again: the person must resolve the cause first, which the `rebuild` hint already says.
- Capacity and agent limits apply, so a retry can end in `queue` and moves the issue to `queued` (removing `qa-failed`); this is the normal behaviour of the queue.

## Assumptions

- Whoever runs `go-local.mjs` is the authenticated `gh` user, and that user's repository permission is the right gate.
- A `feature/<n>-*` branch is detected by name prefix, as `/relevo:fix` does.

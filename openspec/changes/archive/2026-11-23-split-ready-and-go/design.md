# Design

## Context

See `proposal.md` for the motivation and `docs/adr/0001-approval-and-build-request-are-separate-labels.md` for the decision and the alternatives. This design is written on top of `rename-qa-failed-label`: the label of a failed build is `build-failed` here. What the code has today:

- **One planner for both places.** `planGo` (`scripts/lib/plan.mjs`) decides for every candidate; `go-plan.mjs` runs it in the `decide` job of the workflow and in the skill of a build started by hand, and `requeue.mjs` runs it for the queue. Candidates are the issues labelled `ready`, `queued` or `blocked`, plus the retried `build-failed` issue.
- **The label event carries the authorisation.** `gather` (`scripts/lib/github.mjs`) reads the REST timeline of each candidate and takes who applied `ready` and when (`ready_by`, `ready_at`); the planner checks that person's permission. The same timeline already gives `urgent_by`.
- **The trigger is in the workflow file.** `relevo-go.yml` starts on `issues: labeled` with `github.event.label.name == 'relevo:ready'`, and its failure steps remove `relevo:ready` by name. `relevo-queue.yml` runs on `closed`, `labeled`, `unlabeled`, every 30 minutes and by hand, and `ownedByQueue` keeps it off an issue that was just labelled `ready`.
- **The limit counts labels.** `runningSet` is every open issue labelled `building`; no workflow passes `--running`. A build on a machine takes a slot.
- **Overlay labels are only added.** `transition` swaps the exclusive labels and never removes an overlay (`needs-reviewer`, `ship`, `urgent`).
- **The text is checked from the claim on.** The planner puts a hash of the title and body in the `start` decision and `go` verifies it before the specification. Nothing looks at edits made before the claim.
- **A remote session is known by `CLAUDE_CODE_REMOTE`** (`isRemote` in `scripts/lib/gh-web.mjs`); it cannot use GitHub's GraphQL API.

## Goals / Non-Goals

**Goals:**
- One planner still decides everything; the place of the build is an input to it, not a second code path.
- The approval is checked with what GitHub itself records, with no state of Relevo to keep in step.
- Nothing a local build does can make the cloud build an issue later.
- A repository that upgraded only half of the way is told so by `doctor`.

**Non-Goals:**
- Showing the progress of a local build (`go-visibility`), or giving builds their own runners (`build-runner-labels`).
- A heartbeat for local builds, or restarting a dead one automatically.
- Restricting `ready` to `team.spec_writer`.
- Keeping the former meaning of `ready` behind a setting.

## Decisions

- **D1. Two new labels in the label set, with new kinds.** `go` is added to `LABELS` as a request (kind `overlay`, like `ship`), `local` as a mark (kind `overlay`). Both are renamable in `labels`, created by `init` and reported by `doctor` when missing, through the code that already does it for every entry.
- **D2. The planner gets the place of the build.** `planGo` takes `place: 'cloud' | 'local'` and, for `local`, the login of the person who runs it. In `cloud`, a `ready` issue is a candidate only with a `go` label, and its authorisation is the pair `ready_by` and `go_by`. In `local`, a `ready` or `queued` issue named with `--only` is a candidate with no `go` label, and the pair is `ready_by` and the person. `go-plan.mjs` passes `--place`; the workflow passes `cloud`, the skill passes `local` unless it was given `--decision`. Alternative considered: a separate local planner; rejected because every gate would exist twice.
- **D3. Gates by place.** With `place: local` the planner skips the capacity gate and the limit of agents, and turns a collision of shared files into the `shared_files` of the `start` decision, the same field that a wait that ended by its bound fills today, so the hand-off needs no change. A decision to wait (`block`, `queue`) becomes a report with no label change and no comment. The decisions that send the issue back (`needs-spec`, `denied`, `no-milestone`, `no-assignee`, the withdrawn approval of D6) are applied in both places: they are about the issue, not about where it is built. This settles a sentence of the proposal that could be read both ways ("an approval that is not valid ... leaves the labels as they were"): only a wait leaves them.
- **D4. `go` is consumed by every decision of the cloud.** Each decision of `place: cloud` for an issue that carries `go` removes it in the same label change. `queued` and `blocked` can then only come from a request, so the queue needs no new condition for them. Alternative considered: keep `go` until the claim and make the queue dispatch only issues that carry it; rejected because every return to `queued` (a usage limit, a build that never found a runner) would have to put the label back.
- **D5. The refusals of `go` are decisions.** When `go-plan.mjs --only N` finds `go` on an issue that is not `ready`, the planner returns a `refuse` decision with the message for its state: a draft or `needs-spec` (needs `ready` first), `building` (being built), `built`, `in-review` or `pr-open` (already built), `build-failed` with a branch (use `fix`). `build-failed` without a branch is the retry path that exists, entered with `go_by` in place of the person of `--retry`. `queued` and `blocked` drop the label silently: the request was already made.
- **D6. The approval is checked against two timestamps of GitHub.** The moment of the approval is the last `labeled` event of `ready`, already read. The last edit of the title is the last `renamed` event of the same timeline. The last edit of the body is `lastEditedAt` of the issue, read with one GraphQL query per issue about to be claimed. When either is later than the approval the planner returns `unapproved`: `ready` and `go` are removed and the comment names `ready_by`. When the query fails the planner returns a report that changes nothing (the check is never skipped). Alternative considered: a hash recorded in a hidden comment when `ready` is applied; rejected because a label applied on GitHub runs no code where the cloud is not installed, so the record would be missing exactly where it is needed.
- **D7. The spike comes first.** The first task proves D6 with the token of a workflow run and with a person's `gh`: that `lastEditedAt` is readable, that it moves on a body edit and not on a label or a comment, and that the `renamed` event carries the time of a title edit. If any of the three fails, work stops and this design is revised; nothing else is built on an unproved check.
- **D8. `local` leaves with `building`.** `transition` gains one rule: a move to any exclusive label other than `building` also removes `local`, and a move to `building` in `place: local` adds it. The workflow never applies `local`, so its literal `gh issue edit` lines only gain `--remove-label relevo:go`. The planner counts as running the `building` issues without `local`; the issues that hold shared files still include the local builds.
- **D9. The queue serves a request that nobody answered.** `ownedByQueue` also takes a `ready` issue with `go` whose `go` label is older than 15 minutes: the `decide` job has a timeout of 10, so a label that old was not answered (the cloud was paused, or the run was lost). The concurrency group of the `go` workflow, one run per issue, and the claim keep a late duplicate from building twice. Alternative considered: serve pending requests only on the schedule; rejected because resuming the cloud by hand (a manual run of the queue) should serve them at once.
- **D10. The workflow starts on the `go` label.** The `if` of `decide` compares `github.event.label.name` with `relevo:go`, with the same note about renamed labels. `doctor` reads that expression in the installed file and fails when it names the effective `ready` label, or any name other than the effective `go` label.
- **D11. A remote session asks instead of building.** At its start, with no `--decision`, the skill asks a script where it is; in a remote session it explains, checks whether the cloud can build (`cloudBuilds` and the credential mode that `doctor` already computes), and asks its one question. Applying the label goes through `label-change.mjs` and `gh-web.mjs`, as `issue` does. It makes no GraphQL query there, so D6 is never asked of a remote session.
- **D12. `issue` withdraws, edits and offers again.** `can-edit-issue.mjs` gets a third result for `ready` without `go`: `withdrawable`. The skill asks, removes `ready` on a yes, and ends with the question of three answers. `ready` with `go` stays refused. The edit would withdraw the approval by D6 anyway; doing it first keeps the label from saying something false in between.
- **D13. `go-local.mjs` loses its warning.** It no longer reads `RELEVO_CLOUD_GO` or warns that the cloud can also build: nothing it does starts the cloud. `cloudBuilds` stays for `status`, `doctor` and the remote session.

## Risks / Trade-offs

- [The GraphQL query needs a permission the workflow token lacks, or `lastEditedAt` does not behave as assumed] → D7 proves it before anything is built on it.
- [One more request per issue about to be claimed] → it is made only for the issue of `--only` and for the issues the queue is about to start, not for every candidate.
- [A person edits the issue to fix a typo and loses the approval] → intended; the comment says who approved and what to do, and `issue` offers the approval again in the same session.
- [A workflow of an earlier version stays installed] → it starts on `ready`, so approving an issue would build it. `doctor` fails on it (D10) and the changelog puts the workflow update first.
- [A local build dies and leaves `building` with `local`] → it takes no slot from the cloud (D8); `status` reports it with who started it, and returning it to `ready` starts nothing.
- [A person applies `local` by hand expecting it to keep the cloud away] → the planner ignores it and `doctor` warns, naming the issue.
- [Two runs for one issue after a pause: the label event and the queue] → the 15 minutes of D9, the concurrency group and the claim; a second run finds the issue no longer `ready` with `go` and decides nothing.
- [A cloud user must now apply two labels] → `issue` offers both in one answer; the guide says so first.

## Migration Plan

1. Released with `rename-qa-failed-label`, as one breaking version of the label interface.
2. In each repository, in this order: update the plugin; run `/relevo:init` (it rewrites the workflows, so `ready` stops starting builds, and creates the `go` and `local` labels); merge the workflow files to the default branch; apply `go` to the issues that were `ready` and waiting for the cloud; run `/relevo:doctor`.
3. Between the plugin update and the merge of the workflows, an installed workflow still starts on `ready`: do not approve issues in that window, or pause the cloud with `RELEVO_CLOUD_GO` until the merge.
4. Rollback: the former plugin version and workflow files. The `go` and `local` labels can stay; nothing of the former version reads them.

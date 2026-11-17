# Proposal

## Why

The `ready` label does three things at once: it says the issue is complete and approved, it starts the cloud build, and it authorises whoever applied it. Because the label is the trigger, a person cannot build an issue on their own machine without also starting the cloud (the planner only accepts a `ready` issue, and applying `ready` fires the workflow), and a team that builds some issues in the cloud and others on machines has only the repository-wide switch `RELEVO_CLOUD_GO`, which pauses everyone. There is also no way to mark an issue as "written and approved" without building it at once, which is how issues are really prepared: a draft is filed so that it is not forgotten, filled in later with `think` and `issue`, and built when someone decides to.

The labels are the interface of the plugin. Relevo has no installations outside the pilot today, so this is the moment to change what they mean: after a public release the same change would break every copied workflow. The decision and the alternatives that were discarded are recorded in `docs/adr/0001-approval-and-build-request-are-separate-labels.md`, and the words used below are defined in `GLOSSARY.md`.

## What Changes

The approval and the build request:

- **BREAKING: `ready` no longer starts a build.** It is the approval: the issue is complete and is what should be built. Anyone with the permission that `ready` requires today may apply it (write access, or maintain access when `trust` is `public`); it is not restricted to `team.spec_writer`. The gates still require it and still check that permission, and the build names who approved.
- **A new request label, `go`, builds in the cloud.** Someone with the permission of `ready` applies it to a `ready` issue and the `go` workflow starts on it. It is a request, not a state, and it is consumed at the first decision about the issue, as `ship` always is. The label and the command then mirror `ship`: the `go` label asks the cloud to build, `/relevo:go <n>` builds on the person's machine.
- **`go` on an issue that cannot take it is refused.** On an issue that is not `ready` the label is removed and one comment says that the issue needs `ready` first; on an issue that is already `building`, the comment says that it is being built. `go` never stands in for the approval.
- **`go` on a `build-failed` issue that left no code rebuilds it in the cloud**, as `--retry` does on a machine, without passing through `ready` again. When the issue has a branch with implementation, the label is removed and the comment points to `/relevo:fix`.
- **After `needs-spec` the build is requested again.** A corrected issue returns to `ready`, which starts nothing; the request was consumed when the cloud decided.
- **A request can be withdrawn by hand.** Moving a `queued` or `blocked` issue back to `ready` leaves it approved with no request.

The text that is built is the text that was approved:

- Today the time between `ready` and the claim is seconds; now it can be days. Before an issue is claimed, in the cloud or on a machine, the last edit of its title and body is compared with the moment `ready` was applied, as GitHub reports them. Any later edit, also one by the person who approved, removes `ready` and leaves the issue a draft, with one comment that names who approved and asks for a new approval. It does not go to `needs-spec` (nothing is missing) or to `build-failed` (nothing was built).
- Where that cannot be read, nothing is built and the reason is said. The design starts with a spike that settles one fact: that the token of the workflow, and the `gh` of a person's machine, can read the last edit. A session on the web is not asked, because it does not build (see below).
- `issue` keeps refusing to edit a `ready` issue in place: it removes `ready`, edits, and offers the approval again.

A local build:

- **It needs no label.** `/relevo:go <n>`, `/relevo:go <n> --local` and `go-local.mjs <n>` build a `ready` issue with the permission of the person who runs them. The cloud workflow does not start, so one label can no longer start both.
- **It is rationed by nobody.** The gates that protect the build stay: a valid approval, a milestone, an assignee, a complete text and merged dependencies. The gates that ration automatic work do not apply: the limit of concurrent agents and the review capacity of the assignee. A file shared with an issue that is not merged does not hold a local build: it goes on, and the hand-off lists the shared files, as it does when the wait of a cloud build ends.
- **It never joins the cloud queue.** A local build that cannot start (a dependency that is not merged, an approval that is not valid) reports why and leaves the labels as they were. Only a build request puts an issue in `queued` or `blocked`.
- **It can take an issue that waits in the cloud.** `/relevo:go <n>` on a `queued` issue claims it and the queue no longer sees it; on a `blocked` issue it is refused, as always.
- **It is marked.** A local build carries a new `local` label next to `building`, applied when the build is claimed and removed by the tool when the issue leaves `building`. The limit of concurrent agents counts only the `building` issues without it, so a local build takes no slot from the cloud. Who started it is read from the label event. A `local` label without `building` means nothing: the planner ignores it and `doctor` reports it.
- **A session on the web does not build.** Its container has no toolchain of the project and no hard limits, and a build there would run on the model and the accumulated context of the conversation. In a Claude Code session on the web, `/relevo:go <n>` builds nothing: it says why and asks one yes/no question, whether to apply the `go` label so that the cloud builds the issue, with the permission check of `issue`. Where the cloud cannot build (no workflow, no credential, paused), it says that the issue needs a machine or the cloud, and applies nothing. There is no option that forces a build on the web.
- **A local build that died is restarted by hand.** `status` reports a build with no activity as it does today, says that it is a local build and whose, and tells the person to return the issue to `ready`, which is now safe.

The cloud when it cannot answer:

- **Paused.** With `RELEVO_CLOUD_GO` set to `off` the `go` label stays on the issue as a pending request, and the cloud serves it when it resumes, with nothing to apply again.
- **No credential.** The label is removed, the issue stays `ready`, and one comment says that the cloud is not configured and gives the local command.
- **No workflow.** Nothing can answer on the issue, so `doctor` and `status` say that the `go` label has no effect there and give the local command.

What follows from it:

- **`issue` offers both labels.** After creating or updating issues it asks one separate question with three answers: nothing, `ready` only, or `ready` and `go`. The simple case (one person who writes and builds in the cloud) stays one step.
- **`status` lists what waits for a decision.** The `ready` issues assigned to the person are listed with both ways to build them, whether or not the cloud builds.
- **The messages that say "apply `ready` again"** (a build that stopped reporting, a branch with only the specification, a run that ended without an outcome) name the `go` label or the local command instead.
- **The label set, the templates and the documentation follow.** `go` and `local` are added to the labels that `init` creates and that `relevo.yml` can rename; the workflow templates trigger on `go` and remove it wherever they remove `ready` today; `doctor` reports an installed workflow that still triggers on `ready`; the guides, in English and Spanish, describe the three kinds of user (one person, a team with the cloud, machines only).

Not in this change: a setting that makes `ready` start the cloud as before (one label with two possible meanings is what a new user would trip on); a label that a person applies to force a local build (the local command is that choice); a heartbeat for local builds; showing the progress of a local build or its subagents, and making the developer agent mark each task as it finishes (a separate change).

One question for the design: what the `urgent` label means now. It asks for an early start and skips the review capacity of the assignee, a gate that a local build no longer has, and nothing was decided about `urgent` on a `ready` issue that has no build request. The default to confirm is that it stays a request for the cloud alone: it waits with the issue, takes effect when `go` is applied, and a local build ignores it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue-lifecycle`: `ready` is the approval and starts nothing; `go` is a request label and `local` a mark next to `building`; a draft; what returns an issue to `ready` or to a draft; `local` leaves with `building`.
- `go`: the trigger is the `go` label on a `ready` issue; both permissions are checked; the refusals of `go`; the request is consumed at the first decision and served after a pause; the queue acts on what a request left waiting; the capacity and agent gates apply to cloud builds only and the limit does not count local builds; the cloud rebuild of a `build-failed` issue with no code; the labels the workflow removes.
- `execution-modes`: a local build needs no label, skips the gates that ration, never moves an issue to `queued` or `blocked`, can take a `queued` issue and carries the `local` mark; what a paused, unconfigured or absent cloud does with the `go` label; the cloud warning of a local build.
- `web-sessions`: `go` in a session on the web builds nothing and offers the build request instead.
- `security`: the issue that is built is the issue that was approved, checked against the last edit across a wait of any length, in the cloud and on a machine; nothing is built where it cannot be checked; the trust level applies to both labels.
- `issue`: applying `ready` no longer starts a build; the offer has three answers; editing a `ready` issue removes the approval first.
- `status`: the `ready` issues of the person are listed with both ways to build them; a stuck build says whether it is local, whose it is and how to restart it.
- `init-doctor`: the `go` and `local` labels are created; the execution mode names the `go` label; a workflow that still triggers on `ready` and a `local` label without `building` are reported.
- `fix`: the message for a branch without implementation names the `go` label or the local command.
- `documentation`: the guides describe the two labels, the mark of a local build and the three kinds of user.

## Impact

- Code: `scripts/lib/labels.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/github.mjs`, `scripts/go-plan.mjs`, `scripts/lib/requeue.mjs`, `scripts/lib/can-edit-issue.mjs`, `scripts/lib/next-step.mjs`, `scripts/lib/status.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, `scripts/lib/messages.mjs` (English and Spanish), `scripts/lib/go-local.mjs`, `scripts/label-change.mjs`, and their tests.
- Content: `templates/workflows/relevo-go.yml` and `relevo-queue.yml`, `templates/agents/antigravity-step.yml`, `templates/relevo.yml`, `skills/go`, `skills/issue` (and `references/update.md`), `skills/fix`, `skills/status`, `skills/doctor`, `skills/init`, `docs/` in both languages (`execution`, `guide`, `get-started`, `issue-format`, `security`).
- GitHub: one more read per issue that is about to be claimed (its last edit). A session of Claude Code on the web never makes it, because it does not build.
- Release: a breaking change to the label interface and to the workflow templates, so a new minor version with the migration in `CHANGELOG.md`: update the workflow files, create the `go` and `local` labels, and apply `go` to the issues that were `ready` and waiting for the cloud.
- Order: built after `rename-qa-failed-label`, whose name for a failed build, `build-failed`, this proposal already uses.
- Users: a team that builds in the cloud applies one more label per issue, or answers "`ready` and `go`" in `issue`.

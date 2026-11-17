# Proposal

## Why

The `ready` label does three things at once: it says the issue is complete and approved, it starts the cloud build, and it authorises whoever applied it. Because the label is the trigger, a person cannot build an issue on their own machine without also starting the cloud (the planner only accepts a `ready` issue, and applying `ready` fires the workflow), and a team that builds some issues in the cloud and others on machines has only the repository-wide switch `RELEVO_CLOUD_GO`, which pauses everyone. There is also no way to mark an issue as "written and approved" without building it at once, which is how issues are really prepared: a vague issue is filed as a reminder, filled in later with `think` and `issue`, and built when someone decides to.

The labels are the interface of the plugin. Relevo has no installations outside the pilot today, so this is the moment to change what they mean: after a public release the same change would break every copied workflow.

## What Changes

- **BREAKING: `ready` no longer starts a build.** It means that the issue is complete and approved, and nothing else. The gates still require it, and still check that the person who applied it had the permission that `ready` requires today (write access, or maintain access when `trust` is `public`).
- **A new request label, `go`, builds in the cloud.** It is a request, not a state, like `ship` and `urgent`: someone with the permission of `ready` applies it to a `ready` issue and the `go` workflow starts on it. The label and the command then mirror `ship`: the `go` label asks the cloud to build, `/relevo:go <n>` builds on the person's machine.
- **A local run needs no label.** `/relevo:go <n>`, `/relevo:go <n> --local` and `go-local.mjs <n>` build a `ready` issue with the permission of the person who runs them, as `--retry` already does for a `qa-failed` issue. The cloud workflow does not start, so the two can no longer run on the same issue because of one label, and the warning that the cloud can also build the issue is no longer needed for an issue that has no `go` request.
- **`go` on an issue that is not `ready` is refused.** The label is removed and one comment says that the issue needs `ready` first. `go` never stands in for the approval.
- **A local run never joins the cloud queue.** A local run whose decision is not `start` (a dependency that is not merged, the capacity of the assignee, a shared file, the limit of agents) reports the decision and leaves the labels as they were. Only a `go` request puts an issue in `queued` or `blocked`, so the queue keeps dispatching exactly what was asked of the cloud, and an issue that waits there is built when it becomes eligible with no second request.
- **The text that is built is the text that was approved.** Today the time between `ready` and the claim is seconds; now it can be days. A title or body that changed after `ready` was applied SHALL NOT be built: the issue goes back for a new approval, whether the edit was made through `issue` or on GitHub. `issue` keeps refusing to edit a `ready` issue in place: it removes `ready`, edits, and offers it again.
- **`issue` offers both labels.** After creating or updating issues it asks one separate question with three answers: nothing, `ready` only, or `ready` and `go`. The simple case (one person who writes and builds in the cloud) stays one step.
- **A `go` label with no cloud says so.** Where the `go` workflow is not installed, has no credential or is paused, `doctor` and `status` say that the `go` label has no effect there and give the local command; a paused or unconfigured cloud that receives the label answers as it does today for `ready`.
- **`status` lists what waits for a decision.** The `ready` issues assigned to the person are listed with both ways to build them, whether or not the cloud builds; the condition "only when the cloud is not building" goes away.
- **Restarting a stuck or failed build no longer starts the cloud by accident.** The messages that say "apply `ready` again" (a build that stopped reporting, a branch with only the specification, a run that ended without an outcome) name the `go` label or the local command instead, and returning an issue to `ready` is always safe.
- **The label set, the templates and the documentation follow.** `go` is added to the labels that `init` creates and that `relevo.yml` can rename; the workflow templates trigger on it and remove it wherever they remove `ready` today; `doctor` reports an installed workflow that still triggers on `ready`; the guides, in English and Spanish, describe the three kinds of user (one person, a team with the cloud, machines only).

Not in this change: a setting that makes `ready` start the cloud as before (one label with two possible meanings is what a new user would trip on); a per-issue label that forces a local build (the local command is that choice); showing the progress of a local run or its subagents (a separate change); how a local build counts against the limit of concurrent agents, unless the design finds that it must change for the split to be correct.

Open questions for the design:

1. Who may apply `ready`: anyone with the permission it requires today, or only `team.spec_writer` when it is set.
2. How the approved text is recognised. The planner records a hash only when it claims the issue; nothing records the text at the moment `ready` is applied, and a label applied on GitHub runs no code where the cloud is not installed.
3. Whether the `go` label is removed at the first decision (as `ship` always is) or stays on a `queued` or `blocked` issue until the build starts. Either gives the behaviour above.
4. What happens to an issue left in `building` by a machine that stopped: the cloud rescue only covers its own runs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue-lifecycle`: `ready` is the approved state and starts nothing; `go` is a request label next to it; who owns each; what returns an issue to `ready`.
- `go`: the trigger is the `go` label on a `ready` issue; both permissions are checked; `go` without `ready` is refused; the queue acts on what a `go` request left waiting; the labels the workflow removes; the retry and restart paths.
- `execution-modes`: a local run builds a `ready` issue without a label and never moves it to `queued` or `blocked`; what a paused, unconfigured or absent cloud does with the `go` label; the cloud warning of a local run.
- `security`: the issue that is built is the issue that was approved with `ready`, across a wait of any length; the trust level applies to both labels.
- `issue`: applying `ready` no longer starts a build; the offer has three answers; editing a `ready` issue removes the label first.
- `status`: the `ready` issues of the person are listed with both ways to build them; the restart hint of a stuck build.
- `init-doctor`: the `go` label is created; the execution mode names the `go` label; a workflow that still triggers on `ready` is reported.
- `fix`: the message for a branch without implementation names the `go` label or the local command.
- `documentation`: the guides describe the two labels and the three kinds of user.

## Impact

- Code: `scripts/lib/labels.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/github.mjs`, `scripts/go-plan.mjs`, `scripts/lib/requeue.mjs`, `scripts/lib/can-edit-issue.mjs`, `scripts/lib/next-step.mjs`, `scripts/lib/status.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, `scripts/lib/messages.mjs` (English and Spanish), `scripts/lib/go-local.mjs`, `scripts/label-change.mjs`, and their tests.
- Content: `templates/workflows/relevo-go.yml` and `relevo-queue.yml`, `templates/agents/antigravity-step.yml`, `templates/relevo.yml`, `skills/go`, `skills/issue` (and `references/update.md`), `skills/fix`, `skills/status`, `skills/doctor`, `skills/init`, `docs/` in both languages (`execution`, `guide`, `get-started`, `issue-format`, `security`).
- Release: a breaking change to the label interface and to the workflow templates, so a new minor version with the migration in `CHANGELOG.md`: update the workflow files, create the `go` label, and apply `go` to the issues that were `ready` and waiting for the cloud.
- Users: a team that builds in the cloud applies one more label per issue, or answers "`ready` and `go`" in `issue`.

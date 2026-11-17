---
status: accepted
---

# Approval and build request are separate labels

The `ready` label used to mean three things at once: the issue is complete, build it in the cloud now, and the person who applied it authorises the build. Because the label was the trigger, nobody could build an approved issue on their own machine without also starting the cloud, and a team that builds some issues in the cloud and others on machines had only a repository-wide switch. We decided that `ready` is the approval and starts nothing, that a second label, `go`, is the build request for the cloud, and that the `go` command builds an approved issue on a machine with no label at all. The label and the command then mirror `ship`, which already works both ways.

We made the change before the first public release because the labels are the interface of the plugin: afterwards it would break every installed workflow.

## Considered Options

- **A `local` label next to `ready` that tells the cloud not to start.** Rejected: two labels applied one after the other race with the workflow that the first one starts, and the person has to remember the order.
- **The repository variable that pauses the cloud.** Kept as a pause for everyone, rejected as the answer: it cannot say that one issue goes to the cloud and another to a machine.
- **A local build of an issue that has no label.** Rejected: it would build a text that nobody with the required permission approved.
- **The same split with other names, `ready` still the trigger and a new label for the approval.** It needed no migration, but there were no installations to migrate, and `ready`, `go` and `ship` say what they do.
- **A setting that makes `ready` start the cloud as before.** Rejected: one label with two possible meanings is what a new user would trip on.

## Consequences

- The time between the approval and the build is no longer seconds, so a text that changed after `ready` was applied is not built: the issue loses the approval and is approved again.
- A local build is rationed by nobody. The limit of concurrent agents and the review capacity of the assignee apply to cloud builds only, and a local build carries a `local` label next to `building` so that the cloud does not count it.
- Only a build request puts an issue in `queued` or `blocked`; a local build that cannot start reports why and leaves the labels alone.

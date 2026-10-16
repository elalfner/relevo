## Context

A small team (three people of equal level) wants to move from "an agent helps me code" to "an agent builds the ticket and I verify". Constraints that shaped the design:

- The scarce resource is human verification time, not build time.
- The build needs no device, so it can run unattended in CI; the on-device review cannot.
- The team works in private repositories, one person writes the specs, two people implement and cross-review.
- Rules that matter must be enforced by the platform (branch protection, token permissions), not only by prompt instructions.

## Goals / Non-Goals

**Goals**

- A workflow that is automatic where no human judgement is needed and explicit where it is.
- One actionable message per hand-off.
- A per-repository configuration so the same skills fit a solo project and a team.
- A defined adapter boundary so other trackers, git providers and platforms can follow.

**Non-Goals**: see `proposal.md`.

## Decisions

### D1. The build runs in the cloud, triggered by GitHub

`/relevo:go` runs in a GitHub Actions workflow, not on a person's machine. It scales without anyone's laptop, runs in parallel, and leaves an audit trail. On-device review stays local because it needs `adb` and a phone.

*Alternative rejected*: running the agent on a team member's machine. Fragile, serial, and invisible to the team.

### D2. Trigger = milestone membership plus a `ready` label

The milestone defines the batch and the ordering context; the `ready` label means "the spec is finished, you may start". Both are needed so the agent never starts a task while its spec is still being edited. Bulk labelling keeps a whole batch cheap.

### D3. Three gates before any build

1. **Spec gate**: the issue has scenarios, edge cases and (optionally) dependencies.
2. **Dependency gate**: every `Depends-on: #N` issue is merged.
3. **Capacity gate**: the assignee has fewer than `limits.built_unreviewed_per_person` issues in `built`.

A failed gate leaves a label and a comment that says why and whose move it is. This is a pull system: the agent is faster than people, so it must not be allowed to bury them.

### D4. Queue = FIFO with skipping

Order is the time the `ready` label was applied. An ineligible head (blocked or over capacity) is skipped, not waited on, and re-enters at its original position when it becomes eligible. A global cap (`limits.concurrent_agents`) bounds cost and merge conflicts.

### D5. A QA failure still pushes the branch

The agent's environment is ephemeral. If a failed build were discarded, the work would be lost. After the allowed retries, the branch is pushed, the issue is labelled `qa-failed`, and the assignee is mentioned with the exact QA report. The state does not advance and no pull request is opened.

### D6. Human-driven on-device review

The person drives the app; the agent only observes: on-demand screenshots and a log audit when the person says they are done. The agent never taps, types or swipes. After the review, the branch is synchronised with the base branch first, so the person never reviews a stale base.

### D7. The pull request is opened only after the work is verified

Opening a PR asks another person to spend time. It happens only when the console is clean and every scenario in the checklist has been confirmed on the device. Otherwise the issue stays in review, and the person completes the test or runs `/relevo:fix`.

### D8. Review model is configurable

`review.mode` is `none` (a solo project: the person's explicit confirmation is the gate), `peer` (someone other than the author must approve) or `roles`. `review.merger` is `author` or `approver`. Approval always comes from a non-author. With `merger: approver` the approver also runs `ship` and the command refuses to run for the PR's author; with `merger: author` the author runs `ship` after the non-author approval exists. In `roles` mode only members of `team.approvers` may approve.

### D9. Archive the spec at ship time, restricted to the specs directory

The spec change is archived right before merging so code and spec land in one squash commit. Archiving earlier would force un-archiving whenever reviewers request changes. The archive commit may be pushed after approval, so the repository must not dismiss approvals on new commits, and the command verifies that the archive commit touches only the specs directory.

### D10. Notifications are GitHub events

Skills assign, request reviews, mention and label. Chat tools subscribe to those events. Skills contain no chat integration. Waiting states (`queued`, `blocked`) do not notify.

### D11. Message language is configurable

Labels and messages default to English; `language` in `relevo.yml` changes the messages. Label names are renameable.

### D12. Platform rules are read live

The QA agent reads project rules from the file named in `qa.rules_from` at each run, instead of embedding a copy that would go stale.

### D13. OpenSpec is an external dependency, not bundled

Relevo uses OpenSpec to generate and archive change specifications. It is declared as a required tool, detected by `doctor`, and installed only on explicit confirmation from `init`. Relevo does not copy OpenSpec files into its repository.

*Why*: invoking a separately installed MIT-licensed tool creates no redistribution obligations; bundling would require carrying its licence notice and tracking its updates. *Alternative kept open*: a thin specification-engine boundary so another engine can replace OpenSpec later.

### D15. `think` composes external skills instead of reimplementing them

`/relevo:think` invokes `openspec-explore` and then `grill-with-docs` (which relies on `grilling` and `domain-modeling`) and adds only the hand-off to `/relevo:create`. Like OpenSpec in D13, these skills are external: they are not bundled in the plugin, `doctor` detects them, and `think` stops with install instructions when one is missing. Skills in a project's `.claude/skills/` do not travel with a plugin, so every project that installs Relevo must have them.

*Why*: a copy of their behaviour inside `think` drifts from the originals and duplicates what they already do well; `openspec-explore` is also generated by the OpenSpec CLI and changes with it. *Alternative rejected*: shipping copies in the plugin, which needs licence notices and constant resynchronising.

### D14. Labels carry a `relevo:` prefix by default

Generic names such as `ready` or `blocked` collide with labels a repository already uses. The defaults are `relevo:ready`, `relevo:built` and so on, and every name can be changed in `labels` of `relevo.yml`. Eleven labels in total: six states, four exits that replace the state, and `needs-reviewer`, which is added next to it.

### D16. The gates run in a light job, the build in a heavy one

`relevo-go.yml` has two jobs. `decide` needs only Node and the plugin's scripts (about half a minute): it runs the gates, claims the issue and comments on any outcome that is not a build. `build` installs the toolchain and runs the agent, and starts only when the decision is `start`; the decision travels in the prompt, base64-encoded so the issue title it contains is never read as an instruction. *Why*: before, every outcome paid for installing Flutter, OpenSpec and the plugin (one to two minutes) before the agent found there was nothing to build; and the issue was only claimed minutes after the queue dispatched it, so a second queue evaluation dispatched it again (pilot G5). Claiming in the light job shrinks that window to seconds, and a late duplicate dispatch ends in `decide`, cheaply. *Not removed*: two dispatches that arrive at the same moment can both start a `decide` job. *Alternative rejected*: leaving the gates inside the agent; it keeps the cost and ties a deterministic rule to a model run.

## Risks / Trade-offs

- **The spec is a single point of failure.** A wrong issue is built confidently and QA checks against the same wrong spec. *Mitigation*: the spec gate, an `needs-spec` exit that returns the issue to its writer, and a metric for how often it is used.
- **Branches age while waiting for review.** *Mitigation*: capacity gate, synchronise-before-review, and the status alert for stale branches.
- **Hand-offs dominate cycle time.** *Mitigation*: a review SLA with a reminder and then an escalation, plus a daily digest.
- **Prompt injection through issue content.** *Mitigation*: issue text is treated as data, the agent has a closed tool list, runs only when a user with write access applied the label, and is limited to `feature/*` branches. Stricter settings apply when `trust` is `public`.
- **Cost.** *Mitigation*: per-run turn and cost caps, one run per issue, a global concurrency cap.
- **Experimental dependencies.** The exact parameters of the GitHub Action that runs the agent must be verified against its current documentation during implementation.

## Migration Plan

Roll out in stages: pilot in a solo repository (`review.mode: none`) to prove `go` → `review` → `ship`; then one milestone in a team repository to prove cross-review, capacity, queue and digest; then public release.

## Open Questions

- Whether `id-token: write` can be removed from the `go` workflow (see `docs/action-parameters.md`; the other parameters of the action were verified there).
- Whether to ship a sandbox repository for end-to-end tests inside this repo or separately.
- Whether to add a specification-engine boundary in v1 or only when a second engine is needed.
- Exact package name and install command of the OpenSpec tool should be re-verified at release time.

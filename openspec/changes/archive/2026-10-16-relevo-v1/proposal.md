## Why

Writing code is no longer the slow part of a feature; verifying it is. Teams that use a coding agent end up with branches that are built quickly and then wait days for a person to test them on a device, review them and merge them. The waiting, the hand-offs and the unreviewed backlog are where the time goes and where quality is lost.

Relevo ("relay") is a workflow that puts the agent where it is fast (building and self-checking, unattended, in the cloud) and puts people where they are irreplaceable (testing on a real device, reviewing a peer's work, deciding to merge). Every step is a hand-off with a single, actionable message.

## What Changes

A Claude Code plugin named `relevo`, with these commands: `/relevo:init`, `/relevo:go`, `/relevo:review`, `/relevo:fix`, `/relevo:ship`, `/relevo:status`, `/relevo:doctor`, plus the `dev` and `qa` agents and a per-repository `relevo.yml`.

Version 1 targets **GitHub** (issues, pull requests, Actions) and **Flutter on Android**. The adapter boundaries (issue tracker, git provider, platform) are defined from the start so other providers can be added without rewriting the core.

## Capabilities

### New Capabilities

- `configuration`: the per-repository `relevo.yml` and its validation.
- `issue-lifecycle`: states, labels, owners and side exits of an issue.
- `go`: the automatic, unattended build: gates, queue, build, QA, outcomes.
- `review`: guided on-device review ("human driver, agent sentinel") that ends in a pull request.
- `fix`: spec-first correction of review feedback.
- `ship`: peer approval check, spec archive, merge and close-out.
- `status`: per-person view of who is waiting on what, plus a daily digest.
- `init-doctor`: idempotent repository setup and environment/settings verification.
- `security`: which invariants GitHub enforces and which the skills enforce.

### Modified Capabilities

None. This is a new project.

## Non-goals (v1)

- Issue tracker adapters and git providers other than GitHub.
- Platforms other than Flutter on Android (iOS, web, backend frameworks).
- Automatic approval or merge by the agent. This is never in scope.
- Sending chat messages directly. Notifications come from GitHub events; chat tools subscribe to them.
- Creating the issues themselves. A separate tool produces spec-ready issues; Relevo consumes them.

## Impact

- New repository content only: plugin manifest, skills, agents, templates (workflows, `relevo.yml`), docs, acceptance tests.
- Depends on the OpenSpec command-line tool (MIT licensed, Node.js 20.19 or newer) as an external, separately installed dependency. Relevo invokes it; it does not bundle or redistribute it. `doctor` checks for it and `init` can install it with explicit confirmation.
- Requires, in each adopting repository: a GitHub Actions secret with the model API key, branch protection on the integration branch, and an admin to run `/relevo:init` once.

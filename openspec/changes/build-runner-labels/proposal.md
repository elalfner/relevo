# Proposal

## Why

Every job of every Relevo workflow runs on the same runner labels (`runner.labels`), and `init` writes them into every `runs-on`. On self-hosted runners that puts two very different kinds of work in one pool: the build job of `go`, which installs a toolchain, runs the agents and can last an hour, and the light jobs (the decision of an issue, the queue, the label sync of a review, `ship`, the reminders and the digest), which last seconds or only wait. A team with four runners on one server, shared by all its repositories, saw both effects: a build holds a runner that the pull request checks and the light jobs need, and several builds, from one project or from several, start together and saturate the machine. `limits.concurrent_agents` does not help across projects, because it counts the builds of one repository, and GitHub has no concurrency group that spans repositories: the only limit a machine has is the number of runners that can take a build.

Today the only way to keep builds on their own runner is to edit the `runs-on` of the build job by hand, which `doctor` then reports as a difference. Anyone who installs the plugin on their own runners meets this, so it should be settled before the public release.

## What Changes

- **A second runner setting for the build job.** `relevo.yml` accepts `runner.build_labels`, a list of labels with the same rules as `runner.labels`. When it is set, the build job of the `go` workflow runs on it and every other job of every Relevo workflow keeps running on `runner.labels`. When it is absent nothing changes: the build job runs on `runner.labels`, as today.
- **The runners that take builds are the limit of the machine.** With builds on their own labels, the number of runners that carry them is how many builds run at once on that machine, across every repository that points to them; what does not fit waits in GitHub's queue of the job. The light jobs and the checks of the project never wait behind a build.
- **`init` asks and writes both.** When the person says the repository uses a self-hosted runner, `init` also asks whether the builds have runners of their own, writes `runner.build_labels` and puts it in the `runs-on` of the build job only, and keeps it there when it rewrites a workflow.
- **`doctor` checks each job against its own setting.** The comparison of `runs-on` with `relevo.yml` is made per job: the build job against `runner.build_labels` (or `runner.labels` when it is absent), the others against `runner.labels`. It reports the effective runner of the build apart from the other one. On self-hosted runners with no `runner.build_labels` it says, once and as advice, that builds share the runners of the light jobs and of the checks, and that `limits.concurrent_agents` is a limit of the repository, not of the machine.
- **A waiting build says that it waits.** An issue that was claimed and whose build job has not found a runner is `building` with no agent running. The progress comment exists only once the build job starts, so the comment that `go` posts when it claims the issue, or `status`, must let a person tell "waiting for a runner" from "stuck"; the design decides which.
- **The documentation explains the machine.** The page on self-hosted runners says that the limit of agents is per repository, that a machine shared by several repositories is limited by the runners that take builds, how to label one or more runners for builds and leave the rest for the checks and the light jobs, and that runners on one machine share its memory and processors whatever their labels.

Not in this change: a limit of builds that Relevo itself enforces across repositories (it would need state outside any one repository, and the runners already give it); separate runners for the other workflows, one by one; measuring or tuning the toolchain on the runner; anything about local builds or the `go` label, which belong to `split-ready-and-go`.

Open questions for the design:

1. Whether a build job that waits for a runner counts against `run_max_minutes` and the alert of `building_alert_hours`, and how long GitHub lets a job wait before it cancels it.
2. Whether the Antigravity build step and its guard need anything beyond the same `runs-on`.
3. Whether the queue should stop dispatching when the builds already claimed wait for a runner, or leave that to GitHub's queue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `configuration`: the `runner.build_labels` setting, its validation and its default.
- `init-doctor`: `init` asks for the build runner and writes it into the build job only; `doctor` compares each job with its own setting, reports both effective runners and advises when builds share the runners of everything else.
- `go`: the build job runs on the build runner; a claimed issue whose build waits for a runner is told apart from a stuck one.
- `documentation`: the page on self-hosted runners explains the limit of a machine shared by several repositories and how to give builds their own runners.

## Impact

- Code: `scripts/lib/config.mjs`, `scripts/lib/init.mjs`, `scripts/lib/doctor.mjs`, `scripts/validate-config.mjs`, and their tests; `scripts/lib/status.mjs` or `scripts/lib/messages.mjs` if the waiting build is reported there.
- Content: `templates/workflows/relevo-go.yml` (the `runs-on` of the build job and its comment), `templates/relevo.yml`, `skills/init`, `skills/doctor`, `docs/execution.md` and `docs/configuration.md` in both languages.
- Compatibility: none broken. A repository without `runner.build_labels` behaves as today, and a workflow already installed stays valid.
- Order: independent of `split-ready-and-go`; both touch `relevo-go.yml`, `init` and `doctor`, so the second one to be built rebases on the first.

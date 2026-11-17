# Proposal

## Why

Every job of every Relevo workflow runs on the same runner labels (`runner.labels`), and `init` writes them into every `runs-on`. On self-hosted runners that puts two very different kinds of work in one pool: the build job of `go`, which installs a toolchain, runs the agents and can last an hour, and the light jobs (the decision of an issue, the queue, the label sync of a review, `ship`, the reminders and the digest), which last seconds or only wait. A team with four runners on one server, shared by all its repositories, saw both effects: a build holds a runner that the pull request checks and the light jobs need, and several builds, from one project or from several, start together and saturate the machine. `limits.concurrent_agents` does not help across projects, because it counts the builds of one repository, and GitHub has no concurrency group that spans repositories: the only limit a machine has is the number of runners that can take a build.

Today the only way to keep builds on their own runner is to edit the `runs-on` of the build job by hand, which `doctor` then reports as a difference. Anyone who installs the plugin on their own runners meets this, so it should be settled before the public release. The words build job, light job and build runner are defined in `GLOSSARY.md`.

## What Changes

- **A second runner setting for the build job.** `relevo.yml` accepts `runner.build_labels`, an optional list of labels with the same rules as `runner.labels`. When it is set, the build job of the `go` workflow, and only that job, runs on it; every light job of every Relevo workflow keeps running on `runner.labels`, `ship` included, which can wait half an hour for the checks but weighs nothing on the machine. When it is absent nothing changes.
- **The build runners are the limit of the machine.** How many of them a machine has is how many cloud builds it runs at once, across every repository that points to them; what does not fit waits in GitHub's queue of the job. The queue of Relevo is not changed: it dispatches up to `limits.concurrent_agents` as today, a claimed issue already counts against that limit, and it does not look at which runners are free (that needs administration permissions the workflow does not have).
- **`init` asks and writes both.** When the person says the repository uses a self-hosted runner, `init` also asks whether the builds have runners of their own, writes `runner.build_labels` and puts it in the `runs-on` of the build job only, and keeps it there when it rewrites a workflow.
- **`doctor` checks each job against its own setting.** The comparison of `runs-on` with `relevo.yml` is made per job: the build job against `runner.build_labels` (or `runner.labels` when it is absent), the others against `runner.labels`, and it reports the effective runner of the build apart from the other one. As advice, never as a failure, it says once when builds share the runners of the light jobs on self-hosted runners, that `limits.concurrent_agents` is a limit of the repository and not of the machine, and which workflows of the project (its checks) run on the same labels as the builds.
- **The checks of the project stay the project's.** There is no setting for the runner of the project's own workflows: Relevo does not write those files. `doctor` reports the overlap and the documentation says how to move them.
- **A build that waits says that it waits.** The progress comment is created by the decision job when it claims the issue, with the text that the build waits for a runner, and the build job edits that same comment when it starts. No comment is added, and the minute or more in which nothing was shown after the label goes away. The wait does not count against `limits.run_max_minutes`, which is measured from the start of the build job.
- **A long wait is reported as a wait.** When a claimed issue has waited for a runner longer than `limits.building_alert_hours`, `status` reports it, saying that it waits for a runner and for how long, not that the build stopped reporting: there is nothing to restart, only a runner to look at or a local build to start.
- **A build that never found a runner returns to the queue.** When GitHub cancels a build job because it waited too long, the issue goes back to `queued` with one comment that says that no runner took it, instead of ending as a failed build: nothing was built and nothing failed. The queue then tries again.
- **The documentation explains the machine.** The page on self-hosted runners says that the limit of agents is per repository, that a machine shared by several repositories is limited by its build runners, how to label one or more runners for builds and leave the rest for the checks and the light jobs, that runners on one machine share its memory and processors whatever their labels, and that the build runner of an Antigravity build must be Linux x86-64, as its step already requires.

Not in this change: a limit of builds that Relevo itself enforces across repositories (it would need state outside any one repository, and the runners already give it); separate runners for the other workflows, one by one; a setting for the checks of the project; measuring or tuning the toolchain on the runner; anything about local builds or the `go` label, which belong to `split-ready-and-go`.

One fact for the design to confirm: how long GitHub lets a job wait for a self-hosted runner before it cancels it, and how the last job of the workflow tells that cancellation from a build that was cut while it ran.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `configuration`: the `runner.build_labels` setting, its validation and its default.
- `init-doctor`: `init` asks for the build runner and writes it into the build job only; `doctor` compares each job with its own setting, reports both effective runners, and advises when builds share the runners of the light jobs or of the project's own workflows.
- `go`: the build job runs on the build runner; the progress comment is created when the issue is claimed and says that the build waits; a build job cancelled before it started returns the issue to `queued`.
- `status`: an issue that waits for a runner past the alert time is reported as waiting, not as a build that stopped reporting.
- `documentation`: the page on self-hosted runners explains the limit of a machine shared by several repositories and how to give builds their own runners.

## Impact

- Code: `scripts/lib/config.mjs`, `scripts/lib/init.mjs`, `scripts/lib/doctor.mjs`, `scripts/validate-config.mjs`, `scripts/progress.mjs` and `scripts/lib/progress.mjs`, `scripts/lib/status.mjs`, `scripts/lib/messages.mjs` (English and Spanish), and their tests.
- Content: `templates/workflows/relevo-go.yml` (the `runs-on` of the build job, the progress comment in the decision job, the report of a cancelled wait), `templates/relevo.yml`, `skills/init`, `skills/doctor`, `skills/status`, `docs/execution.md` and `docs/configuration.md` in both languages.
- Compatibility: none broken. A repository without `runner.build_labels` behaves as today, and a workflow already installed stays valid.
- Order: independent of `split-ready-and-go` and of `rename-qa-failed-label`; all three touch `relevo-go.yml`, `init` and `doctor`, so each one that is built later rebases on the earlier ones.

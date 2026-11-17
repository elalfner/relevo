# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- **One setting, written everywhere.** `runner.labels` (`scripts/lib/config.mjs`, a `label-list` that defaults to `ubuntu-latest`) is written by `init` into the `runs-on` of every job of every Relevo workflow, because `runs-on` is read before any step and a workflow cannot read `relevo.yml`. `doctor` compares each file with the setting, and resolves a `runs-on` that comes from a repository variable.
- **The `go` workflow has three jobs.** `decide` (10 minutes, the gates and the claim), `build` (60 minutes, the toolchain and the agent) and `requeue` (5 minutes, `if: always()`, which starts the queue after a build). Only `build` is heavy. `ship` can last 45 minutes but only waits for checks.
- **The progress comment starts in the build job.** `progress.mjs watch` is started by a step of `build`, creates the comment and edits it every 30 seconds. `writeProgress` first looks for an open comment with the marker and edits it if there is one. `run_max_minutes` is measured from the start that the watch records, so the wait for a runner is not counted.
- **The last word is a step of the build job.** The step that always runs and reports a run with no outcome is in `build`. A job that is cancelled while it waits for a runner runs none of its steps, so today such an issue stays `building` with nothing said.
- **`status` alerts on age.** An issue on `building` with no activity for `building_alert_hours` is reported as a build that stopped reporting.
- This design is written on top of `rename-qa-failed-label` (`build-failed`) and does not depend on `split-ready-and-go`; where both touch a file the later one rebases.

## Goals / Non-Goals

**Goals:**
- A repository can put builds on their own runners with one optional setting, and `doctor` agrees with it.
- A build that waits for a runner is visible as waiting, on the issue and in `status`, and never ends as a failed build for that reason.
- No repository that does not set the new key sees any change.

**Non-Goals:**
- A limit of builds across repositories enforced by Relevo: the runners give it.
- Reading which runners exist or are free: that needs administration permissions the workflow does not have.
- A setting for the workflows of the project, or separate runners for each light workflow.

## Decisions

- **D1. `runner.build_labels` is a second `label-list` with no default.** The effective runner of the build job is `runner.build_labels ?? runner.labels`, computed in one helper that `init`, `doctor` and `validate-config --effective` share. Absent, every code path gives what it gives today. Alternative considered: a map of job to labels; rejected because only one job is heavy and a map invites configuring what does not matter.
- **D2. The template marks the build job.** `relevo-go.yml` keeps `runs-on: ubuntu-latest` in its three jobs; `init` rewrites the `runs-on` of the job named `build` with the build labels and the others with `runner.labels`. `doctor` reads the `runs-on` per job with the same rule, so a file edited by hand to separate the build job passes once `runner.build_labels` says the same. The check that resolves a `runs-on` taken from a repository variable applies per job as well.
- **D3. The decision job opens the progress comment.** After it claims the issue, `decide` runs `progress.mjs waiting --issue <n>`, which creates the comment with the marker, the text that the build waits for a runner, and a second hidden marker that says it is in that state. The watch of the build job finds the comment through `writeProgress`, as it finds one today, and its first edit drops the waiting marker. Nothing else of the watch changes. Alternative considered: a separate comment for the wait; rejected because the issue is meant to carry one progress comment.
- **D4. The waiting marker is how "never started" is known.** The `requeue` job, which always runs and runs on the light runners, gains one step before it starts the queue: when the issue is `building` and its progress comment still carries the waiting marker, the build job ran no step. The step returns the issue to `queued`, replaces the comment by one line (no runner took the build) and leaves the rest to the queue. It does not read the result of the build job, so it does not depend on how GitHub names a cancellation. A build that started has no waiting marker and is left to the reports that exist. Alternative considered: `needs.build.result == 'cancelled'`; rejected because a job cancelled while running has the same result.
- **D5. `status` reads the same marker.** For an issue past the alert time, `status` reads its progress comment: with the waiting marker it reports a wait for a runner, with the hours since the claim; without it, the alert of today. One request per issue past the alert time, none for the others.
- **D6. The advice of `doctor` is computed from files.** It lists the workflows of `.github/workflows/` on the default branch that are not Relevo's and compares their `runs-on` with the effective labels of the build job, as sets of labels. It never fails for it and changes no file. The advice about shared runners is given only when the labels are self-hosted (they are not `ubuntu-latest` or another `*-latest` image), because on the runners of GitHub each job gets its own machine.
- **D7. The queue is not changed.** A claimed issue is `building` and already counts against `limits.concurrent_agents`, so the builds that wait for a runner are bounded per repository; GitHub orders them.
- **D8. Antigravity needs nothing.** Its step replaces blocks inside the build job, so it runs where that job runs. The documentation says that its build runner must be Linux x86-64, which the step already requires.

## Risks / Trade-offs

- [The runner is offline for days] → the issue returns to `queued` each time GitHub gives up, the queue dispatches it again, and it waits again; `status` reports the wait after the alert time, long before the first cancellation.
- [GitHub's time limit for a waiting job is assumed, not measured] → the behaviour does not depend on the number; a task confirms it in the documentation of GitHub and writes it in the page on runners.
- [The decision job posts the comment and the build never comes because the workflow was edited] → the same path: the `requeue` job finds the waiting marker and returns the issue to `queued`.
- [A person labels no runner for builds after setting the key] → the build job waits; the comment says so at once, which is the point of D3.
- [Two more requests to GitHub per build] → one comment created earlier instead of later, and one read in the `requeue` job.
- [Same files as `split-ready-and-go` and `go-visibility`] → `relevo-go.yml`, `progress.mjs`, `init` and `doctor`; the changes are in different jobs and functions, and the later one rebases.

## Migration Plan

1. No migration for a repository that does not set `runner.build_labels`: an installed workflow stays valid.
2. To adopt it: label one or more runners for builds, set `runner.build_labels`, run `/relevo:init` (it rewrites the `runs-on` of the build job) and `/relevo:doctor`. Move the checks of the project to labels the build job does not use, by hand.
3. Rollback: remove the key and run `/relevo:init`.

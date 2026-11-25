# Design

## Context

See `proposal.md` for the motivation. What the code has today:

- `resume-check.mjs` (`lib/resume-check.mjs`, `resumeState`) already decides whether a branch can be continued: `absent`, `resume` or `existing` with a reason. It takes an injected `git(args)` and a `local` flag, so it also reads a branch of a files project. Today only the skill of `go` calls it, in step 2, after the issue is claimed.
- The planner (`plan.mjs`, `go-plan.mjs`) treats `--retry` as a stand-in for `ready` (`isRetry`) and refuses it when a branch exists (`retryRefusal`). A `go` label on a `build-failed` issue is a retry when `has_branch === false`, and answers `go_use_fix` when it is `true`. `has_branch` is read with `matching-refs`, so the `decide` job needs no checkout.
- `next-step.mjs` has one `build-failed` variant, `kept`, for every branch that holds work: QA rejected it, or the run stopped at a limit. `messages.mjs` already knows the two cases apart (`reason === 'run limit reached'`, `branch_state === 'kept'`) and already prints `tasks_done` of `tasks_total`.
- The comment of a stop carries no hidden marker, except the usage-limit retry (`relevo:retry`), which `limit-retry.mjs` reads from comments of a bot only.
- The limits are `limits.run_max_turns`, `limits.run_max_minutes` and `limits.run_max_cost` in `relevo.yml`.

## Goals / Non-Goals

**Goals:**
- One word for each of three situations: continue a stopped build (`--resume`), build again from the beginning (`--retry`), correct what QA rejected (`fix`).
- The refusal of something that cannot be resumed happens before the issue is claimed, so a refused resume leaves the issue `build-failed` with no comment from a run that never started.
- A resume cannot loop forever against the same limit.

**Non-Goals:**
- A new mechanism to resume: the check, the checkpoints and the skipped specification stay as they are.
- `--restart`, and a runner that stopped answering (see the proposal).
- Changing what `go` does inside a resumed run beyond recording where it started.

## Decisions

- **`--resume` is a second mode of the planner, next to `--retry`.** It reuses the stand-in for `ready` and the gates of a retry (`startedBy`, the text unchanged since approval, dependencies). The difference is the branch: `--retry` needs none, `--resume` needs one that the check accepts. Alternative considered: relaxing `--retry` to continue when a branch exists. Rejected: `--retry` reads as "from the beginning" and the same flag would do opposite things depending on a branch the person may not remember.
- **The planner asks the check before it claims.** For a local run it fetches the branch and calls `resumeState` as the skill does. For the `decide` job, which has no checkout, a small adapter answers the `git log` call of `resumeState` from the REST API (the commits of `feature/<n>-*` over the base, with subject and body, so the hash trailer is there). When the adapter cannot read the branch the planner reports it and builds nothing, as it does today for an unknown `has_branch`. The check in step 2 of the `go` skill stays, for a branch that moved between the decision and the run; it ends in `branch already exists` as before. Alternative: leave the check to the run. Rejected: a refused resume would claim the issue, start a runner and comment, only to put it back.
- **The refusal says why and where to go.** The reasons that `resumeState` already returns are mapped to a step: changed text goes to `/relevo:issue`, a rejection goes to `/relevo:fix`, a foreign commit or a specification-only branch goes to the delete command and `--retry`. `retry-refusal.mjs` keeps one place for these texts and, when the branch is resumable, a refused `--retry` points to `--resume` instead of `fix`.
- **The next-step table gets the variant `resume`.** `messages.mjs` picks it when the reason is `run limit reached` and the branch state is `kept`; every other `kept` stays `kept`, and `partial` stays `fix` because the refused group would be refused again. The command is `/relevo:go {n} --resume`, the hint names the cloud way (the `go` label) and the progress line comes from `tasksInfo`, which already omits the figure when it is unknown. A test keeps both languages and the table in step, as it does for every reason.
- **Progress is measured in tasks, not attempts.** A resumed run records how many tasks were done when it started (the tasks that `openspec instructions apply` reports done at step 4, recorded in the run state outside the working tree, like the phase announcements). At the failure path it compares them with the tasks done at the end. Equal, and the reason is `run limit reached`: the comment uses the variant `stalled` (no command, hint: raise a limit or split the issue) and carries a hidden marker `<!-- relevo:stalled {...} -->` with the three limits in force, built from checked numbers and never from text. Alternative: a fixed cap of three resumes. Rejected: it stops an issue that advances and lets one that does not advance spend three runs.
- **The marker lifts when a limit is raised.** The planner reads the last `build_failed` comment of a bot; when it carries the marker, a `--resume` or `go` label is refused unless one of the three limits of `relevo.yml` is higher than the recorded one. Splitting the issue changes its text, so the check answers `existing` and the refusal takes the person to `/relevo:issue` and then to the delete command and `--retry`. A newer comment replaces the marker, so a resume that did progress and stopped again carries none.
- **`fix` warns and does not refuse.** `fix` already works on a limit commit. It now says first that `--resume` continues the build and goes on only if the person wants to correct the work. Refusing would take away a path that works and that some people use.
- **A files project follows the same rule.** `planFiles` takes `resume` as it takes `retry`, and the check runs with `local: true` on the local branch. The messages of a files project already leave out mentions that do not exist.
- **The words go with the change.** `GLOSSARY.md` gets resume, retry and fix with the words to avoid; the three pages of documentation and their Spanish versions describe the three apart.

## Risks / Trade-offs

- [The REST adapter reads the branch differently from `git log`, so the cloud and the local run disagree] → one test feeds the same fixtures to both and compares the answers, and an unreadable branch builds nothing.
- [A stalled marker blocks a person who fixed the cause outside `relevo.yml`, for example a failing tool] → the message names exactly which limits it compares and says that deleting the branch and running `--retry` starts over.
- [A resume after a long time finds the base branch moved] → the run integrates the base branch as any build does at the end, and a conflict stops it with the usual reason.
- [Repositories keep the workflow of an older version] → they get the cloud label behaviour when they raise `RELEVO_VERSION`; until then the label answers `go_use_fix` as before. The local flag and the comments come with the plugin.
- [Two resumes at once for one issue] → the claim moves the issue to `building`, which already stops a duplicate, and the workflow keeps one run per issue.

## Migration Plan

Nothing to migrate. A comment posted before this change keeps its `fix` next step and no marker, so it blocks nothing. After the release each repository raises `RELEVO_VERSION` in `relevo-go.yml`. Rolling back is raising it back.

## Open Questions

- The exact wording of the `stalled` hint is left to the messages task and the tests that read it.

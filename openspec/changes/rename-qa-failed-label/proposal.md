# Proposal

## Why

The `qa-failed` label names one cause and is used for every build that does not end in a hand-off: QA rejected the work after the retries, the run stopped at a turn, cost or time limit, the checks could not run or a tool was missing on the runner, the text of the issue changed, the branch already existed, the diff held a protected path or a possible credential, the base branch conflicted, or the run ended with no outcome at all. Its description says "QA still rejected after the retries; branch is pushed", which is false for most of them. The comment already says the real reason, every run records a class of outcome, and the specification already asks that a stop that is not a QA rejection is not reported as one, but the label a person reads in the list of issues still says QA.

The labels are the interface of the plugin, and `split-ready-and-go` already changes them before the first public release. This is the moment to make the name true as well: afterwards it would break every installed workflow and every renamed label.

## What Changes

- **BREAKING: the `qa-failed` label becomes `build-failed`.** It marks a failed build: a build that ended without a hand-off, whatever the reason. It stays one label, a side exit owned by the assignee. It is not split into one label for a QA rejection and another for the rest: what a person needs is what to do next, and that follows from whether the branch holds code (`fix`) or not (build it again), not from whether the reason was QA. The comment keeps saying the reason and the next step.
- **The old name disappears everywhere, with no alias.** The key of the label in `relevo.yml` (`labels`), the label set, the planner, the messages in English and Spanish, the workflow templates, the skills and the documentation use `build-failed`. `qa-failed` is not accepted as a synonym: a `relevo.yml` that still renames `qa-failed` fails validation with a message that names the new key.
- **The description of the label says what it marks**: the build did not end in a hand-off, and the comment says why and what to do.
- **Existing labels are renamed, not replaced.** `init` renames the `qa-failed` label of a repository to the new name instead of creating a second one, so the issues that carry it keep it. `doctor` reports a repository that still has the old label, and a workflow that still names it, and points to `init`.
- **The reasons and the classes are not renamed.** The reasons written in the comments (`QA rejected after the retries` and the others) and the classes of outcome that describe a real QA rejection (`qa-non-fixable`, `qa-fixable-after-retries`) say what happened and stay as they are.
- **The glossary gains the term** failed build, and the documentation uses it instead of "a `qa-failed` issue".

Not in this change: a second label for the builds that left no code; any change to which problems end a build, to what is pushed, or to what `fix` and a retry accept; the names of the other labels.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue-lifecycle`: the side exit is `build-failed`, a failed build with its owner and its message; the requirements that name `qa-failed` (the side exits, the issue with no branch that is rebuilt, the stop that is not a QA rejection) use the new name.
- `go`: unrecoverable problems end in `build-failed`; the labels that follow the run, the failure comment, the retry of an issue with no branch and the work kept at a limit name it.
- `fix`: what `fix` accepts and refuses names `build-failed`.
- `execution-modes`: the local retry of a failed build names it.
- `usage-limit-retry`: what an issue becomes when its retries are used up.
- `security`: the outcome of an issue that changed after the approval, and of a restricted file in the output of a run.
- `issue`: the labels that close an issue to editing.
- `status`: the states it lists and the hint for each.
- `ship`: the lifecycle labels it removes.
- `platforms` and `role-skills`: the scenarios that end a build name the new label.
- `init-doctor`: `init` renames the existing label; `doctor` reports the old label and a workflow that still names it.
- `configuration`: the key of the label in `labels`, and the old key refused with a message.

## Impact

- Code: `scripts/lib/labels.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/github.mjs`, `scripts/go-plan.mjs`, `scripts/lib/fix-guard.mjs`, `scripts/lib/failure-comment.mjs`, `scripts/lib/can-edit-issue.mjs`, `scripts/lib/next-step.mjs`, `scripts/lib/status.mjs`, `scripts/lib/stages.mjs`, `scripts/lib/ship.mjs`, `scripts/lib/messages.mjs`, `scripts/lib/config.mjs`, `scripts/lib/init.mjs`, `scripts/lib/doctor.mjs`, the other scripts that name the label, and their tests and fixtures: the name appears in 38 files of code, skills, templates and documentation.
- Content: `templates/workflows/relevo-go.yml` (it names the label in each of its failure steps), `templates/agents/antigravity-step.yml`, `templates/relevo.yml`, `skills/go`, `skills/fix`, `skills/status`, `skills/issue`, `docs/` in both languages, `GLOSSARY.md`.
- Release: a breaking change to the label interface, in the same version as `split-ready-and-go`, with the migration in `CHANGELOG.md`: update the workflow files and run `init`, which renames the label.
- Order: it is built first. It is mechanical and wide, and every change that touches `relevo-go.yml`, the planner or the messages conflicts with it, so `split-ready-and-go` and `build-runner-labels` are written on top of it and use the new name from the start.

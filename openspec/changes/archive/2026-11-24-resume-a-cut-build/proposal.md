# Proposal

## Why

When a build stops at a limit (turns, minutes, cost, a cut or a timeout), `go` keeps the work as `wip: stopped by limit (#N)` and leaves the issue `build-failed`. The comment then says the next step is `/relevo:fix <n>`. That is the wrong word: nothing was rejected and nothing needs correcting, the build is unfinished. `fix` only works as a continuation because its skill happens to read that commit and treat the open tasks as what is left.

The ability to continue already exists in `go` (`resume-check.mjs` answers `resume` for a branch that holds checkpoints or a limit commit with the hash of the issue text), but the only ways to reach it are not visible. The `--retry` flag, which a person reads as "start again from the beginning", refuses when a branch exists and sends the person to `fix`. The `go` label on a `build-failed` issue with a branch answers `go_use_fix`. Making the issue `ready` again and then running `go` does resume, and no message says so. Nobody finds it from the comment.

## What Changes

- **`/relevo:go <n> --resume`** continues a build that stopped before it finished. It takes the `build-failed` issue and its branch, builds only the pending tasks and writes no specification. It uses the check that `go` already uses (`resume-check.mjs`) and goes through the same gates as `--retry` (a person with write access, the text unchanged since the approval, the dependencies merged). `--retry` keeps its meaning: build again from the beginning, only when the issue left no branch.
- **The `go` label in the cloud resumes** a `build-failed` issue whose branch `resume-check` accepts. When the branch cannot be resumed, the label keeps the answer it has today (`go_use_fix`). Local and cloud follow one rule.
- **A branch that cannot be resumed is refused without touching anything.** The planner runs the check before it claims the issue, names why (the text of the issue changed, a commit that is not Relevo's, work that QA rejected, only the specification) and the step that fits: `/relevo:issue` after a change of text, `/relevo:fix` for rejected work, the command that deletes the branch followed by `--retry` for a branch with someone else's commits.
- **A build that stopped at a limit says `--resume`.** The `build-failed` comment of a run that stopped at a limit with its work kept names `/relevo:go <n> --resume` as the next step (in the cloud, applying the `go` label), with how many tasks are done (`4 of 9`). The next-step table gets a variant of its own for it, separate from `kept`, which keeps `fix` for the work that QA rejected. A refused checkpoint after earlier ones were pushed (`partial`) keeps `fix`.
- **A resume that makes no progress stops the loop.** When a resumed run stops again at a limit without finishing any task, its comment says that resuming again will not help and what to change (raise the limit in `relevo.yml`, or split the issue), and the next `--resume` and the `go` label are refused until the limits in `relevo.yml` are higher than the ones that were in force.
- **`fix` says so when the work is an unfinished build.** When the last commit is `wip: stopped by limit` or a checkpoint, `fix` tells the person that `/relevo:go <n> --resume` continues it, and goes on only if the person wants to correct the work instead.
- **Words.** The documentation and the messages (English and Spanish) call these three things apart: resume (continue a cut build from its branch), retry (build again from the beginning, with no branch) and fix (correct what QA rejected). The terms go into `GLOSSARY.md`.

Out of scope: a `--restart` that deletes the remote branch and builds from the beginning (today it is a manual `git push origin --delete` followed by `--retry`; the refusals print that command); a build whose runner stopped answering and that stays `building` (the `requeue` job and `status` handle it); counting the cost of a build across resumes; resuming work that QA rejected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the `--resume` flag, the cloud label that resumes, the refusal of a branch that cannot be resumed, and the stop of a resume that makes no progress.
- `issue-lifecycle`: the next-step table gets a variant of `build-failed` for a build that stopped before it finished, and the comment of a stop at a limit names it with the tasks done.
- `fix`: a branch that ends at a limit commit or a checkpoint points to `--resume` before it corrects.
- `documentation`: the pages that describe `go`, the commands and the failure comments use the three words apart, in English and Spanish.

## Impact

- `scripts/lib/plan.mjs`, `scripts/go-plan.mjs` and `scripts/go-local.mjs` (the flag, the cloud label and the refusal before the claim), `scripts/lib/retry-refusal.mjs` (the refusals of `--resume` and the messages of `--retry`), `scripts/lib/resume-check.mjs` and its wrapper (read by the planner), `scripts/lib/next-step.mjs` and `scripts/lib/messages.mjs` (the new variant and the progress line, both languages), `scripts/lib/failure-comment.mjs` and the marker of the `build_failed` comment (tasks done at the start and at the end of a resumed run, and the limits in force).
- `skills/go/SKILL.md` (the `--resume` argument, the failure path that records the progress of a resumed run), `skills/fix/SKILL.md` (the note about an unfinished build), `templates/workflows/relevo-go.yml` only if the `decide` job must pass the resume decision on (its header otherwise).
- `docs/commands.md`, `docs/execution.md`, `docs/guide.md` and their `.es.md` versions, `GLOSSARY.md`, `CHANGELOG.md` (unreleased).
- Tests: `tests/plan.test.mjs`, `tests/go-plan-output.test.mjs`, `tests/go-local.test.mjs`, `tests/retry-refusal.test.mjs`, `tests/resume-check.test.mjs`, `tests/next-step.test.mjs`, `tests/messages.test.mjs`, `tests/messages-language.test.mjs`, and the structure test that keeps both languages in step.
- No new permission, no new job and no new label. The cloud gets the change when a repository raises `RELEVO_VERSION` in its copy of the workflow. No version bump in this change.

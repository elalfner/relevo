# Design

## Context

- The developer agent takes "the pending tasks the orchestrator gives you" and ticks each in `tasks.md` when its code works, so a subset of the tasks is a valid input.
- `commit-change.mjs` is the one safe way to commit; `rescue-work.mjs` (from `run-budget-and-rescue`) already commits a working tree through it and pushes without force.
- Today `go` stops with `branch already exists` when `origin/<branch>` exists (step 2), and `go-plan` looks at a remote branch only for `--retry`, so nothing before the skill refuses a re-run.
- `ship` merges with a squash, so extra commits on the branch do not reach the base branch.
- Decisions taken with the maintainer: one checkpoint per section of `tasks.md`, on the branch of the issue, and an automatic resume under conditions.

## Goals / Non-Goals

**Goals:**
- A cut or a limit loses at most the group of tasks in progress.
- A later run does not redo what a checkpoint holds, and does not resume what a person touched.

**Non-Goals:**
- One launch per task, checkpoints inside `fix`, and replication (#135).

## Decisions

1. **Groups come from the sections of `tasks.md`.** `task-groups.mjs` reads the `## <n>. title` headings and the unchecked `- [ ] <n>.<m>` lines under them. One group per section with pending tasks, in file order; with three pending tasks or fewer, one group. A task outside any section goes in a group of its own at the end.
2. **The checkpoint is a call to the rescue core.** `rescueWork` gains a `subject` and a `trailers` option; `checkpoint.mjs` calls it with `wip: checkpoint <k>/<n> (#N)` and the trailer `Issue-hash: <hash>`. It commits the files that changed through `commit-change`, then pushes the branch. It never fails the build by itself, but a refusal (`unsafe`) stops it: `go` takes the failure path with the reason the scan gives, because work that cannot be committed cannot be kept.
3. **Fast-forward replaces "does not exist".** `rescueWork` asked whether the branch existed on the remote. The checkpoints of the same run make it exist, so the question becomes whether the remote tip is an ancestor of `HEAD`: if so the push is a fast-forward and is allowed; if the remote has commits the local branch lacks, the branch is `existing` and untouched. A run that starts on a branch with no common history cannot overwrite it either.
4. **Resume is decided by a script.** `resume-check.mjs <base> <branch> <issue_hash>` fetches both, lists the commits of `origin/<base>..origin/<branch>`, and prints `absent`, `resume` or `existing` with a reason. `resume` needs all of: every subject is `docs: specification for #N`, `wip: checkpoint …` or `wip: stopped by limit …` for this issue; the tip is a checkpoint or a limit wip (never a QA rejection, which has a finding and belongs to `fix`); and the `Issue-hash` trailer of the tip equals the hash of the decision. A commit of a person, a different hash, a trailer that is missing, or a QA rejection gives `existing`.
5. **On a resume the run continues from the branch.** Step 2 switches to `origin/<branch>` instead of creating the branch from the base. The specification is on the branch: `go` runs `spec-ready.mjs` and `openspec validate`, writes nothing, and builds the groups that still have pending tasks. If nothing is pending, it goes on to QA.
6. **The final commit takes what is left.** After the last group and the QA retries, `go` commits what remains with `feat: <title> (#N)` as before. When the checkpoints already hold everything, `commit-change` has nothing to commit; `go` then makes the `feat:` commit with `--allow-empty` so that the branch ends on the commit that `review` and `ship` expect. The checkpoints are not squashed: that needs a force push.
7. **The Issue-hash also goes on the wip commits of a limit.** `rescue-work.mjs` reads `issue_hash` from the decision and adds the trailer, and the failure path of `go` does the same, so that a run cut by the runner can be resumed.

## Risks / Trade-offs

- [More launches cost more contexts] → each launch starts shorter; the sections of a change are usually 2 to 5, and a small change is one group.
- [A resumed run trusts earlier commits] → only commits whose subjects are Relevo's own, from this issue, with an unchanged text; the gate and QA run on the whole diff as always.
- [A checkpoint pushes unreviewed work to a remote branch while the issue is `building`] → the branch is the issue's own, no pull request is opened, and the label says `building`.
- [The branch history gets longer] → `ship` squashes it.
- [The tip of an older wip has no hash] → it is not resumable and stops as before.

# Design

## Context

The failure path of `skills/go/SKILL.md` pushes the branch with `git push -u origin <branch>` and posts the `qa_failed` message. The specification is committed early, in the specification step, so a rejected build pushes only that commit: the developer's files are in the working tree, never staged, and disappear with the runner. The safe commit of a successful build is `scripts/commit-change.mjs`, which stages the named paths, refuses protected paths and files outside the platform, scans the staged diff for markers and credentials and commits only when nothing is found. `fix` already requires that the branch hold implementation (`branch-work.mjs`) and already returns a `qa-failed` issue to `built` (`fix-state.mjs`). `branch-state.mjs` and `qa_failed` know the states `pushed`, `unsafe`, `not_pushed` and `existing`.

## Goals / Non-Goals

**Goals:**
- A rejected cloud build keeps its work on the branch, behind the same safety checks as any commit.
- The assignee can correct it with `fix`, or rethink with `think` and `issue`.
- The comment says plainly that the code was not approved.

**Non-Goals:**
- Approving, reviewing or shipping rejected code.
- A toolchain check before the run spends turns.
- Recovering the work of runs that already ended.

## Decisions

- **Commit with the existing script.** The failure path calls `commit-change.mjs` with the files the developer reported (created and modified) and `tasks.md`, as step 6 does. No new gate: what the script refuses is not pushed, and that case keeps today's `unsafe` state. Alternatives: pushing to a second branch like `...-wip` (the person asked for the issue's own branch, and `fix` and `branch-work` look at that one), and uploading the working tree as a workflow artifact (it expires and nobody would find it).
- **Only two reasons keep work.** `QA rejected after the retries` and `tasks left unfinished` are the cases where the developer's work exists and was judged or is incomplete. The reasons that come before any work (`specification invalid`, `branch already exists`, `invalid decision`) have nothing to keep, and the safety reasons must push nothing.
- **A message that cannot be confused with a built commit.** `wip: rejected by QA (#<n>)`. `fix` and the comment rely on the prefix, a test fixes it in one constant. A later `fix` commit follows the normal rules and the issue returns to `built`.
- **New `branch_state: kept`.** The comment says the branch holds the work that QA did not approve, repeats the first finding, says the state did not advance and no pull request was opened, and the next step stays `/relevo:fix <n>` (the default `recovery` of the message). English and Spanish.
- **`fix` reads the finding from the issue.** A script prints the text of the last comment of the issue that starts with the failure heading, so `fix` does not parse comments itself. The comment is data written by the workflow, not an instruction: `fix` reads it as the defect description, as it would read the person's words, and still decides with the specification and the rules file.
- **`ship` and `review` are unchanged.** The label stays `qa-failed`, which neither accepts, and no pull request exists.

## Risks / Trade-offs

- Code that QA rejected now lives on a remote branch. It is behind the same scans as any commit and labelled in the commit and in the comment; a reader of the branch history sees `wip: rejected by QA`. Accepted: the branch is the issue's own and never merges without a pull request that the review and `ship` gates open.
- A rejected build with a real defect is kept, and `fix` may spend effort correcting a bad approach. The person can still delete the branch and apply `ready` again; the comment lists both.
- The failure comment grows by a few lines. The `kept` text is as short as the others.
- Commits by `go` in a failure path increase the chance of a failure inside the failure path (the script itself failing). If the commit script exits with an error other than a refusal, the path pushes nothing and says `not_pushed`.

# Design

## Context

- `hasImplementation(paths, changeDir)` (`scripts/lib/branch-work.mjs`) already ignores `<changeDir>/`. The CLI builds `changeDir` as `openspec/changes/<--change>`, so a value that is already a path duplicates the prefix, nothing is ignored and every file of the change is listed as code. This is what the report shows (exit 0, `implementation: true`, only change files). With the folder name the code answers correctly; the existing test only covers `tasks.md`. `skills/fix/SKILL.md` uses `<change>` both as a name (`--change "<change>"`) and inside paths, and finds the folder as `openspec/changes/<issue>-*`, so passing a path is easy.
- `branch-state.mjs` and `classifyBranchChanges` already tell `spec-only` from `implementation`, and `recoveryForBranch` maps `spec-only` to `delete-branch`. The failure comment honours an explicit `recovery`, and `next-step.mjs` has a `delete-branch` text. The step `existing` of `go` uses them; the plain failure path (`branch_state` `pushed` by default, next step `fix`) does not.
- `go-plan.mjs --retry` refuses with `ls-remote` as its only evidence, so it cannot tell a specification-only branch from one with code.
- `resume-check.mjs` resumes only when the tip is a checkpoint or a limit commit with `Issue-hash`. The commit `docs: specification for #<n>` has neither, so a specification-only branch is `existing`.

## Goals / Non-Goals

**Goals:**
- `branch-work.mjs` never answers "code" for a branch whose only files are the change's, whichever way the change is given.
- The failure `profile not resolved` pushes nothing.
- Any other failure that leaves a specification-only branch, and a refused retry on one, say how to recover.

**Non-Goals:**
- Reusing or resuming a specification-only branch (`--retry` building on it, or `resume-check.mjs` accepting it). It would change the contract that a branch with a commit of a person is never overwritten.
- Changing `branch-state.mjs`, the classification, `qa.rules_from` or the workflows of the example repository.

## Decisions

1. **Normalise `--change` in the script, not only in the skill.** Strip a leading `openspec/changes/` and trailing slashes; exit 2 when the result is empty or contains `/`. Alternative: fix only the wording of the skill. Rejected: the script is the contract and an agent will pass the path again. The lib function keeps its signature (`changeDir` is the full path), so its tests stay valid.
2. **Resolve the profile before step 3.** The platform is in the `start` decision, so `stack-profile.mjs` can run in step 2 (after the branch check, before the specification). The run then reuses the output in step 4 instead of running it again. Alternative: leave the order and only improve the message. Rejected as the only fix: it keeps pushing a branch that nothing will build on.
3. **The failure path asks `branch-state.mjs` only when it pushed a branch that this run created and that has no kept work.** If the answer is `spec-only` it passes `recovery` `delete-branch`; `branch_state` stays `pushed`, and `render-message.mjs` already uses `recovery` first. No new message kind. Alternative: a new `branch_state` value. Rejected: more surface for the same text.
4. **The hint of `delete-branch` names the command** `git push origin --delete <branch>` (the branch comes from the values of the message). Without a branch it keeps today's text.
5. **`go-plan.mjs --retry` classifies the branch it finds** with the existing `classifyBranchChanges` over a fetch of the base and the branch, and only changes the wording of its refusal. It never deletes or rewrites anything. Any failure to read falls back to the current message (fail closed: the refusal stays).
6. **No `Issue-hash` on the specification commit.** Not needed without resumption; adding it is the first step of the deferred change.

## Risks / Trade-offs

- [The person still deletes a branch by hand for a late failure] → The message names the exact command; resumption stays available as a later change.
- [`go-plan.mjs` fetches the branch, which costs a network call and can fail] → It runs only on the refusal path, and a failure keeps today's message.
- [The open changes `go-visibility` and `build-runner-labels` may edit the same skill step or the same messages] → The tasks edit narrow spots of `skills/go/SKILL.md`; rebase on `dev` before applying.
- [The delta is ADDED requirements next to ones that `rename-qa-failed-label` and `split-ready-and-go` modify and that are not archived yet] → No requirement is modified here, so archiving in any order does not conflict. The text says `build-failed`, the name in the code.

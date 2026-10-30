---
name: ship
description: Closes the loop on a reviewed issue. After confirming the pull request qualifies (approved by someone else, checks passing, no conflicts) and the person confirms in writing, it archives the change specification, squash-merges, closes the issue and tidies up. It never approves anything. Use only when asked to ship a specific issue. It merges code, so it never starts on its own.
argument-hint: "[issue-number]"
disable-model-invocation: true
---

# Relevo ship

Merge the pull request of the issue `$ARGUMENTS` and close the issue. This is the step that cannot be taken back, so it happens only after a script confirms the pull request qualifies **and** the person confirms in writing.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the rules that must not vary (whether a pull request may be merged, what the archive may touch, scanning, labels); use them instead of judging those things yourself.

## What you must never do

- Never approve a pull request. Approval is a person's decision, made in GitHub before you run.
- Never merge, archive or push anything before the person's written confirmation.
- Never bypass branch protection, required checks or required reviews: no `--admin`, no `--auto` to sidestep a rule, no merging while `ship-check` says to stop.
- Never use `git add .` or `-A`, never force-push, and never ship a pull request you did not look up from the issue's own branch.
- Never create or release anything on the release branch. Releasing is a separate pull request.

## Steps

### 0. Preflight

Stop with a clear message, changing nothing, if any of these fails:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` exits non-zero. Show its output.
- `openspec --version` does not run. Tell the person to run `/relevo:doctor`.
- `gh auth status` fails: ship needs the GitHub command line to read and merge the pull request.
- The working tree has uncommitted changes.

Find the repository (`$GITHUB_REPOSITORY`, or `gh repo view --json nameWithOwner -q .nameWithOwner`), the person running this (`gh api user --jq .login`), the issue's branch (`git branch -r --list "origin/feature/$ARGUMENTS-*"`) and its change folder (`openspec/changes/$ARGUMENTS-*`).

### 1. Check that it qualifies

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/ship-check.mjs --repo <owner/name> --branch <branch> --invoker <login> --issue $ARGUMENTS --labels "<the issue's labels, comma separated>"
```

It prints a decision and exits 0 when the pull request may be merged, 1 when it must stop. On exit 1, show the person every reason and stop, changing nothing. The reasons say what to do: run the command that is missing (the issue must be `pr-open`: `/relevo:review` or `/relevo:fix`), open the pull request, wait for an approval on the current code, resolve requested changes, synchronise the branch, wait for the checks, or let an eligible person run ship (a member of the team who is not the author or the spec writer).

Record the head the approval was given on, to use after the archive: `git fetch origin <branch>` then `git rev-parse origin/<branch>`. Call it `<baseline>`.

Then scan what will be merged. First ask whether another worktree holds the branch, because `git switch` refuses it with an error that names nothing: `node ${CLAUDE_PLUGIN_ROOT}/scripts/branch-worktree.mjs --branch <branch>`. If it exits 1 it prints the path of that worktree (a run of `go` that failed keeps its worktree, for example): stop before anything is archived, pushed or merged, say that the branch is held by that worktree and its path, and that the person can ship from there or remove it with `git worktree remove` and run ship again. If the scan reports anything, stop and show the file and line:

```bash
git fetch origin <base> <branch>
git switch <branch>
git pull --ff-only origin <branch>
git diff origin/<base>...HEAD | node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-diff.mjs
```

### 2. Confirm, in writing

Show the person a summary from the decision: the pull request (number, title, author), who approved, the state of the checks, and what will happen next: the specification will be archived and pushed to the branch, the pull request will be squash-merged into `<base>`, the issue will be closed and the branch deleted.

If the decision's `confirm` list includes `not-approver`, the person running ship did not approve this pull request. Say so, and ask them to confirm in writing that they run it without having approved it.

If the decision's `confirm` list includes `no-ci`, say plainly that the repository has **no checks**, so nothing but the review vouches for this code, and ask about that explicitly as well.

Wait for a clear written yes. If the person does not confirm, **stop: nothing is archived, pushed or merged.**

### 3. Archive the specification

First see whether it is already archived (a previous `ship` archived and pushed it, and the merge then failed):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/archive-state.mjs --change "<change folder name>"
```

It prints `archived` (skip the rest of this step and go to step 4), `active` (go on) or `missing` (exit 1: stop and say the change cannot be found).

Before archiving, validate the change and check that no task is open:

```bash
openspec validate "<change folder name>"
node ${CLAUDE_PLUGIN_ROOT}/scripts/fix-tasks.mjs --file openspec/changes/<change folder name>/tasks.md --stage after
```

If either fails, stop before archiving and show what it printed.

```bash
openspec archive "<change folder name>" -y
node ${CLAUDE_PLUGIN_ROOT}/scripts/check-archive.mjs
```

The check exits non-zero if the archive changed anything outside `openspec/`, or changed nothing. In that case stop and show its message. Do not commit.

Otherwise stage and commit it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/stage.mjs openspec/changes openspec/specs
git commit -m "chore(openspec): archive <change folder name> (#$ARGUMENTS)"
git push origin <branch>
```

Do not add links to this session or attribution lines to the commit.

### 4. Check again

The push may start new checks or dismiss an approval. Wait for any running checks (`gh pr checks <number> --repo <owner/name> --watch`), then run `ship-check.mjs` again, exactly as in step 1 and adding `--baseline <baseline>`, so an approval given on the head before the archive still counts. When the archive commit has no checks of its own and changes only `openspec/`, `ship-check` judges the checks of `<baseline>` instead, and its summary says `checksFrom: baseline`; do not ask about `no-ci` then. If it now says the pull request has conflicts, see below. If it says anything else to stop, show the reasons and stop. The most common one is an approval dismissed by the push: tell the person that the repository must not dismiss approvals on new commits (`/relevo:doctor` checks it).

**The archive left conflicts.** If the only reason is `CONFLICTING`, the base branch changed the specifications the archive wrote. Recover with normal pushes only, never a force-push:

1. `git revert --no-edit <the archive commit>`, then `git merge origin/<base>`. If the merge conflicts, `node ${CLAUDE_PLUGIN_ROOT}/scripts/conflict-scope.mjs` says whether every conflicted file is under `openspec/`. If it exits 1, run `git merge --abort`, show the files and stop: a conflict in code is for the author.
2. Archive again on top of the updated specifications (`openspec validate`, `openspec archive`, `check-archive.mjs`, stage, commit, as in step 3) and `git push origin <branch>`.
3. The head has moved by more than the archive, so do not pass `--baseline`: run `ship-check.mjs` as in step 1. If the repository does not dismiss approvals, the approval of the old code is reported as given on an older commit and a new approval is needed; say so and stop.

### 5. Merge

```bash
gh pr merge <number> --repo <owner/name> --squash --delete-branch --subject "<the pull request title>" --body "Issue #$ARGUMENTS"
```

The subject is the pull request title, which already ends with the issue number. The body holds only the reference to the issue: no list of commits, no links, no attribution lines.

### 6. Close out

1. Close the issue explicitly if it is still open: `gh issue view $ARGUMENTS --json state,stateReason`, then `gh issue close $ARGUMENTS --reason completed`. GitHub only closes an issue by itself when the merge goes into the repository's default branch, and the base branch here usually is not.
2. Remove every Relevo label: `node ${CLAUDE_PLUGIN_ROOT}/scripts/label-change.mjs --clear --current "<current labels>"`, applied with `gh issue edit`.
3. Tidy the local copy, but only where that is possible: in the main checkout, when no other worktree holds the base branch.

   ```bash
   [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] && ! git worktree list --porcelain | grep -qx "branch refs/heads/<base>"
   ```

   If it succeeds, run `git switch <base>`, `git pull --ff-only origin <base>`, and `git branch -d <branch>` (ignore it if the branch is already gone). If it does not (a separate worktree, or the base branch is checked out elsewhere), run none of them, because `git branch -d` also fails on the branch the working tree is standing on: say which branch the working tree stays on. If one of the commands fails, say so as a note: the pull request is already merged, so it never changes the outcome or what the report says.

## Report

Finish with one short block: the issue, the pull request, the merge commit, that the issue is closed and the labels removed.

End with this reminder: promoting `<base>` to `<release>` is a separate pull request, with a version tag. `ship` does not do it.

When the repository has the ship workflow (`.github/workflows/relevo-ship.yml`), add one line: next time, the person who ships can apply the `relevo:ship` label to the issue instead, and GitHub ships it with the same checks, without a local copy.

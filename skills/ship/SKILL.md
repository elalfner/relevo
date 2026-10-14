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
node ${CLAUDE_PLUGIN_ROOT}/scripts/ship-check.mjs --repo <owner/name> --branch <branch> --invoker <login>
```

It prints a decision and exits 0 when the pull request may be merged, 1 when it must stop. On exit 1, show the person every reason and stop, changing nothing. The reasons say what to do: open the pull request with `/relevo:review`, wait for an approval, resolve requested changes, synchronise the branch, wait for the checks, or let the right person run ship.

Then scan what will be merged. If it reports anything, stop and show the file and line:

```bash
git fetch origin <base> <branch>
git switch <branch>
git pull --ff-only origin <branch>
git diff origin/<base>...HEAD | node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-diff.mjs
```

### 2. Confirm, in writing

Show the person a summary from the decision: the pull request (number, title, author), who approved, the state of the checks, and what will happen next: the specification will be archived and pushed to the branch, the pull request will be squash-merged into `<base>`, the issue will be closed and the branch deleted.

If the decision's `confirm` list includes `no-ci`, say plainly that the repository has **no checks**, so nothing but the review vouches for this code, and ask about that explicitly as well.

Wait for a clear written yes. If the person does not confirm, **stop: nothing is archived, pushed or merged.**

### 3. Archive the specification

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

The push may start new checks or dismiss an approval. Wait for any running checks (`gh pr checks <number> --repo <owner/name> --watch`), then run `ship-check.mjs` again, exactly as in step 1. If it now says to stop, show the reasons and stop. The most common one is an approval dismissed by the push: tell the person that the repository must not dismiss approvals on new commits (`/relevo:doctor` checks it).

### 5. Merge

```bash
gh pr merge <number> --repo <owner/name> --squash --delete-branch --subject "<the pull request title>" --body "Issue #$ARGUMENTS"
```

The subject is the pull request title, which already ends with the issue number. The body holds only the reference to the issue: no list of commits, no links, no attribution lines.

### 6. Close out

1. Close the issue explicitly if it is still open: `gh issue view $ARGUMENTS --json state,stateReason`, then `gh issue close $ARGUMENTS --reason completed`. GitHub only closes an issue by itself when the merge goes into the repository's default branch, and the base branch here usually is not.
2. Remove every Relevo label: `node ${CLAUDE_PLUGIN_ROOT}/scripts/label-change.mjs --clear --current "<current labels>"`, applied with `gh issue edit`.
3. Tidy the local copy: `git switch <base>`, `git pull --ff-only origin <base>`, and `git branch -d <branch>` (ignore it if the branch is already gone).

## Report

Finish with one short block: the issue, the pull request, the merge commit, that the issue is closed and the labels removed.

End with this reminder: promoting `<base>` to `<release>` is a separate pull request, with a version tag. `ship` does not do it.

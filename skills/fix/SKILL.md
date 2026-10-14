---
name: fix
description: Corrects a defect found in a built issue, specification first. It writes the corrected behaviour into the change's specification and task list, then runs the dev and qa agents, and only then commits and pushes. The issue keeps its place in the workflow. Use only when asked to fix a specific issue, with a description of what is wrong. It pushes code, so it never starts on its own.
argument-hint: "[issue-number] [what is wrong]"
disable-model-invocation: true
---

# Relevo fix

Correct a defect in the issue named at the start of `$ARGUMENTS`. The first word is the issue number; everything after it is the description of what is wrong. If there is no description, ask the person what is wrong before doing anything else.

The order matters and is checked by a script: **the specification is updated first, the code second.** In this session you never write application code yourself; the `relevo:dev` agent does.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the rules that must not vary (which state an issue returns to, the specification-first check, the tasks file edit, scanning, messages); use them instead of deciding those things yourself.

## What you must never do

- Never edit application code in this session, and never edit anything outside the change folder before the developer has run.
- Never change the project rules file (`qa.rules_from`) to make a defect fit. If the defect is a breach of a rule, the rule stays and the code is fixed.
- Never commit or push if QA still rejects after the retries: keep the changes in the working tree and tell the person.
- Never approve, merge or open a pull request, never use `git add .` or `-A`, never force-push, and never push to a branch other than the issue's own.

## Steps

### 0. Preflight

Stop with a clear message, changing nothing, if any of these fails:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` exits non-zero. Show its output.
- `openspec --version` does not run. Tell the person to run `/relevo:doctor`.
- The working tree has uncommitted changes.
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/fix-state.mjs --current "<the issue's labels, comma separated>"` exits 1. It prints why a fix cannot run in the issue's state. Keep its output: it tells you the state the issue returns to (`to`) and whom to notify.

Find the repository (`$GITHUB_REPOSITORY`, or `gh repo view --json nameWithOwner -q .nameWithOwner`), the issue's branch (`git branch -r --list "origin/feature/<issue>-*"`) and its change folder (`openspec/changes/<issue>-*`). If the branch is not on the remote, stop and say so: there is nothing to correct yet.

Switch to the branch: `git fetch origin <branch>`, `git switch <branch>`, `git pull --ff-only origin <branch>`.

### 1. Understand the defect

Read the description, the change's specification (`openspec/changes/<change>/specs/`) and the project rules file (`qa.rules_from` in `relevo.yml`). Decide which of these it is:

- the specification was wrong or missing a case: the specification needs correcting;
- the code does not do what the specification says: the specification still gets a scenario for the exact case that failed, because that scenario is what QA will verify;
- the defect breaks a project rule: say so to the person, and write a scenario that restores compliance. Do not touch the rules file.

If you cannot tell what the correct behaviour should be, ask the person. They are here.

### 2. Specification first

Update the change, writing no application code:

1. In the right capability under `openspec/changes/<change>/specs/`, add a `#### Scenario:` with `WHEN`/`THEN` lines that describe the corrected behaviour (or rewrite the scenario that was wrong, and say why in `design.md`).
2. In `design.md`, record a decision only if one changed. In `proposal.md`, change the scope only if it changed.
3. Add the correction tasks, one per distinct correction and each verifiable:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/add-corrections.mjs openspec/changes/<change>/tasks.md "<task>" ["<task>" ...]
   ```
   It appends `## N. Review corrections [Iteration K]` with unchecked tasks and prints the iteration number `K`.
4. `openspec validate "<change>"`. If it fails, fix the artifacts and validate again, at most twice; then stop and tell the person.
5. Run the guard:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/fix-guard.mjs openspec/changes/<change>
   ```
   If it exits 1 it prints what is missing. Correct the specification and run it again. **Do not launch the developer until it exits 0.**

Do not commit yet: the whole fix is committed together once QA passes.

### 3. Develop

Launch the `relevo:dev` agent in **build** mode. Give it the change folder, the project rules file and the base branch. The original tasks are all done, so the only pending ones are the corrections, and those are all it should touch.

Read its report. If its open questions are not "none", they mean the specification is still unclear: ask the person, update the specification and run the guard again.

### 4. QA, with retries

Launch the `relevo:qa` agent on the result, with the same change folder, rules file and base branch. Its first line is `QA PASSED` or `QA REJECTED`.

On `QA REJECTED` you may retry up to `qa.retries` times. Each retry launches `relevo:dev` in **fix** mode with the complete QA report, then `relevo:qa` again with the previous report, so it checks each earlier finding.

If QA still rejects after the retries: **make no commit and no push.** Leave the changes in the working tree, show the person the findings, leave the issue's labels untouched, and stop.

### 5. Commit

Stage exactly the files the developer reported plus the files changed under `openspec/changes/<change>/`, naming each one, with `node ${CLAUDE_PLUGIN_ROOT}/scripts/stage.mjs <paths>`. Never use `git add .` or `-A`.

Scan what is staged:

```bash
git diff --cached | node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-diff.mjs
```

If it reports anything, unstage everything (`git restore --staged .`), show the person the file and line, and stop without pushing. The changes stay in the working tree.

Otherwise commit with the message `fix: <short summary> (#<issue>)`. Do not add links to this session or attribution lines.

### 6. Push

`git push origin <branch>` (a normal push, never forced).

### 7. The issue

Use what `fix-state.mjs` printed in step 0.

1. If `labels` is not empty, apply it with `gh issue edit` (it returns a `qa-failed` issue to `built`, and a `changes-requested` one to `pr-open`). In every other state the labels do not change.
2. Decide who is told:
   - `notify` is `assignee`: the issue's assignee, with the ask `Your next step: /relevo:review <issue>`.
   - `notify` is `reviewer`: find the pull request (`gh pr list --head <branch> --json number,reviews`), take the people who requested changes, re-request each one with `gh pr edit <number> --add-reviewer <login>`, and mention them with the ask `please re-review`.
   - otherwise: mention nobody.
3. Post one comment built by `node ${CLAUDE_PLUGIN_ROOT}/scripts/render-message.mjs fix_done` with: `issue`, `title`, `iteration` (the number from step 2), `summary` (one line of what changed), `qa` (`QA PASSED`), `commit` (the short hash), and `recipient` and `ask` when someone is told.
4. If `evidence/review-state.json` exists (a review is in progress), reconcile it with the new specification: `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs sync openspec/changes/<change>`. Lines already confirmed stay confirmed, lines that failed are tested again, new scenarios are added, and the log audit and the agreement are repeated. Tell the person to restart the app and resume with `/relevo:review <issue>`, and that they can write `retest <numbers>` for any confirmed line the fix may have affected, because QA only audited this correction.

## Report

Finish with one short block: the issue, the iteration, what changed, the QA verdict, the commit, and the issue's state before and after.

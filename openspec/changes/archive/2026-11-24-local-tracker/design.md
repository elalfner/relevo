# Design

## Context

See proposal.md for why. What shapes the approach:

- The rules of Relevo live mostly in pure scripts that take JSON in the shape `gh issue view --json ...` or `gh pr view --json ...` (`can-edit-issue`, `issue-hash`, `check-issue`, `ship-check`, `failure-comment`). The `gh` calls themselves are in the text of the skills, plus a few scripts (`go-plan`, `status-data`, `ship-github`, `gh-web`, `gh-client`).
- `config.mjs` already declares `tracker` and `git_provider` as enums with the single value `github`, and the template says "more later".
- A build runs in a separate worktree. State written by a build must be seen by the main working tree and by every other worktree, and a state change must not dirty any of them.
- No QA lens can be turned off or lowered (`config.mjs`, the check on `agents.qa.<lens>`), and the lenses have a model floor (`QA_MIN_MODEL`). That rule is kept.
- `review.mode: none` already means one person, so a files project reuses it instead of a new notion of "solo".

## Goals / Non-Goals

**Goals:**
- A files project runs think, issue, go, fix, review, ship and status with no remote and no `gh`.
- A GitHub project is byte-for-byte the same in behavior; its tests do not change.
- The pure scripts that hold the rules are reused, not copied, so a rule fixed once is fixed in both trackers.

**Non-Goals:**
- Any notion of a second person, a claim between two machines or a shared state.
- Hiding every difference between the trackers. A files project has no pull request, and the skills say so where it matters.
- Replacing `gh-web.mjs`, which stays the way a web session reaches GitHub.

## Decisions

**1. One entry point, `scripts/tracker.mjs`, with a small fixed set of verbs; the files backend answers in the JSON shape of `gh`.**
The verbs are the ones the skills actually need: `issue-get`, `issue-list`, `issue-create`, `issue-edit-body`, `state-set`, `comment-add`, `comments-list`, `branch-delivery-open`, `delivery-get` and `issue-close`. The `github` backend delegates to `gh-client` and `gh-web` and returns what they return today. The `files` backend builds the same fields (`number`, `title`, `body`, `state`, `labels`, `comments`) from the file and the state record. Alternative: one adapter per script with a common interface. Rejected: the rules are already pure functions over JSON, so matching the shape reuses all of them and keeps the change small. Cost: the shape of `gh` becomes a contract of the project, which a test pins with the fixtures in `tests/fixtures/rest/`.

**2. The skills call `tracker.mjs` instead of `gh issue` and `gh pr`, and a test enforces it.**
Skill text is where the `gh` calls are, so migrating means editing the skills. A test lists every `gh issue` and `gh pr` occurrence in `skills/` and `scripts/` and fails on any outside the `github` backend, `gh-web`, `gh-client` and an explicit allowlist (the GitHub-only workflows and `doctor` checks of GitHub). Without that test the next edit to a skill would put a `gh` call back and break a files project silently. Alternative: emulate `gh` subcommands inside `gh-web.mjs` for files. Rejected: it would make a file backend pretend to be GitHub, and `gh pr merge --squash` has no honest meaning there.

**3. State lives in `<git-common-dir>/relevo/`, not in the issue file and not in the working tree.**
This departs from "state inside the issue file", which the first conversation about this change assumed. The issue file is committed to the base branch so that worktrees contain it; a state inside it would change on every transition, producing commits on the base branch, conflicts between a worktree and the main tree, and a text hash that changes with the state. The git common directory is shared by all worktrees, is never tracked and needs no `.gitignore`. Layout: `issues/<n>.json` (state, hash at approval, timestamps), `issues/<n>.log` (comments, one JSON per line), `delivery/<n>.json` (review result). The state is lost if the folder `.git` is deleted, which is acceptable: the issue text is in git and an issue returns to `ready` by approving it again.

**4. The approval hash is stored at `ready` and compared before the build.**
GitHub has no stored hash, so `go-plan` compares the last edit time of the issue with the moment `ready` was applied. With files the hash of the text (`issue-hash`) is stored when `ready` is applied and compared at the claim. This is exact, and the reason `issue changed after ready` stays the same.

**5. The pair `tracker`/`git_provider` is validated as a pair; `files` implies `local` and `review.mode: none`.**
Two keys exist today. Collapsing them would break every existing `relevo.yml`, so both are kept, accept one new value each and must agree. Mixed pairs (files issues with GitHub pull requests) are rejected because no part of the design supports them and each would need its own rules.

**6. Review and ship without a pull request.**
`review` already works on a branch checked out in a worktree and records a result; the pull request opening is its last step, so with files it records the result in `delivery/<n>.json` instead. `ship` keeps its order (check, confirm in writing, archive on the branch, merge, clean up). The merge is `git merge --squash` into the base branch followed by one commit with the title of the issue; the archive commit and the checkpoints stay in the branch and are dropped with it, as the GitHub squash drops them. The gate of a pull request (`ship.mjs`) weighs another person's approval and the checks of CI, which a one-person project has neither of, so a files project has its own pure gate (`ship-local.mjs`) with the refusals that still make sense: the issue was built, was reviewed and not changed since, the validation gate was green on the commit to merge (recorded by `go`, `fix` and `review` in the delivery record; the archive commit that `ship` makes itself does not make either stale), and the branch merges cleanly.

**7. Depth is resolved where the model plan is built.**
`model-plan.mjs` already merges the defaults with `agents.*`. Depth adds one layer under the explicit values: `prototype` lowers the default effort of `dev` and of each lens by one step (never below `low`), and lets `auto` choose the floor model for a lens whose default is above it. Because the floor is `sonnet`, the saving is mostly effort and the opus lenses (`spec`, `security`); it is modest and the spec of `project-depth` does not promise more. `qa.retries` is untouched so that a prototype does not fail a build that a retry would pass.

**8. `think` reads `depth` from `relevo.yml` and states it as settled.**
`think` is a conversation, so the depth is a rule in its text: with `prototype` the skill first lists what the code and the rules already settle, then asks only open decisions, one at a time with a recommendation. It never asks which depth to use.

**9. Existing requirements worded in GitHub terms stay as they are and describe `tracker: github`.**
The delta specs add requirements instead of rewriting the 130 of `go` and the others. A requirement of a modified capability that mentions an issue, a label or a pull request is the GitHub behavior, and the added requirements say what a files project does instead. Alternative: rewrite every requirement tracker-neutrally. Rejected for this change: it is a large rewrite with a high chance of changing GitHub behavior by accident. The cost is two readings of one capability; a later change can unify them once the files tracker has settled.

**10. `init --local` and `doctor` branch on the tracker, they do not fork.**
The plan builder (`planInit`) and the checks (`runChecks`) get the tracker from `relevo.yml` (or from `--local` for a project that has none yet) and skip the GitHub items. A skipped check is not reported at all, so a files project never sees a warning about something it cannot have.

**11. A files project compares with the local base, through one `baseRef`.**
The build machinery was written for a remote: it makes the worktree from `origin/<base>`, runs the gate with `--base origin/<base>`, reads `origin/<branch>` to resume and diffs against `origin/<base>`. For a files project `base-ref.mjs` answers the local `<base>` and `<branch>` instead, decided by `tracker` in `relevo.yml`, not by whether a remote happens to exist: a files project that has an `origin` must not build from a stale `origin/<base>` while `ship` moves the local base. A test lists every `origin/` in `scripts/` and `skills/` and fails on any outside a named list (GitHub-only features and the places that choose between the two), so the next edit cannot reintroduce the assumption.

## Risks / Trade-offs

- [Scope: this touches about 16 scripts and every skill] → Order the work so that each stage keeps `tracker: github` green: first the entry point with the `github` backend and the enforcement test, then the `files` backend, then the skills one at a time. The tasks follow that order.
- [A skill still calls `gh` directly and a files project breaks] → The enforcement test of decision 2.
- [The state is only on this machine] → Documented; the issue text is in git, and re-approving restores the flow. A clone elsewhere starts with no state, which is correct for a one-person project.
- [One person approves and builds their own work, so the approval gate is a habit, not a control] → The stored hash still stops a text edited after approval; nothing is claimed beyond that, and the docs say so.
- [Two readings of the specs (decision 9)] → Each added requirement names the tracker it applies to, and the design records it for the change that unifies them.
- [`depth: prototype` can look like it weakens QA] → The spec states that all lenses run at every depth, and a test builds the model plan at both depths and checks the five lenses and the floor.
- [The open changes `go-visibility` and `build-runner-labels` touch the same lifecycle and runner code] → Archive them before applying this change, or the entry point will be written against files that are about to move.

## Migration Plan

- Nothing to migrate: `tracker` and `git_provider` default to `github`, `depth` defaults to `standard`, and a project without the new keys behaves as before.
- Release: a new minor version, `CHANGELOG.md` entry and the version in `.claude-plugin/plugin.json` raised on `dev` first, as `CLAUDE.md` says. Test the files flow in the sandbox from `dev` before the release, as the release notes of earlier versions did.
- Rollback: remove `tracker: files` from `relevo.yml`. The `.relevo/` folder and the state under `.git/relevo/` can be left in place and are ignored.
- Moving a files project to GitHub is not part of this change.

## Open Questions

- The exact effort steps of `prototype` for each lens (for example `interface` already defaults to `medium`) can be fixed during implementation from the model plan; the spec only fixes the direction and the guarantees.
- Whether `/relevo:status` in a files project should also offer to remove state records of shipped issues. Harmless to decide later.

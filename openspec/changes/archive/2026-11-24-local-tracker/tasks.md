# Tasks

## 1. Configuration

- [x] 1.1 In `scripts/lib/config.mjs` accept `tracker: files`, `git_provider: local` and the new enum `depth` (`prototype`, `standard`, default `standard`); verify with tests in `tests/config.test.mjs` for the valid pair, the mixed pair (names both keys), an unknown depth (lists the allowed values) and a file with none of the new keys (unchanged result).
- [x] 1.2 Reject `review.mode` other than `none` for `tracker: files` and turn `team.*`, `limits.built_unreviewed_per_person`, `limits.concurrent_agents` above 1 and `runner.*` into warnings for it; verify with tests for the error and for each warning.
- [x] 1.3 Update `templates/relevo.yml` with the new values in its comments and document the keys in `docs/configuration.md` and `docs/configuration.es.md`; verify `tests/readme-sync.test.mjs` and the template test pass.

## 2. The tracker entry point with the GitHub backend

- [x] 2.1 Add `scripts/tracker.mjs` and `scripts/lib/tracker/` with the verbs of design decision 1 and a `github` backend that delegates to `gh-client` and `gh-web` and returns today's JSON; verify with tests that every verb returns the same fields as the fixtures in `tests/fixtures/rest/`.
- [x] 2.2 Move the `gh issue` and `gh pr` calls of the scripts (`go-plan`, `status-data`, `ship-github` and the others found by the search below) to the entry point; verify that the existing tests of those scripts pass unchanged.
- [x] 2.3 Add the enforcement test of design decision 2: it lists every `gh issue` and `gh pr` occurrence under `skills/` and `scripts/` and fails on any outside the GitHub backend, `gh-web`, `gh-client` and a named allowlist; verify it fails when a call is added to a skill and passes on the tree.

## 3. The files backend

- [x] 3.1 Implement the issue file store: create with the next number (never reused), read and update `.relevo/issues/<n>.md`; verify with tests for numbering with gaps and with a shipped issue, and that the text read back equals the text written.
- [x] 3.2 Implement the state store in `<git-common-dir>/relevo/` (state, hash at approval, comments, delivery record) and make it visible from every worktree; verify with a test that creates a worktree, changes the state from it and reads it from the main tree, and that `git status` stays clean in both.
- [x] 3.3 Make the files backend return the JSON shape of `gh issue view` so that `can-edit-issue`, `issue-hash` and `check-issue` accept it unchanged; verify by running those scripts on a files issue and getting the same decisions as for the equivalent fixture.
- [x] 3.4 Store the hash when `ready` is applied and compare it before the claim, with the reason `issue changed after ready`; verify with tests for unchanged text and for text edited after approval.
- [x] 3.5 Implement the dependency rule (`Depends-on: #N` waits for a shipped issue, another repository is rejected); verify with the three scenarios of the spec.
- [x] 3.6 Document the files tracker in `docs/get-started.md`, `docs/issue-format.md` and their `.es.md` versions, with the one-person limits and the fact that the state stays on the machine; verify the readme-sync test.

## 4. Go and fix in a files project

- [x] 4.1 Make `go-plan.mjs` and the claim read the issue and write the state through the entry point, applying the team gates (milestone, assignee, capacity) only for `github`; verify with tests that a `ready` files issue with no assignee or milestone is planned as `start`, and that the GitHub plan is unchanged.
- [x] 4.2 Change `skills/go/SKILL.md` and its references so that every issue and label operation goes through the entry point, a hand-off records its report in the state and no pull request, GitHub comment or cloud warning is produced in a files project; verify with `tests/skill-go.test.mjs` extended for both trackers and the enforcement test of 2.3.
- [x] 4.3 Treat a missing remote as the existing `not_pushed` state in the checkpoint and the final push, without failing; verify with a test on a repository with no remote that the checkpoints are kept and the state is `not_pushed`.
- [x] 4.4 Apply the same changes to `skills/fix/SKILL.md`; verify with `tests/skill-fix.test.mjs` for both trackers.

## 5. Issue, think and status

- [x] 5.1 Change `skills/issue/SKILL.md` so that with `tracker: files` it writes and commits the file after approval, asks for no milestone, assignee or repository, stores the hash on `ready` and refuses to edit an issue that is being built; verify with `tests/skill-issue.test.mjs` for both trackers.
- [x] 5.2 Change `skills/think/SKILL.md` to read `depth` and apply the prototype rule, and to hand over to `/relevo:issue` without GitHub concepts in a files project; verify with `tests/skill-think.test.mjs` that the text has both rules and still has the standard interview unchanged.
- [x] 5.3 Change `skills/status/SKILL.md` and `scripts/status-data.mjs` to list a files project from the files with the next command per issue; verify with `tests/status.test.mjs` for the mixed-states and nothing-waiting scenarios.

## 6. Review and ship in a files project

- [x] 6.1 Change `skills/review/SKILL.md` so that in a files project it reviews the branch against the base, records the result in the delivery record and opens no pull request or reviewer pick; verify with `tests/skill-review.test.mjs` for both trackers.
- [x] 6.2 Implement the local ship: the gate `ship.mjs` fed from the delivery record and the receipt of the validation gate, the written confirmation, the archive on the branch, the squash merge into the base branch, the deletion of the branch and the clearing of the state; verify with tests on a temporary repository for the confirmed ship, the declined one (nothing changes), a conflict with the base and a branch with commits after the last passing gate.
- [x] 6.3 Change `skills/ship/SKILL.md` to follow the local path in a files project; verify with `tests/skill-ship.test.mjs` for both trackers.
- [x] 6.4 Document review and ship without a pull request in `docs/commands.md` and `docs/commands.es.md`; verify the readme-sync test.

## 7. Init and doctor

- [x] 7.1 Add `--local` to the plan of `init`: create the repository when missing with the branch `main`, write the minimal `relevo.yml`, create `.relevo/issues/`, and add no workflow, label or GitHub item; verify with `tests/init.test.mjs` for an empty folder, a second run (reports nothing to change) and an existing repository.
- [x] 7.2 Make `doctor` skip the GitHub, label, ruleset, secret, workflow and remote checks for `tracker: files` and check git, OpenSpec, toolchain, skills, `relevo.yml` and the base branch; verify with `tests/doctor.test.mjs` that a files project with no remote has no failure and no warning about it and that a missing OpenSpec fails.
- [x] 7.3 Update `skills/init/SKILL.md` and `skills/doctor/SKILL.md` for `--local`; verify with `tests/skill-init-doctor.test.mjs`.

## 8. Depth

- [x] 8.1 Resolve `depth` in `scripts/lib/model-plan.mjs` as a layer under the explicit `agents.*` values: `prototype` lowers the default effort of `dev` and of each lens by one step and lets a lens default to the floor model; verify with tests that explicit values win, that `standard` equals today's plan, and that at both depths all five lenses are present and none is below `QA_MIN_MODEL`.
- [x] 8.2 Verify that `qa.retries` is unchanged by `depth` and that `gate-selftest` and the validation gate run identically at both depths; verify with the existing gate tests run under `depth: prototype`.
- [x] 8.3 Document `depth` and what it does and does not change (the lenses and the floor) in `docs/configuration.md` and `docs/configuration.es.md`; verify the readme-sync test.

## 9. Work without a remote

- [x] 9.1 Add `scripts/lib/base-ref.mjs` (`localRefs(config)`, `baseRef`, `branchRef`, and `readLocal(configPath)` for the scripts): a files project compares with the local `<base>` and `<branch>`, never `origin/...`; verify with unit tests for both trackers, and add the enforcement test of design decision 11 that lists every `origin/` in `scripts/` and `skills/` and fails on any not named in its list.
- [x] 9.2 Make the worktree of a build from the local base in `go-local.mjs` and `go-worktree.mjs` (no `fetch`, no `gh auth status`, the title read through the tracker); verify with the existing tests unchanged for `github` and new tests for `files` that no `origin` and no `gh` is touched.
- [x] 9.3 Make `rescue-work.mjs`, `resume-check.mjs`, `branch-state.mjs`, `branch-work.mjs`, `build-preflight.mjs`, `integrate-base.mjs`, `replica-plan.mjs` and `branch-worktree.mjs` use the local refs for a files project; verify each with a test on a repository with no remote and with the existing tests unchanged.
- [x] 9.4 Update the skills `go`, `fix`, `review`, `ship`, the reference `qa-run.md` and the five agents so that a files project passes the local base to the gate and to the diffs; verify with skill tests for each.
- [x] 9.5 Make a real build possible with no remote: run `go-local.mjs --dry-run` and the worktree creation on a repository with no remote and verify the worktree is made from the local base branch.

## 10. Integration

- [x] 10.1 Run the whole flow on a temporary repository with no remote: `init --local`, an issue file approved, `go` to `built`, `review`, `ship`; verify that the base branch has the issue commit and one squash commit, the branch and the state are gone, and no `gh` process was started (a stub `gh` that fails when called).
- [x] 10.2 Run `npm test` and `openspec validate --all`, the two steps of the CI, and fix what an open change made stale.
- [x] 10.3 Add the `CHANGELOG.md` entry under `[Unreleased]`; the version bump (`package.json`, `.claude-plugin/plugin.json`, `RELEVO_VERSION` and the six workflow templates) is a step of the release in `RELEASING.md`, made by the maintainer when releasing; verify `tests/package.test.mjs`.

## Workflow follow-up

- Archive `go-visibility` and `build-runner-labels` before applying this change.
- Test the files flow in the sandbox from `dev` before the release, as in `reference-sandbox-test-from-dev`.
- Archive this change after the release is merged to `main` and tagged by the person.

# Tasks

## 1. Plan refusal in `requiredChecks`

- [x] 1.1 Add and export `planRefusal(err)` in `scripts/lib/ship-github.mjs` (403 and the "Upgrade to GitHub" / "make this repository public" text) and wrap the `rules/branches` call and the classic protection call so a plan refusal gives `{ required: false, contexts: [] }`, a 404 on the classic call still means no protection, and any other error propagates. Verify with new cases in `tests/ship-github.test.mjs`: the plan 403 on both calls returns an empty list; a 403 for permissions, a 500 and a 404 on the rules call throw; existing cases still pass.

## 2. Unexpected errors stop with a reason

- [x] 2.1 In `scripts/lib/ship-unattended.mjs`, make the outer `catch` turn a non-`Stop` error into a `ship_stopped` whose reason is the first lines of the error's `stderr` or message, then remove the label and comment as for any stop. Verify with `tests/ship-unattended.test.mjs`: a `gh` that throws on the rules call leaves the label removed, a comment with that message and nothing merged.
- [x] 2.2 Add a `runUnattendedShip` case where the base branch has no rules available (plan 403 on both calls, no App): it reaches the merge and closes the issue. Verify the test passes together with the rest of the file.

## 3. Template permissions and version

- [x] 3.1 Add `checks: read` and `statuses: read` to the `permissions` block of `templates/workflows/relevo-ship.yml`, with a comment saying what they are for. Verify with an assertion in `tests/workflow-ship.test.mjs` that both are declared.
- [x] 3.2 Set the template version marker and `RELEVO_VERSION` to `0.9.2` in `relevo-ship.yml` and the version line in the other templates, and `version` in `package.json` and `.claude-plugin/plugin.json`. Verify with `grep -rn "0\.9\.1"` (nothing outside `CHANGELOG.md` and archived changes) and `npm test`.

## 4. `doctor` on a plan without protection

- [x] 4.1 In `scripts/lib/doctor.mjs`, report `protectionUnavailable` as a `note` with the text "no branch protection is available on this plan", keep `protectionError` as a warning, and have the plan test reuse `planRefusal`. Review `scripts/lib/init.mjs` for the same pattern and record in the change if nothing needs to change. Verify with `tests/doctor.test.mjs`: a free-plan repository gives a note and no warning or failure for `repo.protection`, and a different read error still warns.

## 5. Docs and release notes

- [x] 5.1 Add the 0.9.2 entry to `CHANGELOG.md` (Fixed: free private repositories; unexpected errors name their reason; template permissions; doctor note; how a consumer adopts it) without naming real projects or organizations. Where the docs explain the ship by label, add that the workflow must be on the default branch because GitHub runs `issues` workflows only from it, and that a repository without CI still needs `review.ship_without_ci`. Verify with `openspec validate --all` and `npm test`.

## Workflow follow-up

- Archive the change once reviewed, then run `npm test` and `openspec validate --all` before pushing.
- Promote `dev` to `main` by pull request and tag `v0.9.2`.

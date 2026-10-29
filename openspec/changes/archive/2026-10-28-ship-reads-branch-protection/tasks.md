# Tasks

## 1. Required checks with the workflow token

- [x] 1.1 In `scripts/lib/ship-github.mjs`, change `requiredChecks` so that a plan refusal from `rules/branches/<b>` returns `{ required: false, contexts: [] }` without another call, and the classic protection is read from `repos/<r>/branches/<b>` (`protection.required_status_checks`: required when `enforcement_level` is set and not `off`; contexts from `contexts` and `checks[].context`), throwing every error from that call. Update its doc comment. Verify with `tests/ship-github.test.mjs`, adapting the existing classic cases to the branch endpoint and adding: plan refusal on the rules makes no call to `branches/dev` (assert on `gh.calls`); rules `[]` and summary `off` → not required; rules `[]` and summary `everyone` with `contexts: ['build']`, `checks: [{ context: 'lint' }]` → required with both; `non_admins` → required; a ruleset `test` plus classic `build` → both; no `protection` field → not required; a 403 "Resource not accessible by integration", a 404 and a 500 on `branches/dev` throw.
- [x] 1.2 In `tests/ship-unattended.test.mjs`, make the fake `gh` answer `repos/o/r/branches/dev` instead of `branches/dev/protection`, and make the plan-refusal option refuse only the rules call and fail on any `branches/dev` call. Add a case where the base branch's classic summary requires a check and there is no App, which stops with `ship_needs_app`. Verify with `npm test`.

## 2. Release

- [x] 2.1 Set the template version marker to `0.11.1` in every `templates/workflows/*.yml` and `RELEVO_VERSION` in `relevo-ship.yml`, and `version` in `package.json` and `.claude-plugin/plugin.json`. Verify with `grep -rn "0\.11\.0" templates package.json .claude-plugin` (no match) and `npm test`.
- [x] 2.2 Add the `0.11.1` entry to `CHANGELOG.md` under Fixed: the ship by label no longer stops with `Resource not accessible by integration` when it reads the protection of the base branch; it reads the required checks with the workflow token alone; a consumer sets `RELEVO_VERSION` to `0.11.1`, with no change to permissions. Do not name real projects or organizations. Verify with `openspec validate --all`.

## Workflow follow-up

- Before promoting, run the ship by label in the sandbox from `dev` (`npm pack github:elalfner/relevo#dev`) on a private free-plan repository and, if possible, on a branch with classic protection that requires a check, and confirm that the workflow token reads the summary.
- Archive the change, then run `npm test` and `openspec validate --all` before pushing.
- Promote `dev` to `main` by pull request and tag `v0.11.1`.

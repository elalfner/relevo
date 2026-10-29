# Proposal

## Why

The ship by label still stops on a private repository on the free plan, with `Resource not accessible by integration (HTTP 403)`. To know whether the base branch requires checks, the run reads the classic protection from `branches/<b>/protection`. That endpoint needs the `administration: read` permission, which the workflow token can never have. GitHub answers that token with a permissions 403, not with the plan refusal that 0.9.2 learned to accept. A personal token gets the plan refusal from both endpoints, which is why `/relevo:ship <n>` passes and the label does not, and why the design of `ship-free-private-repos` assumed that both endpoints refuse in the same way. The same 403 stops the run on any repository whose rulesets endpoint answers normally, whatever its plan.

## What Changes

- The unattended ship reads the classic protection of the base branch from the branch itself (`branches/<b>`, its `protection.required_status_checks` summary), which the workflow token can read with read access. Checks are required when that summary has an enforcement level other than `off`. The required contexts are taken from `contexts` and from `checks[].context`.
- When the rulesets endpoint refuses because of the plan, the run does not read the classic protection. A plan that offers no rulesets offers no protection for a private repository either.
- Any other failure to read either source still stops the run with GitHub's message, and nothing is merged. A check that exists is never skipped because it could not be read.
- Patch release 0.11.1 of the package and the templates, with a changelog entry. A consumer adopts it by setting `RELEVO_VERSION` to `0.11.1`. The workflow's permissions do not change.

## Capabilities

### New Capabilities

### Modified Capabilities

- `ship`: the unattended ship learns the required checks of the base branch with the workflow token alone, and does not read the classic protection after the plan refused the rules.

## Impact

- `scripts/lib/ship-github.mjs` (`requiredChecks`) and its tests (`tests/ship-github.test.mjs`, `tests/ship-unattended.test.mjs`).
- `templates/workflows/*.yml` (version marker, `RELEVO_VERSION` in `relevo-ship.yml`), `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`.
- Out of scope: giving the App `administration: read`, using the App token for reads, a new stop kind, and a `doctor` warning about classic protection. `doctor` keeps reading `branches/<b>/protection` with the person's own token, where it works.

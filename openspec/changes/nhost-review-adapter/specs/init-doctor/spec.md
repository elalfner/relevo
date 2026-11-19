# Spec Delta

## ADDED Requirements

### Requirement: Init and doctor treat Nhost as a shipped stack
`init` SHALL NOT propose `.relevo/stacks/nhost.md`, because the plugin ships the profile. `doctor` SHALL apply to a platform with stack `nhost` the checks of a declared adapter (the tools of the adapter, an invalid profile, a note when `{filter}` is missing and the autopilot is not `off`) and SHALL warn about a `commands` entry of the repository's profile that the plugin's profile replaced.

#### Scenario: Init for Nhost
- **WHEN** `init` runs for a platform with stack `nhost`
- **THEN** the plan does not include `.relevo/stacks/nhost.md`

#### Scenario: Doctor finds Docker missing
- **WHEN** `doctor` runs for a platform with stack `nhost` and `docker` is not on the path
- **THEN** it reports the missing tool and the fix next to it

#### Scenario: Doctor with an old full profile
- **WHEN** the repository's `.relevo/stacks/nhost.md` has an `analyze` that differs from the plugin's
- **THEN** `doctor` warns that it is ignored and says to set it in `checks` of `relevo.yml`

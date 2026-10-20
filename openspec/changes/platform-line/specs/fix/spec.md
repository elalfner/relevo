## ADDED Requirements

### Requirement: Fix uses the platform of the issue
`fix` SHALL resolve the platform of the issue again from its text, resolve the profile and the role skills for it, and give them to `relevo:dev` and `relevo:qa` with the folder of the platform. When the platform cannot be resolved it SHALL stop before changing anything and say why.

#### Scenario: Monorepo fix
- **WHEN** `fix` runs on an issue for `api`
- **THEN** the agents receive the profile of the stack of `api` and its folder

#### Scenario: Platform not resolvable
- **WHEN** the issue no longer names a valid platform in a repository with several
- **THEN** `fix` changes nothing and tells the person to correct the `Platform:` line

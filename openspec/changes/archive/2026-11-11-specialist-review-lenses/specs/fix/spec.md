## MODIFIED Requirements

### Requirement: Fix uses the platform of the issue
`fix` SHALL resolve the platform of the issue again from its text, resolve the profile and the role skills for it, and give them to `relevo:dev`, the gate and the lenses with the folder of the platform. When the platform cannot be resolved it SHALL stop before changing anything and say why.

#### Scenario: Monorepo fix
- **WHEN** `fix` runs on an issue for `api`
- **THEN** the agents receive the profile of the stack of `api` and its folder

#### Scenario: Platform not resolvable
- **WHEN** the issue no longer names a valid platform in a repository with several
- **THEN** `fix` changes nothing and tells the person to correct the `Platform:` line

## ADDED Requirements

### Requirement: Fix runs the gate and the lenses on the iteration's diff
After the developer agent has done the correction tasks, `fix` SHALL run the validation gate and the active lenses on the iteration's diff against the new scenarios, with `qa.retries` retries, as `go` does, and SHALL use the same aggregation.

#### Scenario: A correction that breaks a test
- **WHEN** the gate is red after the correction
- **THEN** no lens runs and the developer agent receives the output of the gate

#### Scenario: A correction that passes
- **WHEN** the gate is green and no blocking lens rejects
- **THEN** `fix` goes on as it does after a passed QA

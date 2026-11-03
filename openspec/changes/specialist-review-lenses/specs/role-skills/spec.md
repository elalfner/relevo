## ADDED Requirements

### Requirement: The lenses have roles for skills
A profile MAY list skills for the roles `qa-spec`, `qa-security` and `qa-interface`, besides the roles it already has. The existing role `qa` SHALL go to the `code` lens. `go` SHALL give each lens only the skills of its own role, under the conditions that already apply to every skill.

#### Scenario: A skill for the existing QA role
- **WHEN** a profile lists a testing skill under `qa`
- **THEN** the `code` lens receives its path and no other lens does

#### Scenario: A skill for the security lens
- **WHEN** a profile lists a skill under `qa-security`
- **THEN** only the `security` lens receives it

#### Scenario: A skill that is not on the base branch
- **WHEN** a skill of a lens role is not on the base branch
- **THEN** it is left out of the run with the usual reason

### Requirement: The size of the skills is counted per lens
`doctor` SHALL warn when the skills resolved for one role, now including the lens roles, together exceed the size already set for a role.

#### Scenario: A large skill on one lens
- **WHEN** the skills of the `security` lens together pass the limit
- **THEN** `doctor` warns and names the lens

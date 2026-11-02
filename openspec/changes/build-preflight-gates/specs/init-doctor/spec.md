## ADDED Requirements

### Requirement: `doctor` warns when the dependencies are never installed
When the profile of a platform lists installed paths and the `go` workflow has no active step that installs the dependencies of that platform, `doctor` SHALL warn and name the platform and the missing step. It SHALL say nothing for a platform whose profile lists no paths.

#### Scenario: A workflow without an install step
- **WHEN** a platform of the `vue` stack has a `go` workflow with no step that installs its dependencies
- **THEN** `doctor` warns, names the platform and says which step to enable

#### Scenario: A workflow with the step
- **WHEN** the workflow has an active install step for the platform
- **THEN** `doctor` says nothing about it

#### Scenario: A stack that lists no paths
- **WHEN** the profile of the platform lists no installed paths
- **THEN** `doctor` makes no check

# Spec Delta

## ADDED Requirements

### Requirement: Init describes several platforms as built per issue
When `init` asks for the platforms, it SHALL tell the person that several platforms in one repository are supported and that `go` builds the platform each issue names with its `Platform:` line. It SHALL NOT say that `go` builds only a repository with one platform.

#### Scenario: Two platforms in one repository
- **WHEN** the person names a Flutter platform at `.` and a Supabase platform at `supabase`
- **THEN** `init` writes both and says that each issue names the platform it is for

## MODIFIED Requirements

### Requirement: Doctor checks that the build installs the toolchain
When the go workflow is installed, doctor SHALL fail for each configured platform whose stack needs a toolchain step (Flutter, Laravel, Supabase) that the go workflow does not install in an active, non-comment line, and SHALL say which step to add. It SHALL do nothing when the go workflow is not installed, and SHALL not judge stacks without a step in the template.

#### Scenario: A Flutter project whose workflow installs nothing
- **WHEN** a platform has the stack `flutter` and the go workflow has no active Flutter setup
- **THEN** doctor reports a failure that names the platform and says to enable the Flutter step of the template

#### Scenario: A Supabase platform whose workflow installs nothing
- **WHEN** a platform has the stack `supabase` and the go workflow has no active Supabase CLI setup
- **THEN** doctor reports a failure that names the platform and says to enable the Supabase step of the template

#### Scenario: A toolchain that is only a comment
- **WHEN** the only mention of the Flutter setup in the go workflow is a commented example
- **THEN** it counts as missing

#### Scenario: A project that builds on machines only
- **WHEN** the go workflow is not installed
- **THEN** doctor reports nothing about the toolchain

### Requirement: Init mentions the toolchain of a workflow it leaves alone
When the go workflow exists and differs from the template, the plan SHALL say that its build job has to install the toolchain of the stacks of the project, and that the template does it for Flutter, Laravel and Supabase (Vue needs only Node, which the job already installs).

#### Scenario: An older go workflow
- **WHEN** the go workflow differs from the template
- **THEN** the item that says it is left as it is also names the toolchain step to compare

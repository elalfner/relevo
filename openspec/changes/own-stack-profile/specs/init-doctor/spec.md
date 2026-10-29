# Spec Delta

## ADDED Requirements

### Requirement: Init proposes a full profile for a stack the plugin does not ship
When a platform's stack has no profile in the plugin, `init` SHALL propose creating `.relevo/stacks/<stack>.md` without being asked and write a profile meant to be the whole of it. It SHALL leave the commented lines `analyze`, `test` and `format` for the person to fill in and SHALL NOT write a command that succeeds without checking anything. It SHALL create the file without committing it and list it among the files to commit.

#### Scenario: A Go platform
- **WHEN** `init` runs for a platform with stack `go` and the plugin has no profile for `go`
- **THEN** the plan includes `.relevo/stacks/go.md`, whose header names the stack and has the commented commands `analyze`, `test` and `format`, the tools and the generated files, and whose body asks for the hygiene of the developer and what QA looks for

#### Scenario: A stack the plugin ships
- **WHEN** `init` runs for a platform with stack `vue` and the person did not ask for a profile file
- **THEN** the plan does not include `.relevo/stacks/vue.md`

#### Scenario: The person declines
- **WHEN** the person says no to the proposed profile of a stack the plugin does not ship
- **THEN** `init` does not create the file, writes `relevo.yml` as usual and says that `doctor` will warn until the profile exists

#### Scenario: The file already exists
- **WHEN** `.relevo/stacks/go.md` already exists
- **THEN** `init` leaves it as it is and says it exists

### Requirement: Doctor warns about an own stack without analyze or test
For a platform whose profile is defined only by the repository, `doctor` SHALL warn when the commands of the resolved profile, after `platforms.<name>.checks`, have no `analyze` or no `test`, naming the missing commands, the file and the `checks` of `relevo.yml` as the other place to set them. It SHALL NOT judge a profile that has a layer from the plugin.

#### Scenario: Profile with no commands
- **WHEN** the profile of stack `go` is only `.relevo/stacks/go.md` and it defines no command
- **THEN** `doctor` warns that platform `app` has no `analyze` and no `test`, and says to write them in that file

#### Scenario: Command given by checks
- **WHEN** the same profile defines `test` and `relevo.yml` sets `platforms.app.checks.analyze`
- **THEN** `doctor` adds no warning about the commands

#### Scenario: A stack of the plugin
- **WHEN** the profile has a layer from the plugin
- **THEN** `doctor` adds no warning about the commands

## MODIFIED Requirements

### Requirement: Doctor checks that the build installs the toolchain
When the go workflow is installed, doctor SHALL fail for each configured platform whose stack needs a toolchain step (Flutter, Laravel, Supabase) that the go workflow does not install in an active, non-comment line, and SHALL say which step to add. For a stack that only the repository defines, it SHALL warn when no active line is guarded by `needs.decide.outputs.stack == '<stack>'`, and SHALL say to add a step guarded by that line; it SHALL NOT judge such a stack whose tools are only `node` and `npm`. It SHALL do nothing when the go workflow is not installed, and SHALL not judge the other stacks without a step in the template.

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

#### Scenario: An own stack with no step
- **WHEN** a platform has the stack `go`, defined only by the repository with the tool `go`, and the go workflow has no active line guarded by `needs.decide.outputs.stack == 'go'`
- **THEN** doctor warns, names the platform and says to add a step of the build job guarded by that line that installs Go

#### Scenario: An own stack with its step
- **WHEN** the go workflow has an active step guarded by `needs.decide.outputs.stack == 'go'`
- **THEN** doctor reports that the toolchain of the platform is installed

#### Scenario: An own stack that needs only Node
- **WHEN** the profile of an own stack lists only the tools `node` and `npm`
- **THEN** doctor does not judge its toolchain

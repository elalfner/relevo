# platforms Specification

## Purpose
TBD - created by archiving change platform-registry. Update Purpose after archive.

## Requirements

### Requirement: Platforms are declared in a registry
`relevo.yml` SHALL declare the platforms of the repository in `platforms`, a map of name to `stack` (required), `path` (a directory of the repository, default `.`) and `targets` (a list, only for stacks that define targets). The legacy `platform: flutter-android` SHALL stay valid and mean one platform with `stack: flutter`, `path: .` and `targets: [android]`. Setting both `platform` and `platforms` SHALL fail validation.

#### Scenario: Legacy setting
- **WHEN** `relevo.yml` has `platform: flutter-android` and no `platforms`
- **THEN** validation passes and the commands see one platform with stack `flutter`, path `.` and targets `[android]`

#### Scenario: Monorepo
- **WHEN** `platforms` has `web` (stack `vue`, path `apps/web`) and `api` (stack `laravel`, path `apps/api`)
- **THEN** validation passes and both platforms are known

#### Scenario: Both forms
- **WHEN** `relevo.yml` sets `platform` and `platforms`
- **THEN** validation fails and says to keep only `platforms`

#### Scenario: Bad path or target
- **WHEN** a path is absolute, contains `..`, or a target is not defined by the stack
- **THEN** validation fails and names the platform, the value and, for a target, the targets the stack defines

### Requirement: A stack has a profile
Every stack SHALL have a profile: a Markdown file whose header can be read by scripts and whose body is read by the agents. The header SHALL name the commands that verify the code (`analyze`, `test`, `format`), the generated files left out of the diff under review, the tools the stack needs, the skills it requires, the extra skills per role and, for stacks with targets, the tool each target needs. The plugin SHALL ship the `flutter` profile with targets `android`, `ios` and `web`.

#### Scenario: Flutter profile
- **WHEN** the profile of `flutter` is read
- **THEN** it names `flutter analyze --no-pub` and `flutter test --reporter=compact --no-pub`, leaves `*.g.dart` and `*.freezed.dart` out of the diff, and defines the targets `android`, `ios` and `web`

#### Scenario: Unknown stack
- **WHEN** a platform names a stack for which neither the plugin nor the repository has a profile
- **THEN** validation of the profile fails and names the stack and the two places where a profile can be defined

### Requirement: The profile can be extended by the repository but not weakened
A repository MAY add `.relevo/stacks/<stack>.md`. Its lists (tools, skills, generated files) SHALL be added to the plugin's, and its body SHALL be added after the plugin's body. It SHALL NOT remove an item of the plugin or replace a command. A verification command is replaced only through `platforms.<name>.checks` in `relevo.yml`. When the plugin has no profile for a stack, the file of the repository SHALL be the whole profile.

#### Scenario: Extra hygiene
- **WHEN** the repository's `.relevo/stacks/flutter.md` adds a rule in its body and a generated-file pattern
- **THEN** the resolved profile has the plugin's body followed by the repository's, and both patterns

#### Scenario: A repository tries to remove a check
- **WHEN** the repository's profile sets a command that the plugin's profile also sets
- **THEN** the plugin's command is kept, the resolved profile reports that the repository's value was ignored, and `doctor` warns about it

#### Scenario: Command replaced the supported way
- **WHEN** `platforms.web.checks.test` is `pnpm test`
- **THEN** the resolved profile of `web` uses `pnpm test` for `test` and the plugin's value for the other commands

#### Scenario: Stack defined only by the repository
- **WHEN** a platform has stack `elixir`, the plugin has no such profile and `.relevo/stacks/elixir.md` exists
- **THEN** that file is the profile

### Requirement: The profile is resolved by a script, not by an agent
The profile of a platform SHALL be resolved by one command that prints it (commands after applying `checks`, generated files, tools, targets, skills per role, the body and the layers used). `go` SHALL run it and hand the result to `dev` and `qa`; the agents SHALL NOT look for profiles themselves.

#### Scenario: Resolution output
- **WHEN** the command runs for a platform of stack `flutter` with the repository adding one body paragraph
- **THEN** it lists the layers used (`plugin`, `repository`) and the resolved values

#### Scenario: Stack with no body
- **WHEN** a profile has a header and an empty body
- **THEN** it resolves without error and the agents receive only the header values

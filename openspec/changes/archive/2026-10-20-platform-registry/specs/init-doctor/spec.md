## ADDED Requirements

### Requirement: Doctor reads the profile of each platform
For each platform, `doctor` SHALL check the tools the profile requires, the tool of each target (a missing tool of a target is a warning, except `xcrun` on a machine that is not macOS, which is a notice), the skills the profile requires, and report which layers make up the profile (for example "flutter: plugin default + .relevo/stacks/flutter.md"). It SHALL fail when a platform's stack has no profile and warn about a value of the repository's profile that the plugin's profile ignores.

#### Scenario: Flutter with Android and web
- **WHEN** a platform has stack `flutter` and targets `android` and `web`
- **THEN** `doctor` checks `flutter` and `adb`, reports `android` and `web` as targets, and does not require `xcrun`

#### Scenario: Missing stack profile
- **WHEN** a platform names a stack with no profile
- **THEN** `doctor` fails that check and says where to define one

#### Scenario: iOS on Linux
- **WHEN** a platform has target `ios` and the machine is not macOS
- **THEN** `doctor` shows a notice that iOS can only be built and reviewed on macOS, and does not fail

### Requirement: Doctor reads the skills of the roles
`doctor` SHALL list the skills resolved for each role, say which were left out and why, list the ones with scripts and whether they are allowed, warn when a role exceeds the size budget and warn when a skill folder differs from `skills-lock.json`.

#### Scenario: Skill left out
- **WHEN** a listed skill is not on the base branch
- **THEN** `doctor` shows it as left out with the reason

## MODIFIED Requirements

### Requirement: Init sets up the repository
`init` SHALL: detect the repository, provider and stack; ask for the platforms (name, stack, path and, where the stack has them, targets), team members, spec writer, review mode and language; write `relevo.yml` with `platforms`; create the lifecycle labels; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest); add the evidence directory to the ignore file; offer, without committing it, a commented `.relevo/stacks/<stack>.md`; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

#### Scenario: Monorepo
- **WHEN** the person names two platforms with different stacks and paths
- **THEN** `relevo.yml` has both entries and `doctor` checks the tools of both

#### Scenario: Existing legacy configuration
- **WHEN** `init` runs where `relevo.yml` has `platform: flutter-android`
- **THEN** it keeps the setting as it is and changes nothing in it unless the person asks

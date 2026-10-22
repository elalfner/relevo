## MODIFIED Requirements

### Requirement: Init sets up the repository
`init` SHALL: detect the repository, provider and stack; ask for the platforms (name, stack, path and, where the stack has them, targets), team members, spec writer, review mode and language; write `relevo.yml` with `platforms`; create the lifecycle labels; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest); add the evidence directory to the ignore file; offer a commented `.relevo/stacks/<stack>.md`, which it creates but does not commit and leaves for the person to commit with the other new files; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

#### Scenario: Monorepo
- **WHEN** the person names two platforms with different stacks and paths
- **THEN** `relevo.yml` has both entries and `doctor` checks the tools of both

#### Scenario: Existing legacy configuration
- **WHEN** `init` runs where `relevo.yml` has `platform: flutter-android`
- **THEN** it keeps the setting as it is and changes nothing in it unless the person asks

#### Scenario: Profile file of the repository
- **WHEN** the person asks for a profile file for stack `flutter`
- **THEN** the plan line says `.relevo/stacks/flutter.md` is created and left for the person to commit, `init` does not commit it, and the report lists it among the new files to commit and push

### Requirement: Doctor reads the profile of each platform
For each platform, `doctor` SHALL check the tools the profile requires, the tool of each target (a missing tool of a target is a warning, except `xcrun` on a machine that is not macOS, which is a notice), the skills the profile requires, and report which layers make up the profile (for example "flutter: plugin default + .relevo/stacks/flutter.md"). It SHALL fail when a platform's stack has no profile and warn about a value of the repository's profile that the plugin's profile ignores. It SHALL warn when the profile uses `.relevo/stacks/<stack>.md` and git does not track that file.

#### Scenario: Flutter with Android and web
- **WHEN** a platform has stack `flutter` and targets `android` and `web`
- **THEN** `doctor` checks `flutter` and `adb`, reports `android` and `web` as targets, and does not require `xcrun`

#### Scenario: Missing stack profile
- **WHEN** a platform names a stack with no profile
- **THEN** `doctor` fails that check and says where to define one

#### Scenario: iOS on Linux
- **WHEN** a platform has target `ios` and the machine is not macOS
- **THEN** `doctor` shows a notice that iOS can only be built and reviewed on macOS, and does not fail

#### Scenario: Profile file of the repository not tracked
- **WHEN** a platform's profile includes `.relevo/stacks/flutter.md` and git does not track that file
- **THEN** `doctor` warns that the cloud run and a fresh clone use only the plugin's profile, and says to commit the file

#### Scenario: Stack defined only by an untracked file
- **WHEN** the plugin has no profile for the stack and `.relevo/stacks/<stack>.md` is not tracked by git
- **THEN** `doctor` warns that the cloud run and a fresh clone have no profile for that stack, and says to commit the file

#### Scenario: Profile file of the repository tracked
- **WHEN** `.relevo/stacks/flutter.md` is tracked by git
- **THEN** `doctor` reports the layers as before and adds no warning about it

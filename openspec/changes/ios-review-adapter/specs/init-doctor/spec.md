# Spec Delta

## ADDED Requirements

### Requirement: Doctor checks what an iOS review needs
For each platform whose targets include `ios`, `doctor` SHALL check that the machine is macOS, that `xcrun` can be found, that `xcrun simctl` answers and that at least one iOS simulator runtime is installed. It SHALL warn, with the command or the place to fix it, when one is missing, and SHALL note when no simulator is booted, because the review needs one booted. On a machine that is not macOS it SHALL say that the iOS review cannot run there, and SHALL NOT fail the platform, because the build can run elsewhere.

#### Scenario: Xcode tools missing
- **WHEN** an iOS platform exists and `xcrun` is not on the path
- **THEN** `doctor` warns and says to install Xcode and its command line tools

#### Scenario: No runtime
- **WHEN** `xcrun simctl` answers and lists no iOS runtime
- **THEN** `doctor` warns and says to install one from Xcode, Settings, Components

#### Scenario: Nothing booted
- **WHEN** a runtime exists and no simulator is booted
- **THEN** `doctor` notes it and says the person boots one before the review

#### Scenario: Not macOS
- **WHEN** an iOS platform exists and the machine is Linux
- **THEN** `doctor` says that the iOS review cannot run on this machine and does not fail the platform

#### Scenario: No iOS platform
- **WHEN** no platform has the target `ios`
- **THEN** `doctor` adds none of these checks

## ADDED Requirements

### Requirement: Doctor checks what the autopilot needs
When `review.autopilot` is not `off`, `doctor` SHALL check, for each Flutter platform, that `lib/main_driver.dart` exists and that the project depends on `flutter_driver`, and, for each Vue platform, that Playwright can be resolved from the project. It SHALL warn, with the command to fix it, when one is missing, and SHALL say that a driven review of a target without an adapter is not available.

#### Scenario: Flutter without the driver entry point
- **WHEN** `review.autopilot` is `precheck` and a Flutter platform has no `lib/main_driver.dart`
- **THEN** `doctor` warns and says to add it with `enableFlutterDriverExtension()`

#### Scenario: Vue without Playwright
- **WHEN** `review.autopilot` is `verify` and a Vue platform cannot resolve Playwright
- **THEN** `doctor` warns and gives the install command

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** `doctor` adds no autopilot check

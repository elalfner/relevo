## ADDED Requirements

### Requirement: Init sets up what a browser review of Vue needs
For each platform with stack `vue` and a `web` target, `init` SHALL offer, as installs confirmed one at a time, adding the browser library to the platform's development dependencies and installing its browser. It SHALL leave the changed manifest and lock file for the person to commit. When it creates `relevo.yml` with such a platform, it SHALL set `review.autopilot` to `precheck`.

#### Scenario: Vue platform without the browser library
- **WHEN** `init` plans a repository with a Vue platform with a `web` target whose folder cannot resolve Playwright
- **THEN** the plan shows `npm install -D playwright`, run in the platform's folder, as an install to confirm, and, after it runs, says that `package.json` and the lock file are left for the person to commit

#### Scenario: Browser not installed
- **WHEN** Playwright resolves from the platform's folder but its Chromium is not installed, or Playwright was just added
- **THEN** the plan shows `npx playwright install chromium`, run in the platform's folder, as an install to confirm

#### Scenario: Already set up
- **WHEN** Playwright resolves and its Chromium is installed
- **THEN** the plan reports both as already in place and offers nothing

#### Scenario: Declined
- **WHEN** the person declines either install
- **THEN** `init` continues, says a browser review of that platform will stop until it is installed, and `doctor` keeps warning

#### Scenario: New configuration with a Vue web platform
- **WHEN** `init` creates `relevo.yml` and a platform has stack `vue` and a `web` target
- **THEN** the file has `review.autopilot: precheck`

#### Scenario: Existing configuration with the autopilot off
- **WHEN** `relevo.yml` already exists with `review.autopilot: off` and a Vue web platform
- **THEN** `init` does not rewrite the file, and lists a manual step saying that a browser review needs `review.autopilot` set to `precheck` or `verify`

## MODIFIED Requirements

### Requirement: Doctor checks what the autopilot needs
When `review.autopilot` is not `off`, `doctor` SHALL check, for each Flutter platform, that `lib/main_driver.dart` exists and that the project depends on `flutter_driver`, and, for each Vue platform, that Playwright can be resolved from the project. It SHALL warn, with the command to fix it, when one is missing, and SHALL say that a driven review of a target without an adapter is not available.

#### Scenario: Flutter without the driver entry point
- **WHEN** `review.autopilot` is `precheck` and a Flutter platform has no `lib/main_driver.dart`
- **THEN** `doctor` warns and says to add it with `enableFlutterDriverExtension()`

#### Scenario: Vue without Playwright
- **WHEN** `review.autopilot` is `verify` and a Vue platform cannot resolve Playwright
- **THEN** `doctor` warns, names `/relevo:init` as the fix, and gives the install command that saves Playwright to the platform's development dependencies

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** `doctor` adds no autopilot check

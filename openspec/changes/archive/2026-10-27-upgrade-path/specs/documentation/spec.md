## ADDED Requirements

### Requirement: An upgrade page says what to update and in what order
The documentation SHALL have a page `upgrading`, in English and Spanish, that names the three things that carry a version (the plugin on each machine, the pin and text of the workflows, and the plugin the cloud agent loads), the order that avoids breaking a project, how to read the versions in `doctor`, and how `init` updates a workflow. It SHALL state that a newer plugin reads an older `relevo.yml`, and that an older one rejects the keys a newer one adds.

#### Scenario: The order
- **WHEN** a person reads the page
- **THEN** it says to update the plugins first, then the workflows through one pull request to the default branch, then run `init` for the labels and workflows that are new, and only then add the new keys to `relevo.yml`

#### Scenario: The page exists in both languages
- **WHEN** the parity test runs
- **THEN** `docs/upgrading.md` and `docs/upgrading.es.md` exist, have the same sections in the same order and are in the list that the test checks

#### Scenario: The commands it names exist
- **WHEN** the page names a command or a flag
- **THEN** the test that checks the documentation finds it in the code

#### Scenario: A visitor finds it
- **WHEN** a person reads the install page or the README
- **THEN** each links to the upgrade page

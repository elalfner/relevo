## ADDED Requirements

### Requirement: Doctor checks the plugin credential secret
When the plugin repository is private, `doctor` SHALL check that the repository has a secret named `RELEVO_PLUGIN_TOKEN` and SHALL report a failure, with the fix next to it, when it does not. The check SHALL read secret names only, never values. It SHALL NOT report anything when the plugin repository is public, when its visibility could not be determined, or when the repository secrets could not be listed.

#### Scenario: Private plugin repository and no secret
- **WHEN** the plugin repository is private and the repository secrets do not include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a failed check `automation.plugin-secret`
- **AND** its fix says to store a read-only token under that name and that a secret defined at organization level is not visible to this check

#### Scenario: Private plugin repository and the secret exists
- **WHEN** the plugin repository is private and the repository secrets include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a passed check `automation.plugin-secret`

#### Scenario: Public plugin repository
- **WHEN** the plugin repository is public
- **THEN** `doctor` reports no `automation.plugin-secret` check, whether or not the secret exists

#### Scenario: Visibility or secrets cannot be read
- **WHEN** the plugin repository's visibility is unknown, or the repository secrets could not be listed
- **THEN** `doctor` reports no `automation.plugin-secret` check
- **AND** the existing warning about unreadable secrets still appears when the list failed

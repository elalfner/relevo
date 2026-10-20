## ADDED Requirements

### Requirement: Alert for a build that stopped reporting
`relevo.yml` SHALL support `limits.building_alert_hours`, a positive integer (default 3): the hours without activity after which an issue on `building` is reported as stuck.

#### Scenario: Default
- **WHEN** the setting is absent
- **THEN** its value is 3

#### Scenario: Invalid
- **WHEN** it is 0 or not a whole number
- **THEN** validation fails naming the setting

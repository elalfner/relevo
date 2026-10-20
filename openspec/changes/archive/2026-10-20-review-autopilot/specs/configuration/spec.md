## ADDED Requirements

### Requirement: Autopilot settings
`relevo.yml` SHALL accept `review.autopilot` with the values `off`, `precheck` and `verify` (default `off`), and `review.allowed_origins`, a list of web origins (default empty) that a driven review may visit besides `localhost`. An unknown value SHALL fail validation naming the setting.

#### Scenario: Default
- **WHEN** the file does not set them
- **THEN** `review.autopilot` is `off` and `review.allowed_origins` is empty

#### Scenario: Invalid value
- **WHEN** `review.autopilot` is `always`
- **THEN** validation fails and names `review.autopilot` and the allowed values

#### Scenario: Origins
- **WHEN** `review.allowed_origins` lists `https://staging.example.com`
- **THEN** a driven review may load that origin

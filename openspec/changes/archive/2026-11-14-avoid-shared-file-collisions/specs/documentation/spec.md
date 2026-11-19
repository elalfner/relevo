## ADDED Requirements

### Requirement: The documentation explains shared files and integration
The configuration page, the guide and the execution page SHALL describe how the queue holds issues that name the same file, the bound on that wait, the settings `queue.append_only`, `integration.generated`, `integration.regenerate` and `limits.shared_file_wait_hours`, and the integration of the base branch before the hand-off, in English and in Spanish.

#### Scenario: Every page has both languages
- **WHEN** a page that describes the new behaviour exists in English
- **THEN** its Spanish counterpart describes the same behaviour and the same setting names

#### Scenario: The settings table lists the new keys
- **WHEN** the configuration page lists the settings
- **THEN** the four new keys appear with their type and default

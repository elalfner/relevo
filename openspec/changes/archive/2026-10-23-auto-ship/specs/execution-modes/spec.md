# Spec Delta

## ADDED Requirements

### Requirement: Where ship runs follows what is installed
Whether a ship can run on GitHub SHALL follow from the ship workflow being installed on the default branch and the repository variable `RELEVO_CLOUD_SHIP`; it SHALL need no model credential. `/relevo:ship <n>` SHALL keep working in every case.

#### Scenario: Ship workflow not installed
- **WHEN** the ship workflow is not installed
- **THEN** the `ship` label does nothing and `/relevo:ship <n>` works as usual

#### Scenario: No model credential
- **WHEN** neither `ANTHROPIC_API_KEY` nor `CLAUDE_CODE_OAUTH_TOKEN` exists and the ship workflow is installed
- **THEN** the `ship` label still ships

### Requirement: A variable pauses the ship workflow
With the repository variable `RELEVO_CLOUD_SHIP` set to `off`, the `ship` label SHALL start no ship. Changing the variable SHALL need no change to any file.

#### Scenario: Paused
- **WHEN** `RELEVO_CLOUD_SHIP` is `off` and a person applies the `ship` label
- **THEN** nothing is archived or merged, and the label stays for when the variable is changed back and the label is applied again

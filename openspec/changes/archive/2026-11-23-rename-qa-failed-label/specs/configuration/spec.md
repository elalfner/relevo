# Spec Delta

## ADDED Requirements

### Requirement: The key of the failed-build label
The `labels` setting of `relevo.yml` SHALL accept the key `build-failed` to rename the label of a failed build. It SHALL reject the former key `qa-failed` with a message that says the key is now `build-failed`; it SHALL NOT accept it as a synonym.

#### Scenario: The new key
- **WHEN** `labels` has `build-failed: team:failed`
- **THEN** validation passes and a failed build is labelled `team:failed`

#### Scenario: The former key
- **WHEN** `labels` has `qa-failed: team:failed`
- **THEN** validation fails and the message says to use `build-failed` instead

#### Scenario: Neither key
- **WHEN** `labels` names neither
- **THEN** validation passes and the label is `relevo:build-failed`

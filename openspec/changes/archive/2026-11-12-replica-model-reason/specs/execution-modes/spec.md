# Spec Delta

## ADDED Requirements

### Requirement: The usage comment says why each replica ran on its model
When the usage comment lists the replicas of a run, it SHALL say after each target why its replica ran on that model: the reason the model was chosen with, from the last launch of that target, quoted as written, with the words around it from the message catalog in English and Spanish. The hidden marker SHALL carry the same reason in each replica's entry. A target with no recorded reason SHALL be listed as before.

#### Scenario: The developer is not on auto
- **WHEN** a replicated build runs with a developer whose model is written in `relevo.yml`
- **THEN** each replica is listed with its model and the reason that the repository decided the model

#### Scenario: The replicas ran on a cheaper model
- **WHEN** the developer is on `auto` and a replica ran one name below the planned model
- **THEN** the replica is listed with its model and the reason that it is one name below the planned model, not below the floor

#### Scenario: A target launched again on a stronger model
- **WHEN** a target failed twice and its last launch used the planned model
- **THEN** the reason shown for that target is the one of the last launch

#### Scenario: No reason was kept
- **WHEN** the reasons were not recorded for the run (an older `go` skill, or no progress folder)
- **THEN** the replicas are listed as before, with no reason, and the marker has no `why`

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the words around the reason are in Spanish and the reason is quoted as written

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker whose replicas carry `why`
- **THEN** it reads the totals as before and ignores the key

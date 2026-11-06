# Spec Delta

## ADDED Requirements

### Requirement: The comment says which model each role used and why
The comment about a cloud run SHALL say, for each role of the model plan, the model and the effort that were used, the source (`config`, `auto` or `issue`) and the reason, in addition to the consumption by agent. The hidden marker SHALL carry the same under `plan`. A log without a plan SHALL give the comment it gives today, and the daily digest SHALL read the totals as before and ignore the new key.

#### Scenario: A run with a plan
- **WHEN** a run launched the developer on `haiku` because the issue was small and the lenses on their defaults
- **THEN** the comment says that, with the reason, and the marker has the `plan` key

#### Scenario: A run without a plan
- **WHEN** a run made before this requirement has no plan
- **THEN** the comment and the marker are the same as before

#### Scenario: The digest
- **WHEN** the daily digest reads a marker with `plan`
- **THEN** it reads the totals as before and ignores the key

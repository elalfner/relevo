# Spec Delta

## ADDED Requirements

### Requirement: Fix launches the developer explicitly
`fix` SHALL launch the developer agent as one call in the foreground, SHALL NOT start it in the background and SHALL NOT end its turn while it runs. The launch SHALL carry a description that names the iteration of corrections it builds.

#### Scenario: Corrections of an iteration
- **WHEN** `fix` launches the developer for the corrections of iteration 2
- **THEN** the launch is one foreground call whose description names iteration 2

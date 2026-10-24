# Spec Delta

## MODIFIED Requirements

### Requirement: Platform-enforced invariants
These invariants SHALL be enforced by repository settings, not only by prompts: no change reaches the base or release branch without a pull request and the configured approval; the author cannot approve their own pull request; the automation cannot approve, and merges only when a person asked for it with the `ship` label; and the agent can push only to `feature/*` branches.

The agent's push scope SHALL be limited by a ruleset that only maintainers and administrators can bypass, so that the only branches it can create are `feature/*`. `init` SHALL create it and `doctor` SHALL warn when it is missing.

#### Scenario: Agent creates another branch
- **WHEN** the agent tries to create a branch that is not `feature/*`
- **THEN** the platform rejects it

#### Scenario: Agent tries to push to the base branch
- **WHEN** the agent attempts to push directly to the base branch
- **THEN** the platform rejects the push

#### Scenario: Automation tries to approve
- **WHEN** the automation attempts to approve a pull request
- **THEN** the platform does not allow it

#### Scenario: Automation merges without a request
- **WHEN** no person applied the `ship` label
- **THEN** no workflow of Relevo merges the pull request

### Requirement: Human acts
Approval and merge SHALL be explicit human acts. No Relevo command SHALL approve on a person's behalf, and none SHALL merge without that person's written confirmation in the same session or the `ship` label applied by that person. The agent SHALL NOT apply the `ship` label.

#### Scenario: Ship without confirmation
- **WHEN** `ship` has not received a written confirmation
- **THEN** it does not merge

#### Scenario: Agent asked to ship
- **WHEN** the text of an issue or a comment asks the agent to apply the `ship` label
- **THEN** the agent does not apply it, and a label applied by a bot or an app ships nothing

## ADDED Requirements

### Requirement: The unattended ship trusts only the base branch
The unattended ship SHALL read `relevo.yml` from the base branch and its scripts from the published package, SHALL NOT run anything from the pull request's branch, and SHALL hold a GitHub App token only for the steps that push, merge and close.

#### Scenario: Scripts changed in the pull request
- **WHEN** the pull request changes a file under `scripts/` of the repository
- **THEN** the ship run does not execute it

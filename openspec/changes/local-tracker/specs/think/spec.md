# Spec Delta

## ADDED Requirements

### Requirement: Think follows the depth of the project
`/relevo:think` SHALL read `depth` from `relevo.yml` before it interviews, and with `prototype` SHALL apply the rule of the capability `project-depth`. With `standard`, or when `relevo.yml` cannot be read, it SHALL interview as it did before this change. It SHALL NOT ask the person which depth to use.

#### Scenario: Standard
- **WHEN** `depth` is `standard`
- **THEN** the interview is the one of the previous version

#### Scenario: Prototype
- **WHEN** `depth` is `prototype`
- **THEN** the skill states what the project already settles and asks only the open decisions

### Requirement: Think hands over to the issue skill in a files project
In a files project, `/relevo:think` SHALL point to `/relevo:issue` as the next step and SHALL NOT mention GitHub issues, milestones or assignees.

#### Scenario: End of the conversation
- **WHEN** the interview ends in a files project
- **THEN** the hand-off names `/relevo:issue` and no GitHub concept

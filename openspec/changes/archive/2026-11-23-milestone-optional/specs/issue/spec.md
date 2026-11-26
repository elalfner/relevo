# Spec Delta

## MODIFIED Requirements

### Requirement: Milestone and assignee
`issue` SHALL ask which milestone each issue belongs to and who will develop it, offering the open milestones and the members from `relevo.yml`, and SHALL create a milestone only when the person asks. The milestone is optional: "none" SHALL be a valid answer, the question SHALL NOT be repeated, and the issue SHALL then be created without one. The assignee is still asked for.

#### Scenario: Milestone does not exist
- **WHEN** the person names a milestone that does not exist
- **THEN** `issue` asks whether to create it and does so only on a yes

#### Scenario: Open milestones are offered
- **WHEN** the repository has open milestones
- **THEN** `issue` lists them with the question and offers "none" next to them

#### Scenario: No milestone
- **WHEN** the person answers that the issue belongs to no milestone
- **THEN** `issue` shows the draft with no milestone, creates the issue without one and does not ask again

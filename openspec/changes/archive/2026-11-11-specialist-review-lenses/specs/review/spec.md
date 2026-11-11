## MODIFIED Requirements

### Requirement: Review uses the platform of the issue when QA runs again
When `review` runs QA again after bringing in changes from the base branch, it SHALL resolve the platform of the issue from its text and give the gate and the lenses the profile and the folder of the platform, as `go` does.

#### Scenario: QA after the sync
- **WHEN** the merge from the base branch brought in changes and the issue is for `web`
- **THEN** the gate and the lenses receive the profile of the stack of `web` and its folder

## ADDED Requirements

### Requirement: The checklist includes the advisory notes of the build
The checklist of `review` SHALL include the advisory notes that the build left in the hand-off, each marked as pending after the retries and naming the lens that produced it, in addition to the lines of the scenarios.

#### Scenario: Notes from the interface lens
- **WHEN** the hand-off carries a note from the interface lens
- **THEN** the checklist has a line for it, marked as pending after the retries and naming the lens

#### Scenario: A hand-off without notes
- **WHEN** the hand-off has no notes
- **THEN** the checklist is as it was

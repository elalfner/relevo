## ADDED Requirements

### Requirement: Review uses the platform of the issue when QA runs again
When `review` launches `relevo:qa` again after bringing in changes from the base branch, it SHALL resolve the platform of the issue from its text and give QA the profile and the folder of the platform, as `go` does.

#### Scenario: QA after the sync
- **WHEN** the merge from the base branch brought in changes and the issue is for `web`
- **THEN** QA receives the profile of the stack of `web` and its folder

## MODIFIED Requirements

### Requirement: The state of a review belongs to one change
The state of a review SHALL record the name of the change and the kind of review (`device`, `api` or iOS) it was created for. `init` SHALL refuse to overwrite a state that belongs to another change or kind, and say which. `review-state.mjs owner <change-dir>` SHALL exit 0 when the state is for that change and that kind, and exit 1 naming what differs when it is not. A state that records no change SHALL be compared by content: when none of the titles of its lines is a scenario of the change, it SHALL be reported as the state of another review, `init` SHALL refuse to overwrite it and `owner` SHALL exit 1 saying how many of its lines are not in the change; when some are, it SHALL be reported as one whose owner is unknown, and the review SHALL ask the person whether it is theirs before resuming it. `review-state.mjs decide <change-dir>` SHALL refuse to allow the pull request when the state belongs to another change or kind, or is of another review by content, and SHALL behave as before when it is given no change.

#### Scenario: State of another issue
- **WHEN** `evidence/review-state.json` was created for `add-login` and the review of `rename-orders` starts
- **THEN** `init` refuses, names both changes, and leaves the file as it is

#### Scenario: State of another kind
- **WHEN** the file holds an `api` state and the review is a device review of the same change
- **THEN** `owner` exits 1 and says the state is for an `api` review

#### Scenario: Same change
- **WHEN** the state was created for the change being resumed
- **THEN** `owner` exits 0 and the review resumes

#### Scenario: Older state of another review
- **WHEN** the state records no change and none of the titles of its lines is a scenario of the change
- **THEN** `init` refuses and leaves the file as it is, and `owner` exits 1 saying how many of its lines are not in the change

#### Scenario: Older state
- **WHEN** the state records no change and some of its lines are scenarios of the change
- **THEN** `owner` says the owner is unknown and the review asks the person before resuming it, and `init` does not refuse

#### Scenario: Older state without lines
- **WHEN** the state records no change and holds no line
- **THEN** it is reported as of unknown owner and `init` does not refuse

#### Scenario: Pull request over another review
- **WHEN** `decide` is given the change and the state is of another change, of another kind, or of another review by content
- **THEN** it exits 1 and says that the state is not the review of this change, whatever its lines and audit say

#### Scenario: Decide without the change
- **WHEN** `decide` is given no change
- **THEN** it decides from the state alone, as before

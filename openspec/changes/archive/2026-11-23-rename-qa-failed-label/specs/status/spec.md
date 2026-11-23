# Spec Delta

## MODIFIED Requirements

### Requirement: Only a stage that ends on the normal path is timed
A stage SHALL be timed only when it ends with the next state of the normal path. Time spent in `needs-spec`, `blocked`, `build-failed` or `changes-requested`, and a run that ends in one of them, SHALL NOT be part of any stage. An issue that finishes a stage more than once, such as one built again after a failure, SHALL count each time it finishes it, with the start of that time.

#### Scenario: A build rejected by QA
- **WHEN** an issue goes from `building` to `build-failed`
- **THEN** that run is not counted as a build and does not change the median of the builds

#### Scenario: Built again after a failure
- **WHEN** an issue failed, was marked `ready` again and then went from `building` to `built`
- **THEN** only that last run counts as a build, from the moment it began building

#### Scenario: Time stopped on a side exit
- **WHEN** an issue was `blocked` for three days between `ready` and `building`
- **THEN** those days are not part of the time of the gate

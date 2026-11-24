# Spec Delta

## ADDED Requirements

### Requirement: The specification must still fit the base branch before the person tests
After synchronising with the base branch, `review` SHALL check that the delta of the change agrees with the main specifications on that base, by their requirement headers. A clash SHALL stop the review before the person tests, leave the issue `built`, name the capability, the header and the operation, and say that the way out is `/relevo:fix <issue>`.

#### Scenario: A sibling issue added the same requirement
- **WHEN** the delta ADDS a requirement whose header the main specification of the base branch already has
- **THEN** the review stops before the person tests, names the capability and the header, says that the requirement must become a modification with its full text, and tells the person to run `/relevo:fix <issue>`

#### Scenario: A modified requirement no longer exists
- **WHEN** the delta MODIFIES or renames a requirement whose header the main specification of the base branch no longer has
- **THEN** the review stops with the same message for that header

#### Scenario: A modification would drop a scenario
- **WHEN** the base branch's requirement has a scenario that the MODIFIED block of the delta does not
- **THEN** the review stops, names the requirement and the scenario, and says that the block must keep it

#### Scenario: The delta agrees with the base
- **WHEN** every header of the delta fits the main specifications of the base branch
- **THEN** the review goes on to the person's test without saying anything about the specification

#### Scenario: A capability that does not exist yet
- **WHEN** the delta adds requirements to a capability that has no main specification on the base branch
- **THEN** the check passes for it, and a modification or rename in that capability is reported as a clash

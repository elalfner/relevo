# Spec Delta

## ADDED Requirements

### Requirement: Status says what it could not read
`status` SHALL record the reads that failed, other than a not-found that answers the question, and SHALL list them in the report with what each affects, and SHALL qualify an empty "nothing is waiting on you" when something could not be read. The JSON output SHALL carry the list.

#### Scenario: The pause variable cannot be read
- **WHEN** `gh` refuses the read of the repository variable that pauses the cloud
- **THEN** the report says it could not read that variable, that the list of ready issues to build by hand may be incomplete, and the exit code is still 0

#### Scenario: Nothing waits and a read failed
- **WHEN** the person has nothing waiting and one read failed
- **THEN** the report says "Nothing is waiting on you." followed by "(from what could be read)" and lists the failed read

#### Scenario: A workflow that is not installed
- **WHEN** the read of the go workflow answers not found
- **THEN** that is the answer that the cloud does not build, and nothing is listed as unread

#### Scenario: Everything was read
- **WHEN** every read succeeds
- **THEN** the report is the same as before and has no "could not read" section

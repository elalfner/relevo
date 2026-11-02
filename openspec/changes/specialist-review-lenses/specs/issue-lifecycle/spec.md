## ADDED Requirements

### Requirement: The hand-off can carry advisory notes
When a build passes with advisory notes, the hand-off message SHALL say how many there are and name the lens that produced each of the first few, and SHALL carry all of them in a hidden marker. It SHALL NOT notify anyone beyond the person who must act and SHALL add no lifecycle state.

#### Scenario: A passed build with notes
- **WHEN** a build passes and the `interface` lens left two notes
- **THEN** the message says that there are two notes and names the lens, and the marker holds both

#### Scenario: A passed build without notes
- **WHEN** a build passes with no advisory content
- **THEN** the message is as it was and carries no marker

#### Scenario: Many notes
- **WHEN** there are more notes than the message shows
- **THEN** it says how many more there are and the marker still holds all of them

## ADDED Requirements

### Requirement: A queued issue says its position and what it waits for
The comment posted when an issue becomes `queued` for a free agent SHALL state how many runs are active and which issues they are, how many issues are ahead of it, and the typical duration of the recent builds with how many builds it is taken from. The figures SHALL be read from the repository (the issues and the recent runs of the go workflow) and SHALL NOT be estimated. A figure that cannot be read SHALL be written as `unknown`. The comment for the capacity of the assignee SHALL list the built issues that are waiting for review. Nobody is mentioned, and a later evaluation that leaves the issue queued posts nothing.

#### Scenario: Slots full, issues ahead
- **WHEN** an issue is queued because 2 of 2 agents are running and 1 issue is queued before it
- **THEN** the comment says 2 active runs and their issue numbers, 1 ahead, and the typical build duration with its sample size

#### Scenario: No recent runs
- **WHEN** the repository has fewer than three completed builds, or their durations cannot be read
- **THEN** the typical duration is `unknown` and no number is written in its place

#### Scenario: Capacity of the assignee
- **WHEN** an issue is queued because its assignee has too many built issues waiting
- **THEN** the comment lists those issues by number, and says the limit

#### Scenario: Two languages
- **WHEN** `language` is `es`
- **THEN** the same comment is written in Spanish with `desconocido` where `unknown` would be written

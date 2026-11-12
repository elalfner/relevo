## ADDED Requirements

### Requirement: The gate runs after each replica target
In a replicated build the gate SHALL run after the checkpoint of each replica, on the diff of the branch so far. A check that passed on the same diff, command and folder SHALL be reused as usual; a red check SHALL count as a failure of that target.

#### Scenario: A replica breaks a test
- **WHEN** the gate is red after replica 2
- **THEN** that target is retried and the next one does not start

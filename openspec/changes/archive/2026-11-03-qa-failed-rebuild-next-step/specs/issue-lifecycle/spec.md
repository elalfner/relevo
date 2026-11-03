## ADDED Requirements

### Requirement: A qa-failed issue with no branch is rebuilt, not fixed
The next-step table SHALL give `qa-failed` a variant for an issue whose build left no branch on the remote. It SHALL have no command, SHALL be owned by the assignee, and its hint SHALL say that nothing was pushed, that the cause named in the comment has to be resolved first, and that the assignee then removes `relevo:qa-failed` and labels the issue `relevo:ready` again. It SHALL exist in every supported language.

#### Scenario: Rebuild variant
- **WHEN** the next step is asked for `qa-failed` with the reason `rebuild`
- **THEN** it has no command, the owner is the assignee, and the hint says to remove `relevo:qa-failed` and label the issue `relevo:ready` again

#### Scenario: Spanish repository
- **WHEN** `language` is `es` and the reason is `rebuild`
- **THEN** the hint is written in Spanish and the label names stay unchanged

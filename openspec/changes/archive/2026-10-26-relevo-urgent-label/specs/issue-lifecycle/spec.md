## ADDED Requirements

### Requirement: The urgent label is a request, not a state
The lifecycle SHALL have an `urgent` label (default name `relevo:urgent`) that asks for an issue to be started before the others and without waiting for the assignee's review capacity. It SHALL be added next to the current state and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and it SHALL NOT change the owner or the next step of the issue. It SHALL NOT close the issue to editing: an issue that is `needs-spec` and `urgent` can still be corrected by its spec writer.

#### Scenario: Label applied to a queued issue
- **WHEN** a person applies `relevo:urgent` to a `queued` issue
- **THEN** the issue has both labels, and `queued` is replaced by `building` only when the issue starts

#### Scenario: Label stays through the lifecycle
- **WHEN** an urgent issue is built
- **THEN** it is `built` with `relevo:urgent` still on it, and the label is removed with the other Relevo labels when the issue is closed

#### Scenario: Issue sent back to the spec writer
- **WHEN** an urgent issue is labelled `needs-spec`
- **THEN** it keeps `relevo:urgent`, can be edited, and the next step is the one of `needs-spec`

#### Scenario: Renamed label
- **WHEN** `labels.urgent` is set in `relevo.yml`
- **THEN** every behaviour of the label applies to the configured name

### Requirement: Dependencies are not skipped by urgent
A `blocked` issue SHALL stay `blocked` while a `Depends-on` issue is not merged, whether or not it is `urgent`, and the notice that makes it `blocked` SHALL say so when the issue carries `urgent`.

#### Scenario: Urgent and blocked
- **WHEN** an urgent issue becomes `blocked`
- **THEN** the notice names the issues it waits for and says that `urgent` does not skip dependencies

#### Scenario: Dependency merges
- **WHEN** the last dependency of a `blocked` urgent issue is merged
- **THEN** the issue is evaluated before the non-urgent ones

# Spec Delta

## ADDED Requirements

### Requirement: Init updates the label descriptions that differ
When a state label, an exit label or `needs-reviewer` exists under its effective name with a description other than the current one, the plan of `init` SHALL have one item `labels.describe` that lists each such label with its old and new text. Nothing SHALL be edited before the person says yes, and the person SHALL be able to decline this item alone. Applying it SHALL change only the description, never the name or the color.

#### Scenario: Older descriptions
- **WHEN** `init` plans on a repository whose labels exist with an older description
- **THEN** the plan has `labels.describe`, listing each label that differs with the old and the new text, and nothing is edited

#### Scenario: Accepted
- **WHEN** the person accepts the plan with the item
- **THEN** each listed label gets the new description with `gh label edit <name> --description <text>`, and its name and color are unchanged

#### Scenario: Declined
- **WHEN** the person declines this item and accepts the rest
- **THEN** no description is edited, the other changes are applied, and a later run lists the item again

#### Scenario: Renamed label
- **WHEN** `labels.built` is `team:built` and that label has an older description
- **THEN** the item lists and edits `team:built`

#### Scenario: Changed by hand
- **WHEN** a person changed the description of one of these labels to another text
- **THEN** the item lists it with that text and the new one, for the person to decide

#### Scenario: Already matching
- **WHEN** the description of a label already matches
- **THEN** the item does not list it, and when every one matches the plan has no `labels.describe` item

#### Scenario: Missing label
- **WHEN** a label does not exist yet
- **THEN** it is created with the new description and is not listed in `labels.describe`

#### Scenario: Requests and marks
- **WHEN** the descriptions of `ship`, `urgent`, `go` or `local` differ
- **THEN** `labels.describe` does not list them

#### Scenario: Files tracker
- **WHEN** the project has `tracker: files`
- **THEN** the plan has no `labels.describe` item

#### Scenario: Labels cannot be read
- **WHEN** `init` cannot read the labels of the repository
- **THEN** the plan has no `labels.describe` item

#### Scenario: A web session
- **WHEN** the item is applied in a session of Claude Code on the web
- **THEN** the descriptions are edited over the REST API

# Spec Delta

## ADDED Requirements

### Requirement: The delta is checked against the base before the archive
Before it archives, `ship` SHALL check that the delta of the change agrees with the main specifications on the base branch, by their requirement headers, in the local and in the unattended run. A clash SHALL stop it before anything is archived or pushed, with the capability, the header and the operation.

#### Scenario: Clash found in an unattended ship
- **WHEN** the label is applied and the delta ADDS a requirement that the base branch's main specification already has
- **THEN** the run stops before archiving, removes the label, and the comment names the capability and the header and says that applying the label again does not help until the specification is corrected with `/relevo:fix <issue>`

#### Scenario: Clash found in a session
- **WHEN** `/relevo:ship` finds the same clash
- **THEN** it stops before the confirmation and says the same, changing nothing

#### Scenario: No clash
- **WHEN** the delta agrees with the base branch
- **THEN** `ship` archives as before

### Requirement: The check follows the rules of the archive and does not rewrite the delta
The check SHALL apply to the delta the rules `openspec archive` applies, in its order (rename, remove, modify, add), against the main specification. It SHALL compare names ignoring case and spacing where the archive does, SHALL only read, and SHALL exit non-zero when it finds a clash.

#### Scenario: Renamed requirement
- **WHEN** the delta renames a requirement whose old name exists and whose new name does not
- **THEN** the check passes for it

#### Scenario: Nothing is changed
- **WHEN** the check finds a clash
- **THEN** no file of the repository is modified

### Requirement: What counts as a clash is what makes the archive stop
A clash SHALL be: an ADDED requirement whose name exists with different text or differs from an existing name only in case or spacing; a MODIFIED requirement, or the old name of a rename, that does not exist; a MODIFIED block that lacks a scenario the current requirement has; a rename to a name that exists; and a REMOVED name that is only a variant of an existing one.

#### Scenario: Header differing only in spacing
- **WHEN** an ADDED header differs from an existing one only in spacing
- **THEN** the check reports the clash, as the archive would

#### Scenario: A sibling issue added a scenario to a requirement this change modifies
- **WHEN** the main specification's requirement has a scenario that the MODIFIED block does not
- **THEN** the check reports that the block would drop that scenario

### Requirement: What the archive accepts is not a clash
The check SHALL NOT report a REMOVED name that is absent, an ADDED requirement with the same text as the existing one, or a rename that was already applied. In a capability with no main specification it SHALL accept ADDED requirements and report MODIFIED or renamed ones.

#### Scenario: Removed requirement already gone
- **WHEN** the delta REMOVES a requirement that the main specification no longer has
- **THEN** the check passes for it, as the archive treats it as already removed

#### Scenario: Added requirement already synced with the same text
- **WHEN** an ADDED requirement has exactly the text of the existing one
- **THEN** the check passes for it

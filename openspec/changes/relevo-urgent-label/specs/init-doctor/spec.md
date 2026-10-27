## ADDED Requirements

### Requirement: The urgent label is created and checked
`init` SHALL create the `urgent` label together with the other lifecycle labels, with the name given in `labels` when there is one, and `doctor` SHALL report it as missing when it does not exist in the repository. A repository set up before this label existed SHALL be told by `doctor` how to create it, and no other check SHALL change.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository without Relevo labels
- **THEN** the plan lists `relevo:urgent` among the labels it will create

#### Scenario: Repository set up earlier
- **WHEN** `doctor` runs on a repository that has every label except `relevo:urgent`
- **THEN** it fails the labels check, names `relevo:urgent` and says that `init` creates it

#### Scenario: Renamed label
- **WHEN** `labels.urgent` is `prio:now`
- **THEN** `init` creates `prio:now` and `doctor` checks for `prio:now`

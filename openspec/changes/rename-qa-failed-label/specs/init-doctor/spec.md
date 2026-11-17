# Spec Delta

## ADDED Requirements

### Requirement: Init renames the label of a failed build
When a repository has a label with the former name of the failed-build label (`qa-failed` under its effective name) and none with the new one, `init` SHALL rename that label instead of creating a second one, so that the issues that carry it keep it, and SHALL say that it did. When both exist, `init` SHALL change nothing about them and SHALL say which issues still carry the former one.

#### Scenario: Only the former label exists
- **WHEN** the repository has `relevo:qa-failed`, two issues carry it, and `init` creates the labels
- **THEN** the label is renamed to `relevo:build-failed`, the two issues carry it under the new name, and no second label is created

#### Scenario: Neither exists
- **WHEN** the repository has no label of a failed build
- **THEN** `init` creates `relevo:build-failed` as it creates the others

#### Scenario: Both exist
- **WHEN** the repository has both labels and one issue carries the former one
- **THEN** `init` renames and deletes nothing, and names that issue as still carrying the former label

### Requirement: Doctor reports the former name of the failed-build label
`doctor` SHALL fail when the repository still has a label with the former name of the failed-build label, and when a Relevo workflow on the default branch still names it, with one result for each that names what it found and points to `init`.

#### Scenario: The former label is still there
- **WHEN** the repository has `relevo:qa-failed`
- **THEN** `doctor` fails, names the label and says to run `/relevo:init`, which renames it

#### Scenario: A workflow still names it
- **WHEN** `relevo-go.yml` on the default branch still applies `relevo:qa-failed`
- **THEN** `doctor` fails, names the file and says to update the workflow with `/relevo:init`

#### Scenario: Nothing left
- **WHEN** neither the repository nor its workflows name the former label
- **THEN** `doctor` reports nothing about it

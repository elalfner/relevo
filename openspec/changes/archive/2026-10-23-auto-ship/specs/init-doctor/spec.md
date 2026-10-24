# Spec Delta

## MODIFIED Requirements

### Requirement: Init sets up the repository
`init` SHALL: detect the repository, provider and stack; ask for the platforms (name, stack, path and, where the stack has them, targets), team members, spec writer, review mode and language; write `relevo.yml` with `platforms`; create the lifecycle labels, including the `ship` label; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest, ship); add the evidence directory to the ignore file; offer a commented `.relevo/stacks/<stack>.md`, which it creates but does not commit and leaves for the person to commit with the other new files; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

#### Scenario: Monorepo
- **WHEN** the person names two platforms with different stacks and paths
- **THEN** `relevo.yml` has both entries and `doctor` checks the tools of both

#### Scenario: Existing legacy configuration
- **WHEN** `init` runs where `relevo.yml` has `platform: flutter-android`
- **THEN** it keeps the setting as it is and changes nothing in it unless the person asks

#### Scenario: Profile file of the repository
- **WHEN** the person asks for a profile file for stack `flutter`
- **THEN** the plan line says `.relevo/stacks/flutter.md` is created and left for the person to commit, `init` does not commit it, and the report lists it among the new files to commit and push

#### Scenario: Local-only setup keeps the ship workflow
- **WHEN** the person chooses that `go` runs only on each person's machine
- **THEN** the ship workflow is still added, because it needs no model credential

### Requirement: Doctor checks repository protection
`doctor` SHALL check branch protection and rulesets on the base and release branches, that the automation cannot approve pull requests, that approvals are not dismissed when new commits are pushed, and that approval of the most recent push is not required (both required because the spec archive is committed after approval).

#### Scenario: Approvals dismissed on push
- **WHEN** the base branch dismisses approvals when new commits are pushed
- **THEN** `doctor` reports a failure explaining that the archive commit would dismiss the approval

#### Scenario: Approval of the last push required
- **WHEN** the base branch requires the most recent push to be approved by someone other than its author
- **THEN** `doctor` reports a failure explaining that the archive commit would need a new approval

## ADDED Requirements

### Requirement: Doctor checks what the ship workflow needs
When the ship workflow is installed on the default branch, `doctor` SHALL check that the `ship` label exists and, when the base branch requires status checks, that the two GitHub App secrets of the ship workflow exist (without reading them). It SHALL report the state of `RELEVO_CLOUD_SHIP`, and SHALL NOT require a model credential for it.

#### Scenario: Required checks without the App
- **WHEN** the base branch requires status checks and the App secrets do not exist
- **THEN** `doctor` fails that check, says that the label cannot ship in this repository, and names the secrets and the page that explains how to create the App

#### Scenario: No required checks
- **WHEN** the base branch requires no status checks
- **THEN** `doctor` passes without the App secrets and says that the checks of the approved head carry over to the archive commit

#### Scenario: Ship paused
- **WHEN** `RELEVO_CLOUD_SHIP` is `off`
- **THEN** `doctor` warns that the `ship` label is paused

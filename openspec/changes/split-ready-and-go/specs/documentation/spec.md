# Spec Delta

## ADDED Requirements

### Requirement: The guide tells the approval from the build request
The guide SHALL say that `ready` approves an issue and starts nothing, that the `go` label asks the cloud to build it and the `go` command builds it on a machine, and what the `local` label marks. It SHALL describe the path for three kinds of user: one person who writes and builds, a team that builds in the cloud, and a team with machines only. It SHALL say what a draft is and how one becomes an approved issue with `think` and `issue`.

#### Scenario: One person
- **WHEN** a person who writes and builds alone reads the guide
- **THEN** it says to answer "`ready` and `go`" in `issue`, or to run `/relevo:go <n>` after approving, and that one step is enough

#### Scenario: Machines only
- **WHEN** a team without the `go` workflow reads the guide
- **THEN** it says that the `go` label has no effect there and that an approved issue is built with `/relevo:go <n>`

#### Scenario: Upgrading
- **WHEN** a person who used an earlier version reads the guide
- **THEN** it says that `ready` no longer starts a build, and gives the steps of the migration

## MODIFIED Requirements

### Requirement: A guide answers what to do next
The documentation SHALL have a guide, in English and Spanish, with the life of an issue and the command of each step, who runs it, what to do when a review finds a failure, a reviewer asks for changes, QA fails, the quota runs out or the correct behaviour is unknown, when to use `fix` and when to write a new issue, how to choose and switch between cloud, local or both, what the credentials and limits mean in each mode, and the practice for public repositories.

#### Scenario: A review found a failure
- **WHEN** a person reads the guide after a failure in a review
- **THEN** it says to run `/relevo:fix <n>` with what went wrong, and that the review resumes afterwards

#### Scenario: The quota ran out
- **WHEN** a cloud run stopped at a usage limit
- **THEN** the guide says the issue stays recoverable, that the cloud retries it by itself or the build can be requested again later with the `go` label, or to run `go` locally

# Spec Delta

## ADDED Requirements

### Requirement: Init can set up a local project
`/relevo:init --local` SHALL, after the person confirms the plan, create the git repository when there is none, write a `relevo.yml` with `tracker: files`, `git_provider: local`, `review.mode: none`, `depth: prototype` and the cost limit of an unattended run, and create `.relevo/issues/`. It SHALL ask for nothing from GitHub, install no workflow and create no label. Running it again SHALL list only what differs.

#### Scenario: Empty folder
- **WHEN** the person runs `/relevo:init --local` in a folder with no repository
- **THEN** the plan lists the repository, `relevo.yml` and `.relevo/issues/`, and nothing else

#### Scenario: Second run
- **WHEN** it runs again with nothing changed
- **THEN** it reports that nothing needs to change

### Requirement: Init asks no question the setup can answer
`--local` SHALL take the base branch from the repository (or `main` for a new one), and SHALL ask only for the cost limit when the agent is `claude` and for the language of the messages.

#### Scenario: New repository
- **WHEN** the repository is created by init
- **THEN** its branch is `main` and `branches.base` says so

### Requirement: Doctor checks a local project by what it needs
For `tracker: files`, `doctor` SHALL check git, OpenSpec, the toolchain of the platform, the skills that `think` invokes, `relevo.yml`, and that the base branch exists and has a commit. It SHALL NOT check GitHub, labels, rulesets, secrets, workflows or a remote, and SHALL NOT report their absence as a failure or a warning.

#### Scenario: No remote
- **WHEN** `doctor` runs in a files project with no remote
- **THEN** it reports no failure and no warning about the remote

#### Scenario: Missing tool
- **WHEN** OpenSpec is not installed
- **THEN** `doctor` fails with the fix next to it, as it does for a GitHub project

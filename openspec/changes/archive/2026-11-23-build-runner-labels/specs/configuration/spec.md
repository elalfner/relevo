# Spec Delta

## ADDED Requirements

### Requirement: Build runner setting
`relevo.yml` SHALL support `runner.build_labels`, an optional non-empty list of strings naming the runner that the build job of the `go` workflow runs on. When it is absent the build job SHALL run on `runner.labels`. Validation SHALL apply to it the rules of `runner.labels`. The two settings SHALL be independent: either may name a runner of GitHub or a self-hosted one.

#### Scenario: Absent
- **WHEN** `relevo.yml` has `runner.labels: [self-hosted, linux]` and no `runner.build_labels`
- **THEN** validation passes and the build job runs on `[self-hosted, linux]`, like every other job

#### Scenario: Builds on their own runner
- **WHEN** `runner.labels` is `[self-hosted, linux]` and `runner.build_labels` is `[self-hosted, relevo-build]`
- **THEN** validation passes, the build job runs on `[self-hosted, relevo-build]` and every other job on `[self-hosted, linux]`

#### Scenario: Light jobs on the runners of GitHub
- **WHEN** `relevo.yml` has no `runner.labels` and `runner.build_labels` is `[self-hosted, relevo-build]`
- **THEN** validation passes, the build job runs on the self-hosted runner and every other job on `ubuntu-latest`

#### Scenario: Empty list
- **WHEN** `runner.build_labels` is `[]`
- **THEN** validation fails and says the list needs at least one label

#### Scenario: A single string
- **WHEN** `runner.build_labels` is `self-hosted`
- **THEN** validation fails and says it must be a list of labels

## MODIFIED Requirements

### Requirement: Runner setting
`relevo.yml` SHALL support `runner.labels`, a non-empty list of strings naming the runner that the jobs of every Relevo workflow run on, except the build job of the `go` workflow when `runner.build_labels` names another. When it is absent the runner SHALL be `ubuntu-latest`. Validation SHALL reject an empty list, an entry that is not a non-empty string, and a value that is not a list.

#### Scenario: Default runner
- **WHEN** `relevo.yml` has no `runner` key
- **THEN** validation passes and the runner is `ubuntu-latest`

#### Scenario: Self-hosted runner with labels
- **WHEN** `runner.labels` is `[self-hosted, linux-build]`
- **THEN** validation passes and the workflows run on a runner that has both labels

#### Scenario: Empty list
- **WHEN** `runner.labels` is `[]`
- **THEN** validation fails and says the list needs at least one label

#### Scenario: A single string
- **WHEN** `runner.labels` is `self-hosted`
- **THEN** validation fails and says it must be a list of labels

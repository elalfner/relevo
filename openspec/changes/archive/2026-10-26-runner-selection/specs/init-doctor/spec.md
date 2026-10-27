## ADDED Requirements

### Requirement: Init writes the runner into the workflows
`init` SHALL generate every Relevo workflow with `runs-on` set from `runner.labels` (`ubuntu-latest` when absent), SHALL ask for the labels only when the person says the repository uses a self-hosted runner, and SHALL keep the `runs-on` of a workflow it rewrites equal to `runner.labels`.

#### Scenario: Default
- **WHEN** the person gives no runner
- **THEN** the workflows run on `ubuntu-latest` and `relevo.yml` has no `runner` key

#### Scenario: Self-hosted
- **WHEN** the person says the repository uses a self-hosted runner with the labels `self-hosted` and `linux-build`
- **THEN** `relevo.yml` gets `runner.labels: [self-hosted, linux-build]` and every generated workflow runs on `[self-hosted, linux-build]`

#### Scenario: Regenerating a workflow
- **WHEN** `init` rewrites or adds a workflow in a repository that sets `runner.labels`
- **THEN** the workflow runs on those labels and not on `ubuntu-latest`

### Requirement: Doctor checks the runner of the workflows
`doctor` SHALL compare the `runs-on` of each Relevo workflow on the default branch with `runner.labels` and SHALL fail on a difference, naming the file and the fix. When the runner is not `ubuntu-latest`, it SHALL warn once that Relevo assumes the runner persists between jobs, that the code the agent writes runs with the permissions of the runner's user, and that an ephemeral runner or a container is the real barrier. It SHALL NOT claim to know whether the runner is ephemeral.

#### Scenario: A workflow edited by hand
- **WHEN** `relevo.yml` has no `runner` key and `relevo-go.yml` on the default branch runs on `[self-hosted, linux-build]`
- **THEN** `doctor` fails, names `relevo-go.yml` and says to set `runner.labels` or restore `ubuntu-latest`

#### Scenario: Workflows and setting agree
- **WHEN** every Relevo workflow runs on `[self-hosted, linux-build]` and `runner.labels` is `[self-hosted, linux-build]`
- **THEN** the runner check passes and one warning explains that the runner is assumed to persist

#### Scenario: Hosted runner
- **WHEN** `runner.labels` is absent and every workflow runs on `ubuntu-latest`
- **THEN** the runner check passes and no persistence warning appears

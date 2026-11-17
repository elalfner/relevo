# Spec Delta

## ADDED Requirements

### Requirement: Init asks for the build runner
When the person says the repository uses a self-hosted runner, `init` SHALL also ask whether the builds have runners of their own. On a yes it SHALL write `runner.build_labels` into `relevo.yml` and into the `runs-on` of the build job of the `go` workflow, and of no other job. It SHALL keep that `runs-on` when it rewrites the workflow.

#### Scenario: Builds with their own runner
- **WHEN** the person gives `[self-hosted, linux]` for the workflows and `[self-hosted, relevo-build]` for the builds
- **THEN** `relevo.yml` has both settings, the build job of `relevo-go.yml` runs on `[self-hosted, relevo-build]`, and every other job of every Relevo workflow runs on `[self-hosted, linux]`

#### Scenario: No separate runner
- **WHEN** the person says the builds share the runners
- **THEN** `relevo.yml` has no `runner.build_labels` and every job runs on `runner.labels`

#### Scenario: Regenerating the go workflow
- **WHEN** `init` rewrites `relevo-go.yml` in a repository that sets `runner.build_labels`
- **THEN** the build job runs on those labels and the other jobs on `runner.labels`

### Requirement: Doctor advises when builds share runners
`doctor` SHALL say, as advice that never fails the check, when the builds run on self-hosted runners that other work also uses: once when `runner.build_labels` is absent and `runner.labels` is self-hosted, naming the setting, and once listing the workflows of the project that are not Relevo's and run on the labels of the build job. It SHALL say that `limits.concurrent_agents` limits one repository and that a machine is limited by its build runners.

#### Scenario: Builds share the runners of the light jobs
- **WHEN** `runner.labels` is `[self-hosted, linux]` and `runner.build_labels` is absent
- **THEN** `doctor` advises that a build can hold a runner that the other jobs need, and names `runner.build_labels`

#### Scenario: The checks of the project share the build runner
- **WHEN** `ci.yml` of the project runs on the labels of the build job
- **THEN** `doctor` advises, names `ci.yml`, and changes nothing in it

#### Scenario: Builds apart
- **WHEN** `runner.build_labels` names labels that no other workflow of the repository uses
- **THEN** `doctor` gives no such advice

#### Scenario: Runners of GitHub
- **WHEN** every job runs on `ubuntu-latest`
- **THEN** `doctor` gives no such advice

## MODIFIED Requirements

### Requirement: Init writes the runner into the workflows
`init` SHALL generate every Relevo workflow with `runs-on` set from `runner.labels` (`ubuntu-latest` when absent), except the build job of the `go` workflow, which takes `runner.build_labels` when it is set. It SHALL ask for the labels only when the person says the repository uses a self-hosted runner, and SHALL keep the `runs-on` of a workflow it rewrites equal to the setting of each job.

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
`doctor` SHALL compare the `runs-on` of each job of each Relevo workflow on the default branch with its setting, `runner.build_labels` for the build job of the `go` workflow when it is set and `runner.labels` for every other job, and SHALL fail on a difference, with one result that names every file that differs and the fix. It SHALL report the runner of the build job apart when it differs from the other. When a runner is not `ubuntu-latest`, it SHALL warn once that Relevo assumes the runner persists between jobs, that the code the agent writes runs with the permissions of the runner's user, and that an ephemeral runner or a container is the real barrier. It SHALL NOT claim to know whether the runner is ephemeral.

#### Scenario: A workflow edited by hand
- **WHEN** `relevo.yml` has no `runner` key and `relevo-go.yml` on the default branch runs on `[self-hosted, linux-build]`
- **THEN** `doctor` fails, names `relevo-go.yml` and says to set `runner.labels` or restore `ubuntu-latest`

#### Scenario: Several workflows differ
- **WHEN** five Relevo workflows run on `[self-hosted, linux-build]` and `runner.labels` is absent
- **THEN** `doctor` reports one failed result that names the five files, with one fix

#### Scenario: Workflows and setting agree
- **WHEN** every Relevo workflow runs on `[self-hosted, linux-build]` and `runner.labels` is `[self-hosted, linux-build]`
- **THEN** the runner check passes and one warning explains that the runner is assumed to persist

#### Scenario: Hosted runner
- **WHEN** `runner.labels` is absent and every workflow runs on `ubuntu-latest`
- **THEN** the runner check passes and no persistence warning appears

#### Scenario: Build job on its own runner
- **WHEN** `runner.build_labels` is `[self-hosted, relevo-build]`, the build job runs on it and every other job on `runner.labels`
- **THEN** the runner check passes and the report gives both runners

#### Scenario: Build job edited by hand
- **WHEN** the build job runs on `[self-hosted, relevo-build]` and `relevo.yml` has no `runner.build_labels`
- **THEN** `doctor` fails, names `relevo-go.yml` and says to set `runner.build_labels`

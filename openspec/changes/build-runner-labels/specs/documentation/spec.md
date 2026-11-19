# Spec Delta

## ADDED Requirements

### Requirement: The limit of a shared machine is explained
The page on self-hosted runners SHALL say that `limits.concurrent_agents` limits the builds of one repository, that nothing limits builds across repositories except the number of runners that can take a build job, and how to give builds their own runners with `runner.build_labels`. It SHALL say that runners on one machine share its memory and processors whatever their labels, and that the build runner of an Antigravity build must be Linux x86-64.

#### Scenario: One server, several repositories
- **WHEN** a person has four runners on one server that every repository uses
- **THEN** the page says that four builds can start at once there, and how to label one runner for builds so that only one does

#### Scenario: Light jobs on the runners of GitHub
- **WHEN** a person wants their server to do nothing but build
- **THEN** the page says to leave `runner.labels` unset and to name the server only in `runner.build_labels`

#### Scenario: The checks of the project
- **WHEN** a person asks how to keep their pull request checks from waiting behind a build
- **THEN** the page says that those workflows are the project's, and to give them labels that the build job does not use

## MODIFIED Requirements

### Requirement: The number of runners is explained
The page on self-hosted runners SHALL say which jobs run on which runners: every job of the Relevo workflows on `runner.labels`, except the build job on `runner.build_labels` when it is set. It SHALL say that the builds that run at once are at most the smaller of `limits.concurrent_agents` and the free runners that can take a build job, and that when builds share the runners of the other jobs the runners should outnumber `limits.concurrent_agents` so the pull request checks and the other workflows still find one.

#### Scenario: Limit equal to the number of runners
- **WHEN** a person has three runners, the builds share them and `limits.concurrent_agents` is 3
- **THEN** the page tells them that three builds can occupy every runner and hold up the checks and the other workflows

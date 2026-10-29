## ADDED Requirements

### Requirement: Several runners on one machine are explained
The page on self-hosted runners SHALL say, in English and Spanish, what several runners on one machine keep apart (workspace, temporary folder, tool cache, branch) and what they share (the home of the runner's user, package caches, the Docker daemon and the ports of the machine).

#### Scenario: A person registers a second runner
- **WHEN** a person reads the page before adding a second runner to a machine
- **THEN** it lists what each runner keeps for itself and what the runners share, so the person knows what can collide

#### Scenario: A stack that needs fixed ports
- **WHEN** the platform of an issue uses the Supabase stack, whose checks start containers on the machine
- **THEN** the page says that two such builds on one machine can collide and that they should not run at the same time

### Requirement: The number of runners is explained
The page on self-hosted runners SHALL say that every Relevo workflow runs on the same runners, that the builds that run at once are at most the smaller of `limits.concurrent_agents` and the free runners, and that the runners should outnumber `limits.concurrent_agents` so the pull request checks and the other workflows still find one.

#### Scenario: Limit equal to the number of runners
- **WHEN** a person has three runners and `limits.concurrent_agents` is 3
- **THEN** the page tells them that three builds can occupy every runner and hold up the checks and the other workflows

### Requirement: The limit on concurrent agents is stated honestly
The documentation SHALL say that `limits.concurrent_agents` counts the issues labelled `building` when the gates of an issue run, so that on runners where gates run at the same time (two or more runners, or the runners of GitHub) two issues labelled together can both find a free slot and exceed it, and that with a single runner the gates queue and the limit holds.

#### Scenario: Two issues labelled together
- **WHEN** a person reads the page to decide how strictly `limits.concurrent_agents` is kept
- **THEN** it says the limit is not exact when gates overlap, by at most the number of gates that overlap, and that a later evaluation of the queue sees the real count

### Requirement: Runners of one user share what the agent can read
The security page SHALL say that runners registered under one user of the machine share what the agent of any of them can read, including the workspaces of the other runners, and that a user or a container for each runner is the barrier.

#### Scenario: Several runners under one user
- **WHEN** a person reads what a self-hosted runner does not protect
- **THEN** the page says that the agent of one runner can reach the files of the others when they share a user

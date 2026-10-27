## ADDED Requirements

### Requirement: A build leaves nothing behind on the runner
A Relevo workflow SHALL NOT assume that its runner is a new machine. It SHALL install the tools it needs in the temporary folder of the job at a pinned version, not globally and not in the home folder of the runner's user, and SHALL end each job with a step that always runs and removes from the workspace what the job added. On a GitHub-hosted runner this SHALL change nothing a person can observe.

#### Scenario: OpenSpec is installed per job
- **WHEN** a build job needs OpenSpec
- **THEN** it installs the pinned version under the temporary folder of the job and puts it on the path of that job only

#### Scenario: A failed job still cleans up
- **WHEN** the agent step fails or the job is cancelled
- **THEN** the final step still removes the files the job added to the workspace

#### Scenario: Two jobs on the same machine
- **WHEN** two Relevo jobs run one after the other on the same self-hosted runner
- **THEN** the second finds no tool, setting or credential file that the first one wrote outside the workspace and the temporary folder

### Requirement: The workflows name the tools they assume
A Relevo workflow SHALL list the tools it needs on the runner beyond what it installs (`git`, `gh`, `jq` and Node), and the toolchain check of the build job SHALL fail before the agent starts, without a model turn, when one is not on the path of the runner.

#### Scenario: A runner without jq
- **WHEN** the runner has no `jq` on its path
- **THEN** the build job stops before the agent, the issue becomes `relevo:qa-failed` and the comment names `jq` and says nothing was built

### Requirement: The agent's settings do not outlive the job
When the agent is configured through a user-level settings file written by the workflow, that file SHALL be written under the temporary folder of the job, or removed by the final step, so that a later job on the same runner does not run with it.

#### Scenario: Antigravity settings
- **WHEN** the Antigravity build step writes its settings file
- **THEN** the file is gone once the job ends, whether it succeeded or not

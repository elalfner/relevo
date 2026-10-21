# Spec Delta

## ADDED Requirements

### Requirement: The build installs the toolchain of the stack of the issue
The build job of the go workflow template SHALL install, without the project editing the template, the toolchain of each stack Relevo ships a profile for, each step guarded by the stack output of the decision job, so that only the toolchain of the platform of the issue is installed and the agent and QA can run the project's checks. Installing the dependencies of the project SHALL stay a choice of the project.

#### Scenario: An issue for a Flutter platform
- **WHEN** the decision job reports the stack `flutter`
- **THEN** the build job sets up Flutter before the agent runs, and the steps of the other stacks are skipped

#### Scenario: An issue for a platform of a stack with no step
- **WHEN** the stack of the platform has no toolchain step in the template
- **THEN** the build job installs none, and the project adds its own step

#### Scenario: Reading the template
- **WHEN** a person reads the build job of the template
- **THEN** every toolchain step is active and guarded by the stack it installs, and the installation of dependencies is a commented example that says why

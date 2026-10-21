# Spec Delta

## ADDED Requirements

### Requirement: The build checks the toolchain before the agent starts
The build job of the go workflow SHALL check, before the agent step, that every tool listed by the profile of the platform of the issue is on the path of the runner, and when one is missing SHALL stop without running the agent, move the issue to `qa-failed` and post one comment that names the missing tools, says that nothing was built and what to do. It SHALL check nothing for a stack whose profile lists no tools, and SHALL run the check from a copy of the package outside the workspace.

#### Scenario: A runner without the Flutter SDK
- **WHEN** the platform is Flutter and `flutter` is not on the path of the runner
- **THEN** the agent does not run, the issue is `qa-failed`, and the comment says `flutter` is missing, that no model turns were spent and that the toolchain step of `relevo-go.yml` must be enabled

#### Scenario: A complete toolchain
- **WHEN** every tool of the profile answers `--version`
- **THEN** the check passes silently and the agent runs

#### Scenario: A stack with no tools listed
- **WHEN** the profile lists no tools
- **THEN** nothing is checked and the agent runs

#### Scenario: A clean working tree
- **WHEN** the check runs
- **THEN** it leaves nothing inside the workspace, so the agent's own preflight still finds a clean tree

## ADDED Requirements

### Requirement: `needs-spec` has the reasons `inputs` and `policy`
A build that cannot succeed because of what the issue depends on SHALL send the issue to `needs-spec` with the reason `inputs` (an input cannot be read or is not available) or `policy` (a task needs a protected path, or a dependency the issue did not allow). Each reason SHALL have an entry in the table of next steps and a message, in both languages, that names what is missing and the command to run.

#### Scenario: The next step for `inputs`
- **WHEN** the next step is asked for `needs-spec` with the reason `inputs`
- **THEN** it says that an input of the issue is not available, names the writer as the owner and gives the command that completes the issue

#### Scenario: The next step for `policy`
- **WHEN** the next step is asked for `needs-spec` with the reason `policy`
- **THEN** it says which task needs something an unattended run may not do, names the writer as the owner and gives the command that rewrites the issue

#### Scenario: Both languages
- **WHEN** the repository language is Spanish and a message for either reason is rendered
- **THEN** it is in Spanish and has the same content as the English one

### Requirement: Missing installed dependencies end in `qa-failed` before the agent
A build that stops before the agent because the dependencies of the platform are not installed SHALL leave the issue `qa-failed`, as a build that stops for a missing tool does, and SHALL NOT use `needs-spec`, because the cause is the configuration of the runner and not the issue.

#### Scenario: The install step is missing
- **WHEN** the paths that the profile requires do not exist after the install step
- **THEN** the issue is `qa-failed` and the comment names the path and the step to enable

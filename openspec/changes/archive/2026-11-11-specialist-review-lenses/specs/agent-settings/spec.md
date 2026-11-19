## Purpose

Lets a project choose the model and the effort of the developer agent and of each lens, with defaults, and makes sure that a setting an agent cannot apply is said so and never looks effective.

## ADDED Requirements

### Requirement: The developer agent and each lens have a model and an effort
There SHALL be a model and an effort for the developer agent and for each of the lenses `spec`, `security`, `code` and `interface`, taken from `relevo.yml` when set and from the defaults otherwise.

#### Scenario: A setting for one lens
- **WHEN** the file sets the model of the `security` lens
- **THEN** the other roles keep their defaults

### Requirement: The defaults are stated
The defaults SHALL be: the developer agent `sonnet` with effort `high`, as today; `spec` and `security` `opus` with `high`; `code` `sonnet` with `high`; and `interface` `sonnet` with `medium`. A default SHALL change only on the evidence of the evaluation.

#### Scenario: A project that changes nothing
- **WHEN** a project sets none of the keys
- **THEN** each role runs with the default of this requirement

#### Scenario: The cost of the defaults
- **WHEN** the documentation lists the defaults
- **THEN** it says that two lenses use the stronger model and how to set each lens to the model that QA used before

### Requirement: The model is given when the agent is launched
The orchestrator SHALL give the configured model of a role when it launches the agent of that role, and SHALL give the effort in the same way where the runtime allows it.

#### Scenario: A configured model
- **WHEN** the file sets `agents.qa.code.model`
- **THEN** the `code` lens is launched with that model

### Requirement: A setting that cannot be applied is never silent
Where the runtime cannot apply the effort at launch, `doctor` SHALL say which settings are not applied and why. A setting SHALL NOT be accepted silently and then have no effect.

#### Scenario: An effort the runtime cannot set
- **WHEN** the runtime accepts a model but not an effort at launch
- **THEN** `doctor` says that the effort is not applied and names the roles

### Requirement: With Antigravity the settings are accepted and not applied
With `agent.build` set to `antigravity` the settings SHALL be accepted, SHALL NOT be written to the agents it renders, and SHALL produce a warning in `doctor` and in `init` that names them.

#### Scenario: Doctor with Antigravity
- **WHEN** the file sets `agents.qa.security.model` and the agent is Antigravity
- **THEN** `doctor` warns that the setting is not applied with this agent

#### Scenario: Init with Antigravity
- **WHEN** `init` runs for a repository that sets an agent setting and uses Antigravity
- **THEN** `init` prints the same warning and goes on

### Requirement: No setting disables or weakens a lens
There SHALL be no setting that turns off `spec`, `security` or `code`, or that lowers what they block. A project's exceptions SHALL be written in its own rules file, which the `spec` lens already reads.

#### Scenario: An attempt to turn a lens off
- **WHEN** a file tries to disable the `security` lens
- **THEN** validation fails because the key does not exist

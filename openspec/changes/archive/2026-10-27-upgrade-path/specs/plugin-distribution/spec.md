## MODIFIED Requirements

### Requirement: The runner installs the pinned package
The workflow templates SHALL install the plugin scripts and the plugin for the model action from the package at the version the project pins, so that one pin decides both and a run downloads no documentation, tests or OpenSpec history.

#### Scenario: Reading the template
- **WHEN** a person reads a workflow template
- **THEN** the plugin scripts and the plugin for the agent come from an npm package at a pinned version and the repository is not cloned for them

#### Scenario: Raising the pin
- **WHEN** a project raises `RELEVO_VERSION` and its workflow text is current
- **THEN** the next cloud run takes both the scripts and the skills from that version

### Requirement: A release is published before it is promoted
A tag `vX.Y.Z` SHALL publish the package with that version, and the release steps SHALL publish before the promotion to `main`, so that the templates on `main` never pin a package version that does not exist.

#### Scenario: Version and tag differ
- **WHEN** the tag does not match the version in the package
- **THEN** the release workflow stops without publishing

#### Scenario: Promoting before publishing
- **WHEN** `main` receives the release before the package is published
- **THEN** a project that copies a template from `main` pins a version that the registry does not have, and the release steps forbid that order

## ADDED Requirements

### Requirement: The cloud agent loads the plugin from the pinned package
The model step of a Claude build SHALL load the plugin from the folder where the job unpacked the pinned package, SHALL NOT add a marketplace or install a plugin from one, and SHALL NOT need a credential to read the plugin repository. The commands SHALL keep their names, such as `/relevo:go`.

#### Scenario: No marketplace in the workflow
- **WHEN** a person reads the Claude model step of the go workflow
- **THEN** it names no `plugin_marketplaces` and no `plugins`, and it passes the folder of the unpacked package as the plugin directory

#### Scenario: A private plugin repository
- **WHEN** the plugin repository is private
- **THEN** the cloud build needs no `RELEVO_PLUGIN_TOKEN`, because nothing is cloned from it

#### Scenario: The package has no manifest
- **WHEN** the unpacked package lacks `.claude-plugin/plugin.json`
- **THEN** the run stops before the agent and names the missing path

#### Scenario: The command names
- **WHEN** the agent starts with the plugin loaded from the folder
- **THEN** the prompt `/relevo:go <n>` resolves to the skill `go`

### Requirement: A workflow template carries the version of its text
Each workflow template SHALL start its comments with `# relevo-template: X.Y.Z`, where `X.Y.Z` is the version of the package it is published in, and a test SHALL fail when a template's stamp differs from the version of the package.

#### Scenario: A release
- **WHEN** the version of the package is raised to 0.9.0
- **THEN** the stamp of every template reads `0.9.0` or the test fails

#### Scenario: A pin raised by hand
- **WHEN** a person raises `RELEVO_VERSION` in a workflow and leaves its stamp
- **THEN** the stamp still shows the version of the text that was copied

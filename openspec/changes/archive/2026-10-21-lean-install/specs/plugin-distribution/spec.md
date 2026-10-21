# Spec Delta

## Purpose
Defines what an installation of Relevo contains, how it is installed, and what a workflow runner downloads, so that an installation holds only what runs and the runner always finds it.

## ADDED Requirements

### Requirement: An installation holds only what runs
The published package SHALL contain the plugin manifest, scripts, skills, agents, stack profiles, templates, the licence and the notice, and nothing else from the repository, and the marketplace entry SHALL install the plugin from that package.

#### Scenario: Installing at project scope
- **WHEN** a person installs the plugin with the project scope
- **THEN** the plugin cache holds the contents of the package and no documentation, tests, OpenSpec history, changelog or brand material

#### Scenario: A file outside the package is needed at run time
- **WHEN** a skill or script reads a file that the package does not contain
- **THEN** a test fails, because an installation would not have it

### Requirement: One command installs it
A command line, `relevo`, SHALL install the plugin for the machine, the project or the local scope, update it, run the doctor and print the version, and SHALL tell the person how to fix a missing prerequisite instead of failing silently.

#### Scenario: Installing for a project
- **WHEN** a person runs `relevo install --scope project`
- **THEN** the marketplace is added and the plugin installed with the project scope, and the command says where the setting was written

#### Scenario: Claude Code is not installed
- **WHEN** `claude` is not on the path
- **THEN** the command stops, says Claude Code is required and how to install it, and changes nothing

### Requirement: The runner installs the pinned package
The workflow templates SHALL install the plugin scripts from the package at the version the project pins, and SHALL install the plugin for the model action from the marketplace entry, so that a run downloads no documentation, tests or OpenSpec history.

#### Scenario: Reading the template
- **WHEN** a person reads a workflow template
- **THEN** the plugin scripts come from an npm package at a pinned version and the repository is not cloned for them

### Requirement: The runner stops when the plugin is incomplete
A workflow SHALL verify, before it runs any plugin script, that the files the job needs exist in what it installed, and SHALL stop with a message that names the missing path instead of continuing with less.

#### Scenario: A package that lacks a script
- **WHEN** the installed package has no `scripts/go-plan.mjs`
- **THEN** the run stops before claiming the issue and says which path is missing

### Requirement: A release is published before it is promoted
A tag `vX.Y.Z` SHALL publish the package with that version, and the release steps SHALL publish before the promotion to `main`, so that the marketplace on `main` never names a package version that does not exist.

#### Scenario: Version and tag differ
- **WHEN** the tag does not match the version in the package
- **THEN** the release workflow stops without publishing

### Requirement: Doctor checks the installation
`doctor` SHALL report whether the installed plugin has the folders it needs and whether the workflows of the project pin a package version.

#### Scenario: Workflows that clone the repository
- **WHEN** a project has workflows that clone the plugin repository for its scripts
- **THEN** `doctor` reports it and says to run `/relevo:init`, which lists the difference

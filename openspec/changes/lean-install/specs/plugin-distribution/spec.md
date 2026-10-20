# Spec Delta

## Purpose
Defines what an installed Relevo contains and what a workflow runner downloads, so that an installation holds only what runs and the runner always finds it.

## ADDED Requirements

### Requirement: An installation holds only what runs
The plugin SHALL keep everything that runs (scripts, skills, agents, stack profiles, templates and its manifest) in one folder, and the marketplace entry SHALL point to that folder, so that an installation at user, project or local scope contains no documentation, tests, OpenSpec history, changelog or brand material.

#### Scenario: Installing at project scope
- **WHEN** a person installs the plugin with the project scope
- **THEN** the plugin cache holds the contents of the plugin folder and nothing else from the repository

#### Scenario: A file outside the plugin folder is needed at run time
- **WHEN** a skill or script reads a file that is outside the plugin folder
- **THEN** a test fails, because the installation would not have it

### Requirement: The runner fetches only the plugin folder
The workflow templates SHALL fetch the plugin scripts with a sparse checkout of the plugin folder, and SHALL install the plugin for the model action from the marketplace entry, so that a run downloads no documentation, tests or OpenSpec history.

#### Scenario: Reading the template
- **WHEN** a person reads a workflow template
- **THEN** its checkout of the plugin lists the plugin folder only

### Requirement: The runner stops when the plugin is incomplete
A workflow SHALL verify, before it runs any plugin script, that the files it needs exist in what it fetched, and SHALL stop with a message that names the missing path instead of continuing with less.

#### Scenario: A fetch that lacks a script
- **WHEN** the fetched plugin folder has no `scripts/go-plan.mjs`
- **THEN** the run stops before claiming the issue and says which path is missing

### Requirement: Doctor checks the installation
`doctor` SHALL report whether the installed plugin has the folders it needs and whether the workflows of the project point to the current layout.

#### Scenario: Workflows from an older layout
- **WHEN** a project has workflows that read `scripts/` at the top of the plugin repository
- **THEN** `doctor` reports a failure and says to run `/relevo:init`, which lists the difference

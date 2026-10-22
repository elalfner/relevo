# plugin-distribution Specification

## Purpose
Defines what an installation of Relevo contains, how it is installed, and what a workflow runner downloads, so that an installation holds only what runs and the runner always finds it.

## Requirements

### Requirement: An installation holds only what runs
The published package SHALL contain the plugin manifest, scripts, skills, agents, stack profiles, templates, the licence and the notice, and nothing else from the repository, and the marketplace entry SHALL install the plugin from that package.

#### Scenario: Installing at project scope
- **WHEN** a person installs the plugin with the project scope
- **THEN** the plugin cache holds the contents of the package and no documentation, tests, OpenSpec history, changelog or brand material

#### Scenario: A file outside the package is needed at run time
- **WHEN** a skill or script reads a file that the package does not contain
- **THEN** a test fails, because an installation would not have it

### Requirement: One command installs it
A command line, `relevo`, SHALL install the plugin for the machine, the project or the local scope, update it, run the doctor and print the version, and SHALL tell the person how to fix a missing prerequisite instead of failing silently. When no scope is given it SHALL ask in a terminal, with the project preselected, and otherwise use the project inside a git repository and the machine outside one, without waiting. `update` SHALL pass a scope only when one is given.

#### Scenario: Installing for a project
- **WHEN** a person runs `relevo install --scope project`
- **THEN** the marketplace is added and the plugin installed with the project scope, and the command says where the setting was written

#### Scenario: Claude Code is not installed
- **WHEN** `claude` is not on the path
- **THEN** the command stops, says Claude Code is required and how to install it, and changes nothing

#### Scenario: Choosing in a terminal
- **WHEN** a person runs `relevo install` with no scope in a terminal
- **THEN** a list of the project (with its folder), the machine and the local scope appears with the project selected, the arrows and Enter choose, and the install uses the choice

#### Scenario: Cancelling
- **WHEN** the person presses Ctrl-C or Esc at the list
- **THEN** nothing is installed or written, and the command says it was cancelled

#### Scenario: No terminal
- **WHEN** `relevo install` runs without a scope and without a terminal
- **THEN** it does not wait: it uses the project inside a git repository and the machine outside one, and says which and why

#### Scenario: Not inside a repository
- **WHEN** the folder is not inside a git repository
- **THEN** the list preselects the machine and says the folder is not a repository

#### Scenario: Updating
- **WHEN** a person runs `relevo update` without a scope
- **THEN** no scope is passed, so Claude Code updates the installation of the current project

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

### Requirement: One command sets up the plugin of each tool
`relevo init` SHALL ask which tools to set up and whether the scope is the project or the machine, SHALL install each tool's plugin, and SHALL run without waiting when `--tools`, `--scope` and `--yes` are given or when there is no terminal.

#### Scenario: Asking in a terminal
- **WHEN** a person runs `relevo init` in a terminal inside a repository
- **THEN** a list of tools appears, then a list of scopes with the project preselected, and each tool is installed with the choice

#### Scenario: Cancelling
- **WHEN** the person presses Ctrl-C or Esc at a list
- **THEN** nothing is installed and the command says it was cancelled

#### Scenario: No terminal
- **WHEN** `relevo init --tools antigravity` runs without a terminal and without `--scope`
- **THEN** it does not wait: it uses the project inside a git repository and the machine outside one, and says which

#### Scenario: Claude chosen
- **WHEN** `claude` is among the tools
- **THEN** the command does what `relevo install` does for the scope and renders nothing for Claude

#### Scenario: Antigravity is not installed
- **WHEN** `agy` is not on the path and the machine scope is chosen
- **THEN** the command stops, says that Antigravity CLI is required and where to get it, and changes nothing

#### Scenario: Not to be confused with the skill
- **WHEN** `relevo init` finishes
- **THEN** it tells the person that the skill `init` sets up the repository's labels and rules, as a separate step

### Requirement: Doctor checks the rendered plugin
`relevo doctor` SHALL report, for each rendered plugin, a missing file, a file from another package version and a file edited by hand.

#### Scenario: Outdated plugin
- **WHEN** the recorded version is older than the installed package
- **THEN** doctor warns and names `relevo update` as the fix

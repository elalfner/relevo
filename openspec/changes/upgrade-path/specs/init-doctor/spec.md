## MODIFIED Requirements

### Requirement: Doctor checks the plugin credential secret
When a Relevo workflow on the default branch still loads the plugin through a marketplace and the plugin repository is private, `doctor` SHALL check that the repository has a secret named `RELEVO_PLUGIN_TOKEN` and SHALL report a failure, with the fix next to it, when it does not. The check SHALL read secret names only, never values. It SHALL NOT report anything when no workflow uses a marketplace, when the plugin repository is public, when its visibility could not be determined, or when the repository secrets could not be listed.

#### Scenario: Private plugin repository and no secret
- **WHEN** a workflow uses a marketplace, the plugin repository is private and the repository secrets do not include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a failed check `automation.plugin-secret`
- **AND** its fix says to store a read-only token under that name and that a secret defined at organization level is not visible to this check

#### Scenario: Private plugin repository and the secret exists
- **WHEN** a workflow uses a marketplace, the plugin repository is private and the repository secrets include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a passed check `automation.plugin-secret`

#### Scenario: Public plugin repository
- **WHEN** the plugin repository is public
- **THEN** `doctor` reports no `automation.plugin-secret` check, whether or not the secret exists

#### Scenario: Workflows that load the plugin from the package
- **WHEN** no Relevo workflow on the default branch names a marketplace
- **THEN** `doctor` reports no `automation.plugin-secret` check, even if the plugin repository is private

#### Scenario: Visibility or secrets cannot be read
- **WHEN** the plugin repository's visibility is unknown, or the repository secrets could not be listed
- **THEN** `doctor` reports no `automation.plugin-secret` check
- **AND** the existing warning about unreadable secrets still appears when the list failed

## ADDED Requirements

### Requirement: Init updates a workflow by a three-way merge
When a Relevo workflow exists and differs from the template, `init` SHALL merge three texts: the published template closest to the file as the base, the file as it is, and the current template. It SHALL write only under `.github/workflows/`.

#### Scenario: A clean merge
- **WHEN** `relevo-go.yml` is the 0.5.0 text with the person's own credential line and the current template is 0.8.0
- **THEN** the plan offers to update it from 0.5.0 to 0.8.0 and keeps the credential line

#### Scenario: No base is close enough
- **WHEN** no published template is close to the file
- **THEN** `init` leaves it as it is, says so, and accepts the version of the base with `--from`

#### Scenario: A file that is current
- **WHEN** the merge gives the file as it is
- **THEN** the plan reports the workflow as up to date

### Requirement: A merged workflow is written only when clean and confirmed
A clean merge SHALL appear in the plan with its difference and SHALL be written only on the person's confirmation. A conflict SHALL write nothing to that file and SHALL show the lines in conflict, because a workflow with conflict markers is not valid YAML.

#### Scenario: Confirmation
- **WHEN** the plan shows a clean merge and the person does not confirm
- **THEN** the file is not written

#### Scenario: A conflict
- **WHEN** the person edited a line that the new template also changed
- **THEN** `init` writes nothing to that file, names it and shows the conflicting lines

### Requirement: The pin and the stamp are set, not merged
After a merge, `init` SHALL set the pin and the stamp of the workflow to the current version, and SHALL render the current template with `runner.labels` and `agent.build` before merging, so that the person's runner and agent blocks are not reported as changes.

#### Scenario: The pin was raised by hand
- **WHEN** the file's pin is 0.7.0 but its text is the 0.5.0 template
- **THEN** the base is the 0.5.0 template, the pin and the stamp read the current version after the merge, and no conflict is raised for them

#### Scenario: The settings of the repository
- **WHEN** `relevo.yml` sets `runner.labels` or `agent.build: antigravity`
- **THEN** the current template is rendered with them before the merge

### Requirement: Doctor reports the versions it can read locally
`doctor` SHALL report the version of the plugin in use, of each installed scope listed by `claude plugin list --json`, and of the pin of the Relevo workflows on the default branch, and SHALL warn when they differ, with the command that moves the lagging one. It SHALL NOT ask the npm registry. When `claude` cannot list the plugins it SHALL say so as a warning and run the other checks.

#### Scenario: The scopes differ
- **WHEN** the plugin installed for the user is 0.7.0 and the one for the project is 0.8.0
- **THEN** `doctor` warns, names both, and gives `claude plugin update relevo@relevo` for the lagging scope

#### Scenario: Workflows behind the plugin
- **WHEN** the workflows on the default branch pin 0.5.0 and the plugin in use is 0.8.0
- **THEN** `doctor` warns, names the files, and says that `/relevo:init` updates them

#### Scenario: Claude cannot list plugins
- **WHEN** `claude plugin list --json` fails
- **THEN** `doctor` warns that the installed versions could not be read and the other checks still run

### Requirement: Doctor compares the text of a workflow with its pin
`doctor` SHALL read the stamp of each Relevo workflow on the default branch and SHALL warn when the stamp is older than the pin or is missing, because the text of the workflow is then older than the scripts it runs.

#### Scenario: Text older than the pin
- **WHEN** a workflow pins 0.7.0 and its stamp reads 0.5.0
- **THEN** `doctor` warns that the text is from 0.5.0 and the scripts from 0.7.0, and names `/relevo:init`

#### Scenario: A workflow with no stamp
- **WHEN** a workflow has no `# relevo-template:` line
- **THEN** `doctor` warns that the age of its text is unknown and names `/relevo:init`

#### Scenario: Text and pin agree
- **WHEN** the stamp and the pin are the same version
- **THEN** the check passes

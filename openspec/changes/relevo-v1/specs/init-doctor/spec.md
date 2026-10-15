## ADDED Requirements

### Requirement: Init shows a plan first
`init` SHALL show the full list of changes it intends to make and apply them only after the person confirms.

#### Scenario: Plan before changes
- **WHEN** `init` runs
- **THEN** it lists the files, labels, branches, rulesets and workflows it will create or change, and waits for confirmation

### Requirement: Init is idempotent
Running `init` again SHALL not duplicate or overwrite existing correct configuration, and SHALL show only what differs.

#### Scenario: Second run
- **WHEN** `init` runs on an already configured repository
- **THEN** it reports "nothing to do" for what is already correct

### Requirement: Init sets up the repository
`init` SHALL: detect the repository, provider and platform; ask for team members, spec writer, review mode and language; write `relevo.yml`; create the lifecycle labels; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest); add the evidence directory to the ignore file; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

### Requirement: Init protects the repository and keeps OpenSpec in git
`init` SHALL add a ruleset on the base and release branches that blocks deletion and force pushes and requires a pull request, with approvals not dismissed when commits are pushed; SHALL stop workflows from approving pull requests; and SHALL leave `.gitkeep` files in the empty OpenSpec folders so git keeps them. It SHALL NOT create files under `openspec/` by hand: with no OpenSpec root it tells the person to run the OpenSpec tool's own `init`.

#### Scenario: No OpenSpec root
- **WHEN** `init` runs in a repository with no `openspec/config.yaml`
- **THEN** it asks the person to run the OpenSpec tool's `init` and creates no `openspec/` file itself

#### Scenario: Existing workflow differs
- **WHEN** a workflow file already exists and differs from the template
- **THEN** `init` reports it and leaves it as it is

### Requirement: Init never touches the API key
`init` SHALL NOT read or write the model API key. It SHALL tell the person to add it to the repository's secret store.

#### Scenario: Key missing
- **WHEN** `init` finishes
- **THEN** it lists adding the API key as a manual step

### Requirement: Admin permissions
When the person lacks administrator permission, `init` SHALL print the repository settings to change by hand instead of failing silently.

#### Scenario: Not an admin
- **WHEN** a ruleset cannot be created for lack of permission
- **THEN** the exact settings are listed for an administrator

### Requirement: Doctor reports every check
`doctor` SHALL report each check as pass or fail with a fix next to each failure. A check on something optional, or on something the platform may not offer, SHALL be reported as a warning with its fix and SHALL NOT make `doctor` fail.

#### Scenario: A failing check
- **WHEN** a check fails
- **THEN** the report shows the check as failed with the fix next to it

### Requirement: Doctor checks tools and configuration
`doctor` SHALL check the required tools, including the OpenSpec command-line tool at a supported version, a valid `relevo.yml`, the labels and the base branch.

#### Scenario: Invalid configuration
- **WHEN** `relevo.yml` fails validation
- **THEN** `doctor` reports that check as failed and shows the validation messages

### Requirement: Doctor checks repository protection
`doctor` SHALL check branch protection and rulesets on the base and release branches, that the automation cannot approve pull requests, and that approvals are not dismissed when new commits are pushed (required because the spec archive is committed after approval).

#### Scenario: Approvals dismissed on push
- **WHEN** the base branch dismisses approvals when new commits are pushed
- **THEN** `doctor` reports a failure explaining that the archive commit would dismiss the approval

### Requirement: Doctor checks the repository contents
`doctor` SHALL check that the OpenSpec root is tracked by git (an empty `openspec/` folder is not stored, so a clean checkout or the runner would have none), that `evidence/` is ignored by git, that the lifecycle labels and the base branch exist, and that the plugin repository can be cloned by the runner with the credential the workflow uses.

#### Scenario: OpenSpec root not tracked
- **WHEN** `openspec/config.yaml` is missing from git
- **THEN** `doctor` fails that check and says to run `init` and commit the OpenSpec files

#### Scenario: Private plugin repository
- **WHEN** the workflow clones a private plugin repository with a plain URL
- **THEN** `doctor` fails that check and says to store a read-only token and use the private-repository line of the workflow

#### Scenario: Branch protection unavailable
- **WHEN** the platform refuses to report branch protection (for example a private repository on a free plan)
- **THEN** `doctor` warns that approval and merge are then enforced only by the written confirmation in `ship`

### Requirement: Doctor checks automation readiness
`doctor` SHALL check that the API key secret exists (without reading it), that workflows are installed and enabled, and that an objective CI check exists.

#### Scenario: Misconfigured repository
- **WHEN** automation is allowed to approve pull requests
- **THEN** `doctor` reports a failure and the setting to change

#### Scenario: Healthy repository
- **WHEN** every check passes
- **THEN** `doctor` reports all green

### Requirement: Required external tools
Relevo SHALL declare its external dependencies: the OpenSpec command-line tool (Node.js 20.19 or newer), `git`, the platform toolchain, and for `review` the device bridge. It SHALL also declare the skills that `think` invokes: `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling`. `doctor` SHALL detect each one and show the exact install command for what is missing. For each skill found as a folder, `doctor` SHALL also read its frontmatter and, when it sets `disable-model-invocation`, report that the person must launch it by hand; this is a notice, not a failure.

#### Scenario: Skill missing
- **WHEN** a skill that `think` invokes, such as `domain-modeling`, is not installed
- **THEN** `doctor` fails that check and shows the install command

#### Scenario: Skill reserved for the person
- **WHEN** `grill-with-docs` is installed and its frontmatter sets `disable-model-invocation`
- **THEN** `doctor` passes that check with a notice that `/grill-with-docs` must be run by hand, and does not fail

#### Scenario: OpenSpec missing
- **WHEN** the OpenSpec tool is not installed
- **THEN** `doctor` fails that check and shows the install command and the Node.js requirement

### Requirement: Installing dependencies is explicit
`init` MAY offer to install a missing dependency, but SHALL do so only after the person confirms the exact command, and SHALL NOT install anything silently. Relevo SHALL NOT bundle or copy third-party tools into its own repository.

#### Scenario: Offer to install
- **WHEN** `init` finds OpenSpec missing
- **THEN** it shows the command, asks for confirmation, and runs it only on a yes

#### Scenario: Declined
- **WHEN** the person declines
- **THEN** `init` continues, marks the dependency as missing, and `go` and `ship` refuse to run until it is installed

### Requirement: Doctor is read-only
`doctor` SHALL NOT change anything.

#### Scenario: Running doctor
- **WHEN** `doctor` runs
- **THEN** no write operation is performed

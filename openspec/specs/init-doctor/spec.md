# init-doctor Specification

## Purpose
TBD - created by archiving change check-plugin-token-secret. Update Purpose after archive.

## Requirements

### Requirement: Doctor checks the plugin credential secret
When the plugin repository is private, `doctor` SHALL check that the repository has a secret named `RELEVO_PLUGIN_TOKEN` and SHALL report a failure, with the fix next to it, when it does not. The check SHALL read secret names only, never values. It SHALL NOT report anything when the plugin repository is public, when its visibility could not be determined, or when the repository secrets could not be listed.

#### Scenario: Private plugin repository and no secret
- **WHEN** the plugin repository is private and the repository secrets do not include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a failed check `automation.plugin-secret`
- **AND** its fix says to store a read-only token under that name and that a secret defined at organization level is not visible to this check

#### Scenario: Private plugin repository and the secret exists
- **WHEN** the plugin repository is private and the repository secrets include `RELEVO_PLUGIN_TOKEN`
- **THEN** `doctor` reports a passed check `automation.plugin-secret`

#### Scenario: Public plugin repository
- **WHEN** the plugin repository is public
- **THEN** `doctor` reports no `automation.plugin-secret` check, whether or not the secret exists

#### Scenario: Visibility or secrets cannot be read
- **WHEN** the plugin repository's visibility is unknown, or the repository secrets could not be listed
- **THEN** `doctor` reports no `automation.plugin-secret` check
- **AND** the existing warning about unreadable secrets still appears when the list failed

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
`init` SHALL: detect the repository, provider and stack; ask for the platforms (name, stack, path and, where the stack has them, targets), team members, spec writer, review mode and language; write `relevo.yml` with `platforms`; create the lifecycle labels; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest); add the evidence directory to the ignore file; offer, without committing it, a commented `.relevo/stacks/<stack>.md`; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

#### Scenario: Monorepo
- **WHEN** the person names two platforms with different stacks and paths
- **THEN** `relevo.yml` has both entries and `doctor` checks the tools of both

#### Scenario: Existing legacy configuration
- **WHEN** `init` runs where `relevo.yml` has `platform: flutter-android`
- **THEN** it keeps the setting as it is and changes nothing in it unless the person asks

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

### Requirement: Doctor judges the workflows that run
`doctor` SHALL read the workflow files from the repository's default branch on GitHub, because that is what runs, and not from the working copy. A workflow that exists only in the working copy SHALL be reported as not on the default branch, with the fix of pushing it there (through a pull request when the branch is protected). When the default branch cannot be read, `doctor` SHALL fall back to the working copy.

#### Scenario: Fixed locally, not on the default branch
- **WHEN** a workflow was corrected in the working copy but the default branch still has the old version
- **THEN** `doctor` judges the old version and reports its failure

#### Scenario: Only in the working copy
- **WHEN** a Relevo workflow file exists locally and not on the default branch
- **THEN** `doctor` reports that it only exists in the working copy and must be pushed to the default branch

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

### Requirement: Doctor reads the profile of each platform
For each platform, `doctor` SHALL check the tools the profile requires, the tool of each target (a missing tool of a target is a warning, except `xcrun` on a machine that is not macOS, which is a notice), the skills the profile requires, and report which layers make up the profile (for example "flutter: plugin default + .relevo/stacks/flutter.md"). It SHALL fail when a platform's stack has no profile and warn about a value of the repository's profile that the plugin's profile ignores.

#### Scenario: Flutter with Android and web
- **WHEN** a platform has stack `flutter` and targets `android` and `web`
- **THEN** `doctor` checks `flutter` and `adb`, reports `android` and `web` as targets, and does not require `xcrun`

#### Scenario: Missing stack profile
- **WHEN** a platform names a stack with no profile
- **THEN** `doctor` fails that check and says where to define one

#### Scenario: iOS on Linux
- **WHEN** a platform has target `ios` and the machine is not macOS
- **THEN** `doctor` shows a notice that iOS can only be built and reviewed on macOS, and does not fail

### Requirement: Doctor reads the skills of the roles
`doctor` SHALL list the skills resolved for each role, say which were left out and why, list the ones with scripts and whether they are allowed, warn when a role exceeds the size budget and warn when a skill folder differs from `skills-lock.json`.

#### Scenario: Skill left out
- **WHEN** a listed skill is not on the base branch
- **THEN** `doctor` shows it as left out with the reason

### Requirement: Doctor checks the linked repositories
When `links` is not empty, `doctor` SHALL check that each linked repository can be read, and that the secret `RELEVO_LINKS_TOKEN` exists (its name only, never its value); a missing secret is a warning when every linked repository is public and a failure when one is private. When `links` is empty, none of this is checked.

#### Scenario: Private linked repository without the secret
- **WHEN** `links` lists a private repository and the secret does not exist
- **THEN** `doctor` fails that check and says to create a read-only token and store it as `RELEVO_LINKS_TOKEN`

#### Scenario: Public linked repositories
- **WHEN** every linked repository is public and no secret exists
- **THEN** `doctor` warns, because the gate works without it but a private repository added later would not

#### Scenario: No links
- **WHEN** `links` is empty
- **THEN** `doctor` does not mention the secret

### Requirement: Init asks for the linked repositories
`init` SHALL ask which repositories this one depends on, write `links`, and remind the person to create the read-only secret, without reading or writing it.

#### Scenario: Front and back
- **WHEN** the person names `acme/api`
- **THEN** `relevo.yml` has `links: [acme/api]` and `init` shows what token to create

### Requirement: Doctor reports the execution mode
`doctor` SHALL report the credential mode deduced from the secret names (`api_key`, `subscription`, both as a warning, none as a warning that only local runs are possible), the state of the repository variable `RELEVO_CLOUD_GO`, a one-line reminder to read the current Anthropic policy on automated use of a subscription when the mode is `subscription`, and a warning when the mode is `subscription` and `limits.concurrent_agents` is more than 1.

#### Scenario: Subscription with several agents
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and `concurrent_agents` is 3
- **THEN** `doctor` warns that the quota is shared and suggests 1

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off`
- **THEN** `doctor` says the cloud is paused and that builds run locally

#### Scenario: No credential
- **WHEN** neither secret exists and the go workflow is installed
- **THEN** `doctor` warns that a `ready` label will only produce the local-run comment

### Requirement: Init asks where go runs and with which credential
`init` SHALL ask whether `go` builds in the cloud, on each person's machine or both (default both) and, for the cloud, with an API key or a subscription token. It SHALL generate the `go` workflow with the credential line for the chosen mode, install no `go` and queue workflows for a local-only setup, set `limits.concurrent_agents` to 1 for a subscription, and remind the person to create the secret without reading it.

#### Scenario: Subscription in the cloud
- **WHEN** the person chooses the cloud with a subscription token
- **THEN** the workflow uses `claude_code_oauth_token`, `concurrent_agents` is 1, and `init` shows how to create the token and store it as `CLAUDE_CODE_OAUTH_TOKEN`

#### Scenario: Local only
- **WHEN** the person chooses their own machines
- **THEN** `go` and queue workflows are not added, and the plan says to run `/relevo:go <n>` or `go-local.mjs <n>`

#### Scenario: Default
- **WHEN** the person gives no answer
- **THEN** both is used, with an API key

### Requirement: Doctor checks what the autopilot needs
When `review.autopilot` is not `off`, `doctor` SHALL check, for each Flutter platform, that `lib/main_driver.dart` exists and that the project depends on `flutter_driver`, and, for each Vue platform, that Playwright can be resolved from the project. It SHALL warn, with the command to fix it, when one is missing, and SHALL say that a driven review of a target without an adapter is not available.

#### Scenario: Flutter without the driver entry point
- **WHEN** `review.autopilot` is `precheck` and a Flutter platform has no `lib/main_driver.dart`
- **THEN** `doctor` warns and says to add it with `enableFlutterDriverExtension()`

#### Scenario: Vue without Playwright
- **WHEN** `review.autopilot` is `verify` and a Vue platform cannot resolve Playwright
- **THEN** `doctor` warns and gives the install command

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** `doctor` adds no autopilot check

### Requirement: Doctor checks that the build installs the toolchain
When the go workflow is installed, doctor SHALL fail for each configured platform whose stack needs a toolchain step (Flutter, Laravel) that the go workflow does not install in an active, non-comment line, and SHALL say which step to add. It SHALL do nothing when the go workflow is not installed, and SHALL not judge stacks without a step in the template.

#### Scenario: A Flutter project whose workflow installs nothing
- **WHEN** a platform has the stack `flutter` and the go workflow has no active Flutter setup
- **THEN** doctor reports a failure that names the platform and says to enable the Flutter step of the template

#### Scenario: A toolchain that is only a comment
- **WHEN** the only mention of the Flutter setup in the go workflow is a commented example
- **THEN** it counts as missing

#### Scenario: A project that builds on machines only
- **WHEN** the go workflow is not installed
- **THEN** doctor reports nothing about the toolchain

### Requirement: Init mentions the toolchain of a workflow it leaves alone
When the go workflow exists and differs from the template, the plan SHALL say that its build job has to install the toolchain of the stacks of the project, and that the template does it for Flutter, Vue and Laravel.

#### Scenario: An older go workflow
- **WHEN** the go workflow differs from the template
- **THEN** the item that says it is left as it is also names the toolchain step to compare

### Requirement: Init declares the plugin in the project
`init` SHALL plan, as an install the person confirms with its exact command shown, the declaration of the Relevo plugin in the repository's `.claude/settings.json` when it does not declare both the marketplace and the enabled plugin, and SHALL list the line as already done when it does. It SHALL leave the changed settings file for the person to commit.

#### Scenario: A repository that does not declare the plugin
- **WHEN** `.claude/settings.json` is missing, or has no `relevo@relevo` enabled
- **THEN** the plan has an install line with the commands that install the plugin at the project scope, and nothing runs before the person says yes to that exact command

#### Scenario: A repository that already declares it
- **WHEN** `.claude/settings.json` declares the marketplace and enables `relevo@relevo`
- **THEN** the line is reported as already in place

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual step that says to fix the file, and init does not rewrite it

### Requirement: Doctor warns when the repository does not declare the plugin
`doctor` SHALL warn, not fail, when the repository does not declare and enable the Relevo plugin in `.claude/settings.json`, say that a teammate who clones the repository is not offered it, and give the command or `/relevo:init` as the fix.

#### Scenario: Installed for the machine only
- **WHEN** the plugin is installed for the machine and `.claude/settings.json` does not declare it
- **THEN** doctor warns and names the fix

#### Scenario: Declared
- **WHEN** `.claude/settings.json` declares the marketplace and enables the plugin
- **THEN** doctor reports it as a pass

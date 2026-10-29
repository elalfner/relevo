# init-doctor Specification

## Purpose
TBD - created by archiving change check-plugin-token-secret. Update Purpose after archive.

## Requirements

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
`init` SHALL: detect the repository, provider and stack; ask for the platforms (name, stack, path and, where the stack has them, targets), team members, spec writer, review mode and language; write `relevo.yml` with `platforms`; create the lifecycle labels, including the `ship` label; create the base branch if missing; configure branch protection and secret scanning; add the workflows (`go`, queue, daily digest, ship); add the evidence directory to the ignore file; offer a commented `.relevo/stacks/<stack>.md`, which it creates but does not commit and leaves for the person to commit with the other new files; and run `doctor`.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository with none of the above
- **THEN** all items are created and `doctor` reports success

#### Scenario: Monorepo
- **WHEN** the person names two platforms with different stacks and paths
- **THEN** `relevo.yml` has both entries and `doctor` checks the tools of both

#### Scenario: Existing legacy configuration
- **WHEN** `init` runs where `relevo.yml` has `platform: flutter-android`
- **THEN** it keeps the setting as it is and changes nothing in it unless the person asks

#### Scenario: Profile file of the repository
- **WHEN** the person asks for a profile file for stack `flutter`
- **THEN** the plan line says `.relevo/stacks/flutter.md` is created and left for the person to commit, `init` does not commit it, and the report lists it among the new files to commit and push

#### Scenario: Local-only setup keeps the ship workflow
- **WHEN** the person chooses that `go` runs only on each person's machine
- **THEN** the ship workflow is still added, because it needs no model credential

### Requirement: Init describes several platforms as built per issue
When `init` asks for the platforms, it SHALL tell the person that several platforms in one repository are supported and that `go` builds the platform each issue names with its `Platform:` line. It SHALL NOT say that `go` builds only a repository with one platform.

#### Scenario: Two platforms in one repository
- **WHEN** the person names a Flutter platform at `.` and a Supabase platform at `supabase`
- **THEN** `init` writes both and says that each issue names the platform it is for

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
`doctor` SHALL run every check and give each result one level: pass, fail, warn or note. A failure SHALL come with a fix. A check on something optional, or on something the platform may not offer, SHALL be a warning with its fix and SHALL NOT make `doctor` fail. Information that asks for no action SHALL be a note, which is neither a failure nor a warning.

#### Scenario: A failing check
- **WHEN** a check fails
- **THEN** the report shows the check as failed with the fix next to it

#### Scenario: An optional check
- **WHEN** a check on something optional does not hold
- **THEN** the report shows a warning with its fix, and the exit status stays 0

#### Scenario: Information with no action
- **WHEN** `doctor` has something to tell that asks the person for nothing, such as a reminder to read the terms of a subscription token
- **THEN** the report shows it as a note, and it counts neither as a failure nor as a warning

### Requirement: Doctor checks tools and configuration
`doctor` SHALL check the required tools, including the OpenSpec command-line tool at a supported version, a valid `relevo.yml`, the labels and the base branch.

#### Scenario: Invalid configuration
- **WHEN** `relevo.yml` fails validation
- **THEN** `doctor` reports that check as failed and shows the validation messages

### Requirement: Doctor checks repository protection
`doctor` SHALL check branch protection and rulesets on the base and release branches, that the automation cannot approve pull requests, that approvals are not dismissed when new commits are pushed, and that approval of the most recent push is not required (both required because the spec archive is committed after approval).

#### Scenario: Approvals dismissed on push
- **WHEN** the base branch dismisses approvals when new commits are pushed
- **THEN** `doctor` reports a failure explaining that the archive commit would dismiss the approval

#### Scenario: Approval of the last push required
- **WHEN** the base branch requires the most recent push to be approved by someone other than its author
- **THEN** `doctor` reports a failure explaining that the archive commit would need a new approval

### Requirement: Doctor checks the repository contents
`doctor` SHALL check that the OpenSpec root is tracked by git (an empty `openspec/` folder is not stored, so a clean checkout or the runner would have none), that `evidence/` is ignored by git, that the lifecycle labels and the base branch exist, and that the plugin repository can be cloned by the runner with the credential the workflow uses.

#### Scenario: OpenSpec root not tracked
- **WHEN** `openspec/config.yaml` is missing from git
- **THEN** `doctor` fails that check and says to run `init` and commit the OpenSpec files

#### Scenario: Private plugin repository
- **WHEN** the workflow clones a private plugin repository with a plain URL
- **THEN** `doctor` fails that check and says to store a read-only token and use the private-repository line of the workflow

#### Scenario: Branch protection unavailable
- **WHEN** the platform refuses to report branch protection because of the plan (for example a private repository on a free plan)
- **THEN** `doctor` reports a note, not a warning or a failure, that branch protection is not available on this plan and that approval and merge are then enforced only by the written confirmation in `ship`

#### Scenario: Branch rules unreadable for another reason
- **WHEN** the platform refuses to report branch protection for a reason other than the plan
- **THEN** `doctor` warns that the rules were not checked and says to run it again or to check the access to the repository

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
For each platform, `doctor` SHALL check the tools the profile requires, the tool of each target (a missing tool of a target is a warning, except `xcrun` on a machine that is not macOS, which is a notice), the skills the profile requires, and report which layers make up the profile (for example "flutter: plugin default + .relevo/stacks/flutter.md"). It SHALL fail when a platform's stack has no profile and warn about a value of the repository's profile that the plugin's profile ignores. It SHALL warn when the profile uses `.relevo/stacks/<stack>.md` and git does not track that file.

#### Scenario: Flutter with Android and web
- **WHEN** a platform has stack `flutter` and targets `android` and `web`
- **THEN** `doctor` checks `flutter` and `adb`, reports `android` and `web` as targets, and does not require `xcrun`

#### Scenario: Missing stack profile
- **WHEN** a platform names a stack with no profile
- **THEN** `doctor` fails that check and says where to define one

#### Scenario: iOS on Linux
- **WHEN** a platform has target `ios` and the machine is not macOS
- **THEN** `doctor` shows a notice that iOS can only be built and reviewed on macOS, and does not fail

#### Scenario: Profile file of the repository not tracked
- **WHEN** a platform's profile includes `.relevo/stacks/flutter.md` and git does not track that file
- **THEN** `doctor` warns that the cloud run and a fresh clone use only the plugin's profile, and says to commit the file

#### Scenario: Stack defined only by an untracked file
- **WHEN** the plugin has no profile for the stack and `.relevo/stacks/<stack>.md` is not tracked by git
- **THEN** `doctor` warns that the cloud run and a fresh clone have no profile for that stack, and says to commit the file

#### Scenario: Profile file of the repository tracked
- **WHEN** `.relevo/stacks/flutter.md` is tracked by git
- **THEN** `doctor` reports the layers as before and adds no warning about it

### Requirement: Doctor reads the skills of the roles
`doctor` SHALL list the skills resolved for each role, say which were left out and why, list the ones with scripts and whether they are allowed, warn when a role exceeds the size budget and warn when a skill folder differs from `skills-lock.json`.

#### Scenario: Skill left out
- **WHEN** a listed skill is not on the base branch
- **THEN** `doctor` shows it as left out with the reason

### Requirement: Doctor checks the linked repositories
When `links` is not empty, `doctor` SHALL check that each linked repository can be read, and that the secret `RELEVO_LINKS_TOKEN` exists (its name only, never its value); a missing secret is a warning when every linked repository is public and a failure when one is private. The fix SHALL ask for a token with read access to issues, pull requests and contents. When `links` is empty, none of this is checked.

#### Scenario: Private linked repository without the secret
- **WHEN** `links` lists a private repository and the secret does not exist
- **THEN** `doctor` fails that check and says to create a token with read access to issues, pull requests and contents and store it as `RELEVO_LINKS_TOKEN`

#### Scenario: Public linked repositories
- **WHEN** every linked repository is public and no secret exists
- **THEN** `doctor` warns, because the gate works without it but a private repository added later would not

#### Scenario: No links
- **WHEN** `links` is empty
- **THEN** `doctor` does not mention the secret

### Requirement: Init asks for the linked repositories
`init` SHALL ask which repositories this one depends on, write `links`, and remind the person to create the read-only secret with read access to issues, pull requests and contents, without reading or writing it.

#### Scenario: Front and back
- **WHEN** the person names `acme/api`
- **THEN** `relevo.yml` has `links: [acme/api]` and `init` shows what token to create, with read access to issues, pull requests and contents

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
- **THEN** `doctor` warns, names `/relevo:init` as the fix, and gives the install command that saves Playwright to the platform's development dependencies

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** `doctor` adds no autopilot check

### Requirement: Doctor checks that the build installs the toolchain
When the go workflow is installed, doctor SHALL fail for each configured platform whose stack needs a toolchain step (Flutter, Laravel, Supabase) that the go workflow does not install in an active, non-comment line, and SHALL say which step to add. For a stack that only the repository defines, it SHALL warn when no active line is guarded by `needs.decide.outputs.stack == '<stack>'`, and SHALL say to add a step guarded by that line; it SHALL NOT judge such a stack whose tools are only `node` and `npm`. It SHALL do nothing when the go workflow is not installed, and SHALL not judge the other stacks without a step in the template.

#### Scenario: A Flutter project whose workflow installs nothing
- **WHEN** a platform has the stack `flutter` and the go workflow has no active Flutter setup
- **THEN** doctor reports a failure that names the platform and says to enable the Flutter step of the template

#### Scenario: A Supabase platform whose workflow installs nothing
- **WHEN** a platform has the stack `supabase` and the go workflow has no active Supabase CLI setup
- **THEN** doctor reports a failure that names the platform and says to enable the Supabase step of the template

#### Scenario: A toolchain that is only a comment
- **WHEN** the only mention of the Flutter setup in the go workflow is a commented example
- **THEN** it counts as missing

#### Scenario: A project that builds on machines only
- **WHEN** the go workflow is not installed
- **THEN** doctor reports nothing about the toolchain

#### Scenario: An own stack with no step
- **WHEN** a platform has the stack `go`, defined only by the repository with the tool `go`, and the go workflow has no active line guarded by `needs.decide.outputs.stack == 'go'`
- **THEN** doctor warns, names the platform and says to add a step of the build job guarded by that line that installs Go

#### Scenario: An own stack with its step
- **WHEN** the go workflow has an active step guarded by `needs.decide.outputs.stack == 'go'`
- **THEN** doctor reports that the toolchain of the platform is installed

#### Scenario: An own stack that needs only Node
- **WHEN** the profile of an own stack lists only the tools `node` and `npm`
- **THEN** doctor does not judge its toolchain

### Requirement: Init mentions the toolchain of a workflow it leaves alone
When the go workflow exists and differs from the template, the plan SHALL say that its build job has to install the toolchain of the stacks of the project, and that the template does it for Flutter, Laravel and Supabase (Vue needs only Node, which the job already installs).

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

### Requirement: Doctor checks Supabase and Docker tools
When a platform has stack `supabase`, `doctor` SHALL check that `supabase` CLI is installed and that `docker` is installed and running, reporting failures or warnings with fix instructions when either is missing or when the Docker engine is stopped.

#### Scenario: Supabase CLI missing
- **WHEN** a platform has stack `supabase` and `supabase` is not installed
- **THEN** `doctor` reports `tools.supabase` as failed with the installation command

#### Scenario: Docker daemon not running
- **WHEN** `docker` CLI is installed but the Docker engine/daemon is stopped
- **THEN** `doctor` reports `tools.docker` with a warning or failure indicating the daemon is stopped and instructing the user to launch Docker Desktop or OrbStack

#### Scenario: Supabase tools fully operational
- **WHEN** `supabase` is installed and `docker info` succeeds
- **THEN** `doctor` reports `tools.supabase` and `tools.docker` as passed

### Requirement: Init assists Supabase stack setup
When `init` detects or configures a platform with stack `supabase`, it SHALL offer to install the official Supabase agent skills (`npx skills add supabase/agent-skills`) as a confirmed install step. In its report or manual steps, `init` SHALL provide copy-pasteable instructions for configuring the Supabase MCP server in supported coding agents (Claude Code and Antigravity) and instructions for installing Docker or Supabase CLI if missing.

#### Scenario: Init offers Supabase skills install
- **WHEN** `init` plans a repository with a `supabase` platform and the skills are missing
- **THEN** it displays `npx skills add supabase/agent-skills` as an install step to confirm

#### Scenario: Init guidance for Supabase MCP
- **WHEN** `init` finishes configuring a `supabase` platform
- **THEN** its final manual steps list the command to add the Supabase MCP server for interactive design sessions

### Requirement: Doctor checks what the ship workflow needs
When the ship workflow is installed on the default branch, `doctor` SHALL check that the `ship` label exists and, when the base branch requires status checks, that the two GitHub App secrets of the ship workflow exist (without reading them). It SHALL report the state of `RELEVO_CLOUD_SHIP`, and SHALL NOT require a model credential for it.

#### Scenario: Required checks without the App
- **WHEN** the base branch requires status checks and the App secrets do not exist
- **THEN** `doctor` fails that check, says that the label cannot ship in this repository, and names the secrets and the page that explains how to create the App

#### Scenario: No required checks
- **WHEN** the base branch requires no status checks
- **THEN** `doctor` passes without the App secrets and says that the checks of the approved head carry over to the archive commit

#### Scenario: Ship paused
- **WHEN** `RELEVO_CLOUD_SHIP` is `off`
- **THEN** `doctor` warns that the `ship` label is paused

### Requirement: Init sets up what a browser review of Vue needs
For each platform with stack `vue` and a `web` target, `init` SHALL offer, as installs confirmed one at a time, adding the browser library to the platform's development dependencies and installing its browser. It SHALL leave the changed manifest and lock file for the person to commit. When it creates `relevo.yml` with such a platform, it SHALL set `review.autopilot` to `precheck`.

#### Scenario: Vue platform without the browser library
- **WHEN** `init` plans a repository with a Vue platform with a `web` target whose folder cannot resolve Playwright
- **THEN** the plan shows `npm install -D playwright`, run in the platform's folder, as an install to confirm, and, after it runs, says that `package.json` and the lock file are left for the person to commit

#### Scenario: Browser not installed
- **WHEN** Playwright resolves from the platform's folder but its Chromium is not installed, or Playwright was just added
- **THEN** the plan shows `npx playwright install chromium`, run in the platform's folder, as an install to confirm

#### Scenario: Already set up
- **WHEN** Playwright resolves and its Chromium is installed
- **THEN** the plan reports both as already in place and offers nothing

#### Scenario: Declined
- **WHEN** the person declines either install
- **THEN** `init` continues, says a browser review of that platform will stop until it is installed, and `doctor` keeps warning

#### Scenario: New configuration with a Vue web platform
- **WHEN** `init` creates `relevo.yml` and a platform has stack `vue` and a `web` target
- **THEN** the file has `review.autopilot: precheck`

#### Scenario: Existing configuration with the autopilot off
- **WHEN** `relevo.yml` already exists with `review.autopilot: off` and a Vue web platform
- **THEN** `init` does not rewrite the file, and lists a manual step saying that a browser review needs `review.autopilot` set to `precheck` or `verify`

### Requirement: Init offers OpenSpec for web sessions
`init` SHALL plan, as an install the person confirms with the exact hook shown, a `SessionStart` hook in the repository's `.claude/settings.json` that installs the OpenSpec command line in a session of Claude Code on the web when it is missing, and SHALL list the line as already done when the hook is there. The hook SHALL run nothing outside a remote session and nothing when OpenSpec already runs. `init` SHALL keep every other setting of the file, SHALL leave the changed file for the person to commit, and SHALL NOT write the hook when the person declines.

#### Scenario: A repository without the hook
- **WHEN** `.claude/settings.json` has no `SessionStart` hook that installs OpenSpec
- **THEN** the plan has an install line that shows the hook, and nothing is written before the person says yes

#### Scenario: A settings file with other settings
- **WHEN** the person agrees and `.claude/settings.json` already holds other settings or other hooks
- **THEN** the hook is added next to them and none of them changes

#### Scenario: A repository that already has the hook
- **WHEN** `.claude/settings.json` has a `SessionStart` hook that installs OpenSpec
- **THEN** the line is reported as already in place and nothing is added twice

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual one that asks the person to fix the file, and `init` does not touch it

#### Scenario: The person declines
- **WHEN** the person says no to the hook
- **THEN** `init` continues and writes nothing for it, and `doctor` keeps warning in a remote session

### Requirement: Doctor warns when a web session has no OpenSpec hook
When `doctor` runs inside a remote session and the repository's `.claude/settings.json` has no `SessionStart` hook that installs OpenSpec, it SHALL report a warning with the fix next to it, and the warning SHALL NOT be a failure. It SHALL report nothing about the hook when it does not run in a remote session. It SHALL NOT change anything.

#### Scenario: A remote session without the hook
- **WHEN** `doctor` runs with `CLAUDE_CODE_REMOTE` set to `true` and the repository has no such hook
- **THEN** it reports a warning that names the hook and says to run `/relevo:init`

#### Scenario: A remote session with the hook
- **WHEN** `doctor` runs in a remote session and the hook is there
- **THEN** it reports a passed check

#### Scenario: A terminal
- **WHEN** `doctor` runs outside a remote session
- **THEN** it reports no check about the hook, whether or not the hook exists

### Requirement: Init writes the runner into the workflows
`init` SHALL generate every Relevo workflow with `runs-on` set from `runner.labels` (`ubuntu-latest` when absent), SHALL ask for the labels only when the person says the repository uses a self-hosted runner, and SHALL keep the `runs-on` of a workflow it rewrites equal to `runner.labels`.

#### Scenario: Default
- **WHEN** the person gives no runner
- **THEN** the workflows run on `ubuntu-latest` and `relevo.yml` has no `runner` key

#### Scenario: Self-hosted
- **WHEN** the person says the repository uses a self-hosted runner with the labels `self-hosted` and `linux-build`
- **THEN** `relevo.yml` gets `runner.labels: [self-hosted, linux-build]` and every generated workflow runs on `[self-hosted, linux-build]`

#### Scenario: Regenerating a workflow
- **WHEN** `init` rewrites or adds a workflow in a repository that sets `runner.labels`
- **THEN** the workflow runs on those labels and not on `ubuntu-latest`

### Requirement: Doctor checks the runner of the workflows
`doctor` SHALL compare the `runs-on` of each Relevo workflow on the default branch with `runner.labels` and SHALL fail on a difference, with one result that names every file that differs and the fix. When the runner is not `ubuntu-latest`, it SHALL warn once that Relevo assumes the runner persists between jobs, that the code the agent writes runs with the permissions of the runner's user, and that an ephemeral runner or a container is the real barrier. It SHALL NOT claim to know whether the runner is ephemeral.

#### Scenario: A workflow edited by hand
- **WHEN** `relevo.yml` has no `runner` key and `relevo-go.yml` on the default branch runs on `[self-hosted, linux-build]`
- **THEN** `doctor` fails, names `relevo-go.yml` and says to set `runner.labels` or restore `ubuntu-latest`

#### Scenario: Several workflows differ
- **WHEN** five Relevo workflows run on `[self-hosted, linux-build]` and `runner.labels` is absent
- **THEN** `doctor` reports one failed result that names the five files, with one fix

#### Scenario: Workflows and setting agree
- **WHEN** every Relevo workflow runs on `[self-hosted, linux-build]` and `runner.labels` is `[self-hosted, linux-build]`
- **THEN** the runner check passes and one warning explains that the runner is assumed to persist

#### Scenario: Hosted runner
- **WHEN** `runner.labels` is absent and every workflow runs on `ubuntu-latest`
- **THEN** the runner check passes and no persistence warning appears

### Requirement: The urgent label is created and checked
`init` SHALL create the `urgent` label together with the other lifecycle labels, with the name given in `labels` when there is one, and `doctor` SHALL report it as missing when it does not exist in the repository. A repository set up before this label existed SHALL be told by `doctor` how to create it, and no other check SHALL change.

#### Scenario: Fresh repository
- **WHEN** `init` runs on a repository without Relevo labels
- **THEN** the plan lists `relevo:urgent` among the labels it will create

#### Scenario: Repository set up earlier
- **WHEN** `doctor` runs on a repository that has every label except `relevo:urgent`
- **THEN** it fails the labels check, names `relevo:urgent` and says that `init` creates it

#### Scenario: Renamed label
- **WHEN** `labels.urgent` is `prio:now`
- **THEN** `init` creates `prio:now` and `doctor` checks for `prio:now`

### Requirement: The report puts what needs action first
The text report SHALL list the failures, then the warnings, then the notes, each section with its count, and SHALL show the checks that passed only as a count. With `--all` it SHALL list every check in the order it was evaluated. The exit status and the output of `--json` SHALL NOT depend on the layout.

#### Scenario: A report with problems
- **WHEN** `doctor` finds 3 failures, 2 warnings, 1 note and 30 passes
- **THEN** the report lists the 3 failures, then the 2 warnings, then the note, and ends with a line that says 30 checks passed

#### Scenario: The full list
- **WHEN** `doctor --all` runs
- **THEN** every check appears, passes included, in the order it was evaluated

#### Scenario: All green
- **WHEN** no check failed or warned
- **THEN** the report says so, gives the count of checks that passed and lists any notes

#### Scenario: The machine-readable output
- **WHEN** `doctor --json` runs, with or without `--all`
- **THEN** it lists every check with its level, notes included, and the exit status is 1 only when a check failed

### Requirement: The report says what it judged
The report SHALL start with a line that names the repository and says where the workflows were read from: the default branch, named, or the working copy when the branch could not be read.

#### Scenario: Workflows read from the default branch
- **WHEN** `doctor` reads the workflows from the default branch `main` of `owner/repo`
- **THEN** the first line names `owner/repo` and the branch `main`

#### Scenario: The branch cannot be read
- **WHEN** the default branch cannot be read and `doctor` falls back to the working copy
- **THEN** the first line says that the workflows were read from the working copy

### Requirement: One result per cause
When several files fail or warn for the same reason with the same fix, `doctor` SHALL report them as one result that names every file. The summary SHALL count results, not files.

#### Scenario: Two causes
- **WHEN** five workflows fail the runner check and two labels are missing
- **THEN** the report lists two failures and the summary says 2 checks failed

#### Scenario: Workflows that are not installed
- **WHEN** two Relevo workflows are not installed
- **THEN** the report shows one warning that names both files and gives one fix

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

### Requirement: Doctor notes the recommended Dart and Flutter skills
For a repository with a platform of stack `flutter`, `doctor` SHALL report once, for each coding agent the repository uses, whether the official Dart and Flutter skills are available: a pass when they are, a note when they are not, with the install commands. It SHALL report nothing for an agent it cannot check. The agents are Claude Code, and Antigravity when the repository has an Antigravity plugin of Relevo or sets `agent.build: antigravity`.

#### Scenario: Plugin missing in Claude Code
- **WHEN** a platform has stack `flutter`, `claude plugin list --json` answers, and neither the plugin `dart-flutter` nor a skill folder starting with `flutter-` is found
- **THEN** `doctor` reports a note `recommended.flutter.claude` with the commands `claude plugin marketplace add flutter/agent-plugins` and `claude plugin install dart-flutter@dart-flutter`

#### Scenario: Plugin installed
- **WHEN** `claude plugin list --json` lists `dart-flutter`, at the user scope or at the project scope of this repository
- **THEN** `doctor` reports a passed check `recommended.flutter.claude`

#### Scenario: Skills committed to the repository
- **WHEN** a folder starting with `flutter-` exists under `.agents/skills` or `.claude/skills`
- **THEN** `doctor` reports a pass for each agent it applies to, and no note

#### Scenario: Claude Code cannot list its plugins
- **WHEN** `claude plugin list --json` fails or `claude` is not installed, and no folder starting with `flutter-` is found
- **THEN** `doctor` reports no `recommended.flutter.claude` check

#### Scenario: Antigravity in use and skills missing
- **WHEN** the repository has an Antigravity plugin of Relevo or `agent.build` is `antigravity`, and no folder starting with `flutter-` exists under `.agents/skills`
- **THEN** `doctor` reports a note `recommended.flutter.antigravity` with the command `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes`, and says that the Antigravity IDE installs them from its settings, which `doctor` cannot check

#### Scenario: Antigravity not in use
- **WHEN** the repository has no Antigravity plugin of Relevo and `agent.build` is not `antigravity`
- **THEN** `doctor` reports no `recommended.flutter.antigravity` check

#### Scenario: No Flutter platform
- **WHEN** no platform of the repository has stack `flutter`
- **THEN** `doctor` reports no `recommended.flutter` check

### Requirement: A recommended skill never blocks
A recommended skill SHALL NOT be a failure or a warning of `doctor`, SHALL NOT change its exit status, SHALL NOT be listed under `requires_skills` of the Flutter profile, and SHALL NOT stop `go`, `review` or `ship`. Relevo SHALL NOT hand a recommended skill to the `dev` or `qa` agent.

#### Scenario: Everything else passes
- **WHEN** every other check of a Flutter repository passes and the recommended skills are missing
- **THEN** `doctor` exits with status 0 and the report shows one note

#### Scenario: The profile of Flutter
- **WHEN** the profile of `flutter` is resolved
- **THEN** its `requires_skills` is empty and its `skills` lists for `dev`, `qa`, `issue` and `review` are empty

### Requirement: Init offers the recommended Dart and Flutter skills as optional installs
When `init` plans a repository with a platform of stack `flutter` and the skills `doctor` looks for are missing for an agent the repository uses, it SHALL list each install command as an optional install, show its exact text, and run it only after a yes to that command alone. Declining SHALL change nothing else and SHALL NOT make a later step fail. What is not a command SHALL be listed as a manual step. `init` SHALL NOT write the project's rules file or any MCP configuration file.

#### Scenario: Offered for Claude Code
- **WHEN** a Flutter platform is planned, `claude` can list its plugins and `dart-flutter` is not installed
- **THEN** the plan has two optional installs, `claude plugin marketplace add flutter/agent-plugins` and `claude plugin install dart-flutter@dart-flutter`, and nothing runs before the person says yes to each one

#### Scenario: Offered for the Antigravity CLI
- **WHEN** the repository uses Antigravity and no folder starting with `flutter-` exists under `.agents/skills`
- **THEN** the plan has one optional install, `npx skills add flutter/agent-plugins --skill '*' --agent universal --yes`

#### Scenario: Declined
- **WHEN** the person declines an optional install
- **THEN** `init` continues, says the recommendation stays open, and `doctor` keeps the note

#### Scenario: Already installed
- **WHEN** the skills are found for an agent
- **THEN** the plan lists that line as done and offers nothing for it

#### Scenario: Steps that are not commands
- **WHEN** the plan includes the Flutter recommendation because a skill is missing
- **THEN** it lists as a manual step copying the official rules into the project's rules file and, when Antigravity is in use, installing the plugin from the settings of the Antigravity IDE ("Customizations", "Build with Google Plugins", "Dart and Flutter") and adding the Dart MCP server to `.agents/mcp_config.json`; and `init` writes none of them

### Requirement: Doctor compares the configuration the cloud reads with the base branch
When the default branch is not the base branch, `doctor` SHALL read `relevo.yml` from both branches on GitHub and warn when their settings differ or when the default branch has none while the base branch has one, saying that the cloud uses the copy on the default branch and giving the fix of promoting the base branch or making it the default branch. Differences in comments or layout alone SHALL NOT warn.

#### Scenario: A limit changed only on the base branch
- **WHEN** the default branch is `main`, the base branch is `dev`, and `limits.run_max_turns` differs between their `relevo.yml`
- **THEN** `doctor` warns that the cloud reads `relevo.yml` from `main`, which differs from `dev`, and the fix says to promote `dev` to `main` or to make `dev` the default branch

#### Scenario: Only a comment differs
- **WHEN** the two files differ only in comments or whitespace and give the same settings
- **THEN** `doctor` passes the check

#### Scenario: No configuration on the default branch
- **WHEN** the base branch has `relevo.yml` and the default branch does not
- **THEN** `doctor` warns that the cloud finds no `relevo.yml` on the default branch, with the same fix

#### Scenario: The base branch is the default branch
- **WHEN** the default branch is the base branch
- **THEN** `doctor` makes no comparison and reports nothing for it

#### Scenario: A branch cannot be read
- **WHEN** reading `relevo.yml` from either branch fails for a reason other than the file not existing, or the base branch has no `relevo.yml`
- **THEN** `doctor` reports nothing for the comparison and does not fail

### Requirement: Doctor checks what an api review needs
For each platform whose stack has the `api` review adapter, `doctor` SHALL check that PHP and Composer can be found, that `vendor/` exists, and the database the test configuration declares, without reading the real environment files. It SHALL warn, with the command to fix it, when one is missing, and SHALL note a test database that is not in-memory SQLite, because the review needs the person's confirmation before it runs a test.

#### Scenario: Laravel without dependencies
- **WHEN** a Laravel platform has no `vendor/`
- **THEN** `doctor` warns and gives the Composer command to install them

#### Scenario: Database in the test configuration
- **WHEN** the test configuration declares a MySQL connection
- **THEN** `doctor` notes it and says the review asks for confirmation before it runs tests

#### Scenario: Not a Laravel platform
- **WHEN** no platform has the `api` adapter
- **THEN** `doctor` adds none of these checks

### Requirement: Doctor checks the review block of a profile
`doctor` SHALL report, as the failure of an invalid profile, a `review` block that cannot be read, and SHALL warn about a `serve` whose command is not on the base branch, a `log` that matches no file and whose directory does not exist, or text in the section `Review` that asks for what the block cannot change. It SHALL list which `review` keys the repository replaced.

#### Scenario: Log path that matches nothing
- **WHEN** `review.log` is `var/log/app.log` and neither the file nor `var/log` exists
- **THEN** `doctor` warns and names the setting

#### Scenario: Keys replaced
- **WHEN** the repository replaced `review.test`
- **THEN** `doctor` lists it as a note, not a failure

#### Scenario: Text that asks to skip the audit
- **WHEN** the section `Review` tells the agent to skip the audit
- **THEN** `doctor` warns that the review ignores it

### Requirement: Init proposes a full profile for a stack the plugin does not ship
When a platform's stack has no profile in the plugin, `init` SHALL propose creating `.relevo/stacks/<stack>.md` without being asked and write a profile meant to be the whole of it. It SHALL leave the commented lines `analyze`, `test` and `format` for the person to fill in and SHALL NOT write a command that succeeds without checking anything. It SHALL create the file without committing it and list it among the files to commit.

#### Scenario: A Go platform
- **WHEN** `init` runs for a platform with stack `go` and the plugin has no profile for `go`
- **THEN** the plan includes `.relevo/stacks/go.md`, whose header names the stack and has the commented commands `analyze`, `test` and `format`, the tools and the generated files, and whose body asks for the hygiene of the developer and what QA looks for

#### Scenario: A stack the plugin ships
- **WHEN** `init` runs for a platform with stack `vue` and the person did not ask for a profile file
- **THEN** the plan does not include `.relevo/stacks/vue.md`

#### Scenario: The person declines
- **WHEN** the person says no to the proposed profile of a stack the plugin does not ship
- **THEN** `init` does not create the file, writes `relevo.yml` as usual and says that `doctor` will warn until the profile exists

#### Scenario: The file already exists
- **WHEN** `.relevo/stacks/go.md` already exists
- **THEN** `init` leaves it as it is and says it exists

### Requirement: Doctor warns about an own stack without analyze or test
For a platform whose profile is defined only by the repository, `doctor` SHALL warn when the commands of the resolved profile, after `platforms.<name>.checks`, have no `analyze` or no `test`, naming the missing commands, the file and the `checks` of `relevo.yml` as the other place to set them. It SHALL NOT judge a profile that has a layer from the plugin.

#### Scenario: Profile with no commands
- **WHEN** the profile of stack `go` is only `.relevo/stacks/go.md` and it defines no command
- **THEN** `doctor` warns that platform `app` has no `analyze` and no `test`, and says to write them in that file

#### Scenario: Command given by checks
- **WHEN** the same profile defines `test` and `relevo.yml` sets `platforms.app.checks.analyze`
- **THEN** `doctor` adds no warning about the commands

#### Scenario: A stack of the plugin
- **WHEN** the profile has a layer from the plugin
- **THEN** `doctor` adds no warning about the commands

### Requirement: Init offers the Laravel Boost skills as optional installs
For a platform of stack `laravel` whose folder has a `composer.json` and no skill of the `laravel` profile committed, `init` SHALL offer two optional installs, run from that folder: `composer require laravel/boost --dev`, then `php artisan boost:install --skills --no-interaction`. It SHALL run each only after a yes to that command alone, SHALL list committing what they write as a manual step, and SHALL NOT run Boost for guidelines or the MCP server nor write the project's rules file.

#### Scenario: Offered
- **WHEN** a Laravel platform with `path: api` has `api/composer.json` without `laravel/boost` and no committed Boost skills
- **THEN** the plan has the two optional installs, the second with `--no-interaction` so that it asks nothing, shown with the folder `api`, and nothing runs before the person says yes to each

#### Scenario: Commit what Boost wrote
- **WHEN** the plan offers the installs
- **THEN** it lists as a manual step committing `.claude/skills/` of the platform, `boost.json`, `composer.json` and `composer.lock`, says that Boost also writes the folders of the other agents it finds (`.agents/` and `.kiro/`), which a project commits only if it uses them, and says that Laravel suggests keeping generated files out of git and that the cloud runner reads only what is committed

#### Scenario: Declined
- **WHEN** the person declines an install
- **THEN** `init` continues, says the recommendation stays open, and `doctor` keeps the note

#### Scenario: Already installed
- **WHEN** `laravel/boost` is in `composer.json` and the skills are committed
- **THEN** the plan lists the line as done and offers nothing

#### Scenario: No composer file
- **WHEN** the folder of the platform has no `composer.json`
- **THEN** the plan offers nothing for Laravel

### Requirement: Doctor notes when Laravel Boost is missing
For a platform of stack `laravel` whose folder has a `composer.json`, `doctor` SHALL report a note `recommended.laravel.boost` when `laravel/boost` is in neither `require` nor `require-dev`, with the two install commands, and a note when Boost is there and no skill of the `laravel` profile is committed in the folder of the platform or at the root. It SHALL report a pass when both are in place. The note SHALL NOT change the exit status.

#### Scenario: Boost missing
- **WHEN** `composer.json` of the platform does not require `laravel/boost`
- **THEN** `doctor` reports the note with `composer require laravel/boost --dev` and `php artisan boost:install --skills --no-interaction`, and the exit status is untouched

#### Scenario: Boost present and no skills committed
- **WHEN** `laravel/boost` is in `require-dev` and `.claude/skills/` of the platform and the root hold none of the skills the profile lists
- **THEN** `doctor` reports a note to run `php artisan boost:install --skills --no-interaction` and commit the result

#### Scenario: Both in place
- **WHEN** Boost is required and a skill of the profile is committed
- **THEN** `doctor` reports a pass

#### Scenario: Not Laravel
- **WHEN** no platform has stack `laravel`
- **THEN** `doctor` reports no `recommended.laravel` check

### Requirement: Init offers the community Vue skills, labelled as not official
For a platform of stack `vue`, when neither `vue-best-practices` nor `vue-testing-best-practices` is committed, `init` SHALL offer an optional install run from the folder of the platform, `npx skills add vuejs-ai/skills` naming the two skills with `--agent claude-code --copy --yes`. Its text SHALL say that the skills are not official and are an early experiment. `doctor` SHALL report nothing about their absence.

#### Scenario: Offered with the label
- **WHEN** a Vue platform with `path: web` has neither skill committed
- **THEN** the plan has an optional install to run from `web`, whose description says they are not official and an early experiment

#### Scenario: Installed
- **WHEN** both skills are committed
- **THEN** the plan lists the line as done

#### Scenario: Doctor says nothing
- **WHEN** the skills are not installed
- **THEN** `doctor` reports no note and no warning about them

### Requirement: Doctor warns when a skill folder is ignored by git
For every platform, `doctor` SHALL warn when a skill folder that exists, `.claude/skills` or `.agents/skills`, in the folder of the platform or at the root, is ignored by git, naming the folder, because the cloud runner reads only what is committed. It SHALL say nothing when git cannot tell.

#### Scenario: Ignored
- **WHEN** `api/.claude/skills` exists and `.gitignore` excludes it
- **THEN** `doctor` warns that the folder is ignored by git, that the cloud runner will not see it, and to remove the ignore rule and commit the folder

#### Scenario: Tracked
- **WHEN** the folder is not ignored
- **THEN** `doctor` reports nothing about it

#### Scenario: Git cannot tell
- **WHEN** the working copy is not a git repository
- **THEN** `doctor` reports nothing about it

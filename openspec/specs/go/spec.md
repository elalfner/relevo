# go Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Trigger
`go` SHALL start only for an issue that belongs to a milestone and carries the `ready` label, and only when the label was applied by a user with write permission on the repository.

#### Scenario: Authorised label
- **WHEN** a collaborator with write access applies `ready` to an issue in a milestone
- **THEN** the issue is evaluated by the gates

#### Scenario: Unauthorised label
- **WHEN** a user without write access applies `ready`
- **THEN** no run starts and the label is removed

#### Scenario: No milestone
- **WHEN** `ready` is applied to an issue with no milestone
- **THEN** no run starts, the `ready` label is removed and a comment asks for a milestone

#### Scenario: No assignee
- **WHEN** `ready` is applied to an issue with no assignee
- **THEN** no run starts, the `ready` label is removed and a comment asks for an assignee, because there would be nobody to hand the result to

### Requirement: Gate 1, spec
Before building, `go` SHALL verify that the issue states scenarios and edge cases. It SHALL NOT invent them.

#### Scenario: Spec incomplete
- **WHEN** the issue has no scenarios or no edge cases
- **THEN** it is labelled `needs-spec`, assigned back to the spec writer with a comment listing what is missing, and no build starts

### Requirement: Gate 2, dependencies
`go` SHALL NOT build an issue whose `Depends-on` issues are not all merged, whether they are in this repository or in a linked one.

#### Scenario: Blocked
- **WHEN** a dependency is open
- **THEN** the issue is labelled `blocked` and the queue moves to the next eligible issue

#### Scenario: Blocked by another repository
- **WHEN** a dependency is `acme/api#12` and it is open
- **THEN** the issue is labelled `blocked` and the notice names `acme/api#12`

### Requirement: Gate 3, capacity
`go` SHALL NOT start an issue for an assignee who already has `limits.built_unreviewed_per_person` issues in `built`.

#### Scenario: Assignee at capacity
- **WHEN** the assignee has 2 issues in `built` and the limit is 2
- **THEN** the issue is labelled `queued`, one comment says the assignee is at the limit (without mentioning anyone), and it starts when the assignee's count drops below the limit

### Requirement: Queue order
Eligible issues SHALL be started in first-in-first-out order of the time `ready` was applied. An ineligible issue SHALL be skipped without blocking the others and SHALL keep its position.

#### Scenario: Head of line is blocked
- **WHEN** the oldest issue is `blocked` and a newer issue is eligible
- **THEN** the newer issue starts, and the older one starts first once it becomes eligible

### Requirement: Concurrency and cost limits
`go` SHALL run at most one agent per issue and at most `limits.concurrent_agents` agents overall. A run that exceeds `limits.run_max_turns` or `limits.run_max_cost` SHALL be stopped by the runner: the agent cannot see its own counters and does not try to stop itself.

#### Scenario: Duplicate trigger
- **WHEN** the label event fires twice for the same issue
- **THEN** only one run executes

#### Scenario: Run exceeds its budget
- **WHEN** a run reaches its turn or cost limit
- **THEN** the runner stops it, the agent pushes nothing, and the final step of the workflow labels the issue `qa-failed` and comments with the job status and a link to the run

#### Scenario: Retry after a budget cut
- **WHEN** the person applies `ready` again after a run was cut by its limits
- **THEN** the issue is evaluated like any other, because the cut run pushed no branch

### Requirement: The workflow enforces the limits
The workflow that runs `go` SHALL start only when a person (not an automation account) applies the `ready` label, SHALL group runs per issue without cancelling a run in progress, SHALL pass the turn and cost limits to the agent runner, and SHALL end a run after a fixed time limit. The cost limit is enforced by the runner, not by the agent.

#### Scenario: Label applied by an automation
- **WHEN** an automation account applies `ready`
- **THEN** the workflow does not start

#### Scenario: Run takes too long
- **WHEN** a run exceeds the workflow time limit
- **THEN** the runner stops it; if the workflow can still run its final step, that step reports the run on the issue (see "A run that ends without an outcome is reported"), otherwise the issue stays `building` until a person resets it

### Requirement: The gates run before the build setup
The workflow that runs `go` SHALL run the gates and claim the issue in a light job that installs no platform toolchain and starts no agent, and SHALL start the build job, with the toolchain and the agent, only when the decision is `start`. The decision SHALL travel to the build job so that it does not plan again.

#### Scenario: Issue not ready to build
- **WHEN** the gates decide `needs-spec`, `blocked`, `queued`, `denied`, no milestone or no assignee
- **THEN** the light job applies the outcome and its comment, and the build job does not start

#### Scenario: Gates pass
- **WHEN** the gates decide `start`
- **THEN** the light job marks the issue `building`, the build job starts, and the agent receives the decision instead of planning again

#### Scenario: Second dispatch for the same issue
- **WHEN** a second run is dispatched for an issue that the first run already claimed or built
- **THEN** it waits for the first run, finds nothing to start in the light job, and the build job does not start

#### Scenario: The light job fails
- **WHEN** the light job fails and the issue is still `ready`, `queued` or `building`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

### Requirement: Builds started by the queue are accepted
The workflow SHALL accept a build dispatched by the queue workflow, whose actor is the Actions bot, and SHALL allow that one bot only. It SHALL NOT allow every bot, because that would let outside applications start runs.

#### Scenario: The queue starts a build
- **WHEN** the queue dispatches the `go` workflow for an eligible issue
- **THEN** the agent runner accepts the run although its actor is the Actions bot

#### Scenario: Another bot starts a run
- **WHEN** a bot other than the Actions bot starts the workflow
- **THEN** the agent runner refuses it

### Requirement: A run that ends without an outcome is reported
The workflow that runs `go` SHALL end with a step that always runs. When the issue is still `ready` or `building` after the agent step, that step SHALL replace the label with `qa-failed` and SHALL comment, mentioning the assignee, with the job status and a link to the run, so no failure before or during the agent is silent. When the issue carries any other state, the step SHALL NOT change it.

#### Scenario: The plugin cannot be installed
- **WHEN** the run fails before `go` starts and the issue is still `ready`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

#### Scenario: The agent ends its session early
- **WHEN** the job succeeds but the issue is still `building`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

#### Scenario: A dispatched run fails before claiming the issue
- **WHEN** the job fails and the issue is still `queued`
- **THEN** the issue is labelled `qa-failed` and a comment links the run, so the queue does not dispatch it again every evaluation

#### Scenario: A run ends normally with the issue queued
- **WHEN** the job succeeds and the issue is `queued` because there was no capacity
- **THEN** the final step changes nothing

#### Scenario: The run recorded its outcome
- **WHEN** the issue is `built`, `queued`, `blocked`, `needs-spec` or `qa-failed` when the job ends
- **THEN** the final step changes nothing

### Requirement: Labels follow the run
`go` SHALL set `queued` while an issue waits for capacity, `building` when its run starts, and `built` when it finishes successfully, removing the previous lifecycle label each time.

#### Scenario: Run starts
- **WHEN** a run starts for a `queued` issue
- **THEN** `queued` is replaced by `building`

### Requirement: Build without pauses
After the gates pass, `go` SHALL create the change specification from the issue, create the branch from the base branch, implement the tasks, and run QA, without waiting for human approval of the generated specification.

#### Scenario: Happy path
- **WHEN** all gates pass
- **THEN** a branch `feature/<n>-<slug>` is created from the current base branch, the tasks are implemented and QA passes

### Requirement: Adversarial QA with one retry
QA SHALL compare the diff against the issue's scenarios and the project rules in `qa.rules_from`, run the platform's static analysis and tests, and return `QA PASSED` or `QA REJECTED` with file, line and reason. On rejection the developer agent SHALL get exactly `qa.retries` attempts to fix, then QA SHALL run again.

#### Scenario: QA passes after a retry
- **WHEN** the first QA run rejects and the second passes
- **THEN** the build proceeds as passed

#### Scenario: QA still rejects
- **WHEN** QA rejects after the allowed retries
- **THEN** the branch is pushed, the issue is labelled `qa-failed`, the assignee is mentioned with the QA report, no pull request is opened and the state does not advance

#### Scenario: Task marked done without code
- **WHEN** a task is checked off without code that implements it
- **THEN** QA rejects and names the task

#### Scenario: Validation tooling missing
- **WHEN** QA cannot run static analysis or tests because the tooling is not available
- **THEN** QA rejects with the finding "automated validation could not run" and never passes code it could not check

#### Scenario: Device-only scenario
- **WHEN** a scenario can only be observed on a device or in another app
- **THEN** QA does not reject it for lacking a test, checks that the code plausibly produces it, and lists it as left for on-device review

#### Scenario: Verdict line
- **WHEN** QA finishes
- **THEN** the first line of its output is exactly `QA PASSED` or `QA REJECTED`

### Requirement: Safe commits
Every commit `go` makes SHALL stage named files only (never "add all"), scan the staged diff for temporary markers (`NOCOMMIT`, `TEMP`, `DO NOT COMMIT`) and credential patterns, and refuse protected paths. It SHALL stop at the first finding without committing.

#### Scenario: Temporary marker staged
- **WHEN** the staged diff contains `NOCOMMIT`
- **THEN** the commit is aborted and the assignee is told which file

#### Scenario: Credential found before pushing
- **WHEN** the staged diff contains a possible credential
- **THEN** nothing is pushed, the issue is labelled `qa-failed` with that reason, and the comment states that the branch was not pushed

#### Scenario: Protected path staged
- **WHEN** the staged diff touches a protected path the issue does not allow
- **THEN** nothing is committed or pushed and the issue is labelled `qa-failed` with the reason "protected path in the diff"

### Requirement: Unrecoverable problems end in qa-failed
Any problem `go` cannot recover from SHALL end in the `qa-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential, a temporary marker, a protected path in the diff or an issue that changed after `ready`, or when the branch already exists, which `go` never touches. It SHALL NOT open a pull request or advance the state.

#### Scenario: Branch already exists
- **WHEN** the feature branch already exists on the remote
- **THEN** `go` leaves it untouched and ends in `qa-failed` with the reason "branch already exists"

#### Scenario: Branch already exists with implementation commits
- **WHEN** the feature branch already exists on the remote and holds commits other than the specification commit
- **THEN** `go` leaves it untouched, ends in `qa-failed` with the reason "branch already exists", and the comment says to run `/relevo:fix <n>`

#### Scenario: Branch already exists with only the specification
- **WHEN** the feature branch already exists on the remote and holds only the specification commit
- **THEN** `go` leaves it untouched, ends in `qa-failed` with the reason "branch already exists", and the comment says to delete the remote branch and apply `ready` again

#### Scenario: Specification invalid
- **WHEN** the generated change specification still fails validation after two corrections
- **THEN** `go` ends in `qa-failed` with the reason "specification invalid"

#### Scenario: Ambiguity that changes behaviour
- **WHEN** the issue is ambiguous in a way that changes observable behaviour
- **THEN** `go` does not guess: the issue is labelled `needs-spec`, assigned to the spec writer, and nothing is pushed

### Requirement: Successful hand-off
On `QA PASSED`, `go` SHALL push the branch, label the issue `built`, and post the hand-off message to the assignee.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the issue is `built`, the branch is pushed and the assignee is mentioned once

### Requirement: The queue only acts on waiting issues
The queue SHALL act only on issues that are already `queued` or `blocked`. An issue that has just been marked `ready` is handled by the `go` workflow that the label started, so the queue SHALL NOT apply its decision or dispatch a build for it.

#### Scenario: Issue just marked ready
- **WHEN** an issue is labelled `ready` and the queue and the `go` workflow both start on that event
- **THEN** only the `go` workflow decides about it, and its comment is posted once

#### Scenario: Waiting issue becomes eligible
- **WHEN** a `queued` or `blocked` issue becomes eligible
- **THEN** the queue starts it

### Requirement: Queue re-evaluation
The queue SHALL be re-evaluated on every relevant event (an issue merged, a `built` issue leaving that state, a label change) and on a schedule, so a lost event does not stall the queue.

#### Scenario: Capacity frees up
- **WHEN** the assignee's `built` issue moves to `in-review` (set by `review` when the person starts the review)
- **THEN** the oldest eligible `queued` issue for that assignee starts

### Requirement: Documentation from the issue is built
When the issue has a `Documentation` section, `go` SHALL add a task for it to the change's `tasks.md`, and the developer agent SHALL write exactly the text the issue gives: glossary entries appended to `GLOSSARY.md` after the existing ones, and each decision record as a new file in `docs/adr/` numbered with the highest existing number plus one. The files SHALL arrive in the same pull request as the rest of the build. When the issue has no such section, no documentation task SHALL be added.

#### Scenario: Glossary entries
- **WHEN** the issue gives two glossary entries
- **THEN** the change has a task for them, and `GLOSSARY.md` ends with those two entries exactly as written and is otherwise unchanged

#### Scenario: A decision record
- **WHEN** the issue gives a decision record and `docs/adr/` already holds records up to `0003`
- **THEN** a file `0004-<short-title>.md` is created with the text of the issue

#### Scenario: No documentation section
- **WHEN** the issue has no `Documentation` section
- **THEN** the change has no documentation task and `GLOSSARY.md` and `docs/adr/` are not touched

### Requirement: QA checks that the documentation is what the issue gave
When the issue has a `Documentation` section, QA SHALL compare the lines added to `GLOSSARY.md` and `docs/adr/` with the text in the issue and SHALL reject when they differ or when any other line of those files changed. When the issue has no such section, QA SHALL reject a change that touches those files.

#### Scenario: The agent rewords an entry
- **WHEN** an added glossary entry differs from the issue's text
- **THEN** QA rejects it, citing the entry and the line of the issue

#### Scenario: Other lines of the glossary change
- **WHEN** an existing entry of `GLOSSARY.md` is edited or removed
- **THEN** QA rejects it

#### Scenario: Documentation nobody asked for
- **WHEN** the issue has no `Documentation` section and the diff touches `GLOSSARY.md` or `docs/adr/`
- **THEN** QA rejects it

### Requirement: The specification is complete before it is validated
After writing the last artifact, `go` SHALL confirm with OpenSpec that every artifact of the change is done. It SHALL NOT validate or build while one is missing.

#### Scenario: All artifacts done
- **WHEN** OpenSpec reports every artifact of the change as done
- **THEN** `go` validates the specification and continues

#### Scenario: An artifact is missing
- **WHEN** OpenSpec reports an artifact that is not done
- **THEN** `go` writes it and checks again; if it is still missing, the run ends in `qa-failed` with the reason "specification incomplete"

### Requirement: The developer starts from the OpenSpec apply instructions
Before the developer agent runs, `go` SHALL obtain the apply instructions of the change from OpenSpec and give the developer its context files and pending tasks. Whether tasks remain SHALL be read from OpenSpec's progress, not counted by hand.

#### Scenario: Pending tasks handed over
- **WHEN** the apply instructions list pending tasks
- **THEN** the developer receives those tasks and the files to read, and does not scan the change for them

#### Scenario: Tasks left after the build
- **WHEN** OpenSpec reports tasks remaining after the developer finished
- **THEN** the run ends in `qa-failed` with the reason "tasks left unfinished"

#### Scenario: Apply is blocked
- **WHEN** the apply instructions report that the change cannot be applied yet
- **THEN** the run ends in `qa-failed` with the reason "specification incomplete"

### Requirement: QA reviews the work in progress
The diff QA reviews SHALL be the difference between the working tree and the base branch, including the developer's new files and excluding generated files. `go` SHALL make new files visible without staging their content, and QA SHALL NOT change the index or any file.

#### Scenario: New file in the diff
- **WHEN** the developer created a file that is not tracked yet
- **THEN** the diff QA reviews contains it

#### Scenario: Generated files
- **WHEN** the work includes generated files such as `*.g.dart` or `*.freezed.dart`
- **THEN** they are not in the diff QA reviews

#### Scenario: Specification commit is not the build
- **WHEN** the specification was committed before the build
- **THEN** the diff QA reviews still shows the developer's uncommitted work against the base branch

### Requirement: QA retries look only at what changed
On a retry, QA SHALL audit the files in the developer's report and every finding of the previous report, and SHALL still run the static analysis and the full test suite.

#### Scenario: Retry scope
- **WHEN** QA runs again after the developer fixed the findings of the first run
- **THEN** QA checks each earlier finding first, reviews the diff of the reported files, and runs analysis and all tests

### Requirement: OpenSpec commands come from a closed list
`go`, `dev` and `qa` SHALL use only the OpenSpec commands on their own list. They SHALL NOT create files under `openspec/changes/` by hand. When an OpenSpec command fails they SHALL show its output and take the failure path, without trying other options.

#### Scenario: Command fails
- **WHEN** an OpenSpec command exits with an error during `go`
- **THEN** its output is shown and the run takes the failure path

#### Scenario: A skill or agent uses a command outside its list
- **WHEN** the text of `go`, `dev` or `qa` names an OpenSpec subcommand that is not on its list
- **THEN** the structure test of the plugin fails

### Requirement: Go checks its environment before changing anything
Before claiming work or creating a branch, `go` SHALL check that the configuration is valid, that OpenSpec runs and finds a root for the repository, and that the working tree is clean. When a check fails it SHALL stop with a clear message and change nothing.

#### Scenario: Invalid configuration
- **WHEN** `relevo.yml` does not validate
- **THEN** `go` shows the validation output and stops

#### Scenario: No OpenSpec root
- **WHEN** OpenSpec reports no root for the repository
- **THEN** `go` stops and tells the person to run `/relevo:doctor`

#### Scenario: Uncommitted changes
- **WHEN** the working tree has uncommitted changes
- **THEN** `go` stops and changes nothing

### Requirement: The agents are generic and the stack comes from the profile
`go` SHALL resolve the profile of the platform of the issue with the resolution command and give it to `relevo:dev` and `relevo:qa` together with the paths of the role skills. The agents SHALL NOT contain commands, file patterns or hygiene rules of one stack. The commands that verify the code and the generated files left out of the diff under review SHALL come from the profile.

#### Scenario: Flutter repository
- **WHEN** `go` builds an issue in a repository whose platform has stack `flutter`
- **THEN** the developer and QA receive the Flutter profile, QA runs its `analyze` and `test` commands, and the diff leaves out the profile's generated files

#### Scenario: Profile cannot be resolved
- **WHEN** the resolution command fails
- **THEN** `go` takes the failure path with the reason `profile not resolved` and builds nothing

### Requirement: The agents leave configuration alone
`relevo:dev` SHALL NOT edit `relevo.yml`, anything under `.relevo/` or `skills-lock.json`, and `relevo:qa` SHALL reject a diff that touches them, as it already does for `GLOSSARY.md` and `docs/adr/`.

#### Scenario: Developer edits the configuration
- **WHEN** the diff touches `relevo.yml`
- **THEN** QA rejects it citing the file, and the commit script would refuse it anyway

### Requirement: The gate resolves the platform of the issue
Before claiming an issue, the planner SHALL resolve its platform. When it cannot (a missing `Platform:` line with several platforms, an unknown name, two different lines) the issue SHALL go to `needs-spec` with the reason `missing`, the specification writer SHALL be assigned, and the comment SHALL say which of the three it is and list the platforms. When it can, the `start` decision SHALL carry `platform`, `stack`, `path` and `targets`.

#### Scenario: Platform resolved
- **WHEN** a ready issue says `Platform: web` and `web` has stack `vue` at `apps/web`
- **THEN** the decision is `start` and carries `platform` `web`, `stack` `vue`, `path` `apps/web`

#### Scenario: Several platforms and no line
- **WHEN** a ready issue has no `Platform:` line and the repository has two platforms
- **THEN** the decision is `needs-spec`, the comment names both platforms and says to add the line, and no run starts

#### Scenario: One platform and no line
- **WHEN** a ready issue has no `Platform:` line and the repository has one platform
- **THEN** the decision is `start` and carries that platform

### Requirement: An issue changes only its platform
A commit of an unattended run SHALL touch only files inside the folder of the platform of the issue, the change's own specification folder, `GLOSSARY.md` and `docs/adr/`. Any other path SHALL end the run in `qa-failed` with the reason "outside the platform", and nothing is pushed, unless the issue lists the path in an `Allow-paths:` line. A platform whose folder is `.` is not restricted.

#### Scenario: Front issue touches the back
- **WHEN** the diff of an issue for `web` (`apps/web`) touches `apps/api/app/User.php`
- **THEN** the commit is refused as outside the platform

#### Scenario: Shared package authorized
- **WHEN** the issue says `Allow-paths: packages/shared/**` and the diff touches `packages/shared/a.ts`
- **THEN** the commit is accepted

#### Scenario: Whole repository platform
- **WHEN** the platform folder is `.`
- **THEN** no path is refused for being outside it

### Requirement: Commands run from the folder of the platform
`go` SHALL resolve the profile and the role skills for the platform of the decision and tell `relevo:dev` and `relevo:qa` the folder of the platform, from which the commands of the profile are run.

#### Scenario: Monorepo
- **WHEN** `go` builds an issue for `api` at `apps/api`
- **THEN** the agents receive the profile of the stack of `api` and the folder `apps/api`

### Requirement: The workflow output names the platform
`go-plan.mjs` SHALL write `platform`, `stack` and `path` to the workflow output next to the action, so that the build job installs only the toolchain of that stack.

#### Scenario: Output for a start
- **WHEN** the decision is `start` for a Vue platform
- **THEN** the output has `stack=vue`, and a setup step guarded by that value runs while the Flutter one does not

### Requirement: The gate resolves external dependencies against the linked repositories
Before gate 2, the planner SHALL check every external reference against `links`. A reference outside the list SHALL send the issue to `needs-spec` with the reason `missing`, and the comment SHALL name the repository and list the linked ones.

#### Scenario: Not linked
- **WHEN** the ready issue says `Depends-on: other/repo#4` and `other/repo` is not in `links`
- **THEN** the decision is `needs-spec`, nothing is read from `other/repo`, and no run starts

### Requirement: Without a credential the gate does not claim the issue
When the workflow tells the gate that no model credential exists, a `start` decision SHALL NOT claim the issue, SHALL NOT move its label and SHALL produce the local-run comment instead; every other decision SHALL be applied as usual.

#### Scenario: Start without credential
- **WHEN** the gates pass and no credential exists
- **THEN** the output action is `local`, the issue keeps `relevo:ready`, and the comment names `/relevo:go <n>`

#### Scenario: Other decisions
- **WHEN** the issue is blocked, needs a spec or is queued and no credential exists
- **THEN** the decision is applied as without the flag

### Requirement: The limits of a run are written once
The turn and cost limits and the closed lists of allowed and disallowed tools SHALL be produced by one function from `relevo.yml`, used by the local run, and the workflow template SHALL carry the same values, which a test compares.

#### Scenario: Template and local run agree
- **WHEN** the tool lists or the limits of the template and the shared function differ
- **THEN** a test fails

### Requirement: Sections of the issue are copied word for word
`go` SHALL copy the sections `Decisions`, `Constraints`, `Code pointers`, `Screens and behaviour`, `Data contract`, `Verification` and `Assumptions` of the issue into `design.md`, each under the heading `From the issue: <Section>`, using a script that copies the text unchanged. The `Documentation` section keeps its own task and heading.

#### Scenario: Decisions in the issue
- **WHEN** the issue has a `Decisions` section
- **THEN** `design.md` has "From the issue: Decisions" with that text unchanged

#### Scenario: Section absent
- **WHEN** the issue has no `Constraints` section
- **THEN** `design.md` has no such heading

### Requirement: An issue with open questions is sent back as ambiguous
When the issue has an `Open questions` section with content or the text `NEEDS CLARIFICATION`, `go` SHALL NOT build it: it SHALL move it to `needs-spec` with the reason `ambiguous`, naming the question.

#### Scenario: Question left in the issue
- **WHEN** a `ready` issue has a question under `Open questions`
- **THEN** it becomes `needs-spec` with the reason `ambiguous` and nothing is built

### Requirement: QA applies what the issue decided
QA SHALL reject a change that breaks a decision or a constraint copied from the issue, citing its id, and SHALL reject when the sections in `design.md` differ from the ones in the issue.

#### Scenario: Decision broken
- **WHEN** the issue decided `D2` (sort by date) and the diff sorts by name
- **THEN** QA rejects it citing `D2`

#### Scenario: Section reworded
- **WHEN** a copied section in `design.md` differs from the issue
- **THEN** QA rejects it citing the section

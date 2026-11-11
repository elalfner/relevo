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
`go` SHALL NOT start an issue for an assignee who already has `limits.built_unreviewed_per_person` issues in `built`, unless the issue carries a valid `urgent` label. A valid `urgent` label SHALL skip this gate only: every other gate and the limit `limits.concurrent_agents` still apply to the issue.

#### Scenario: Assignee at capacity
- **WHEN** the assignee has 2 issues in `built` and the limit is 2
- **THEN** the issue is labelled `queued`, one comment says the assignee is at the limit (without mentioning anyone), and it starts when the assignee's count drops below the limit

#### Scenario: Urgent issue for an assignee at capacity
- **WHEN** the assignee has 2 issues in `built`, the limit is 2, the issue carries a valid `urgent` label and an agent slot is free
- **THEN** the issue starts, and the assignee then has 3 issues in `built` once it finishes

#### Scenario: Urgent issue is still blocked by a dependency
- **WHEN** the issue carries a valid `urgent` label and a `Depends-on` issue is not merged
- **THEN** the issue is labelled `blocked`, and the notice says that `urgent` does not skip dependencies

#### Scenario: Urgent issue with an incomplete spec
- **WHEN** the issue carries a valid `urgent` label and its spec is incomplete
- **THEN** the issue is labelled `needs-spec` as for any other issue

#### Scenario: Urgent issue and no free agent slot
- **WHEN** the issue carries a valid `urgent` label and `limits.concurrent_agents` agents are already running
- **THEN** the issue is labelled `queued`, one comment says it waits for a free agent slot, and it is the first to start when a slot frees up

### Requirement: Queue order
Eligible issues SHALL be started in first-in-first-out order of the time `ready` was applied, except that issues with a valid `urgent` label SHALL be considered before all the others, and in first-in-first-out order among themselves. An ineligible issue SHALL be skipped without blocking the others and SHALL keep its position.

#### Scenario: Head of line is blocked
- **WHEN** the oldest issue is `blocked` and a newer issue is eligible
- **THEN** the newer issue starts, and the older one starts first once it becomes eligible

#### Scenario: Urgent issue jumps the line
- **WHEN** one agent slot is free, an older `queued` issue has no `urgent` label and a newer issue has a valid one
- **THEN** the newer issue takes the slot and the older one stays `queued`

#### Scenario: Several urgent issues
- **WHEN** two issues carry a valid `urgent` label and only one agent slot is free
- **THEN** the one whose `ready` label is older starts

#### Scenario: Urgent label added to a queued issue
- **WHEN** a person with the required permission applies `urgent` to a `queued` issue
- **THEN** the queue is evaluated at once, without waiting for the next scheduled run

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
QA SHALL compare the diff against the issue's scenarios and the project rules in `qa.rules_from` through its lenses, after the validation gate has run the platform's static analysis and tests once, and return `QA PASSED` or `QA REJECTED` with file, line and reason. On rejection, by the gate or by a lens, the developer agent SHALL get exactly `qa.retries` attempts to fix, then QA SHALL run again.

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
- **WHEN** the gate cannot run static analysis or tests because the tooling is not available
- **THEN** the run ends with the reason "automated validation could not run" and no lens passes code whose checks did not run

#### Scenario: Device-only scenario
- **WHEN** a scenario can only be observed on a device or in another app
- **THEN** QA does not reject it for lacking a test, checks that the code plausibly produces it, and lists it as left for on-device review

#### Scenario: Verdict line
- **WHEN** a lens or the aggregation finishes
- **THEN** the first line of its output is exactly `QA PASSED` or `QA REJECTED`

#### Scenario: A red gate
- **WHEN** the gate reports that the tests fail
- **THEN** no lens runs, the developer agent receives the output of the gate and one of its attempts is used

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

### Requirement: A reviewed false positive of the credential scan can be listed with a reason
A person SHALL be able to list a credential finding as reviewed in `.relevo/scan-exceptions.json`, a list of entries each with a `path`, a `pattern` and a `reason`. The scan of a diff (the safe commit and the validation gate) SHALL NOT report a credential finding whose file matches the `path` and whose added line contains the `pattern`; the match SHALL NOT depend on the line number. Every other finding SHALL be reported and refused as before. Temporary markers SHALL NOT be excepted. The list SHALL be read from the committed file (HEAD for a commit, the base ref for the gate), never from the working tree, and `.relevo/` is a protected path, so an unattended run cannot change it.

#### Scenario: A listed line goes through
- **WHEN** the staged diff holds a credential finding on a line that an entry lists by path and pattern, with a reason
- **THEN** the commit is made and the report says one exception was applied, with its path and reason

#### Scenario: The line moved
- **WHEN** the listed line is at another line number of the same file
- **THEN** the exception still applies

#### Scenario: A finding that is not listed
- **WHEN** the scan flags a line no entry covers, or a listed path with another line
- **THEN** the commit is refused and nothing is pushed, as before

#### Scenario: Too broad an entry
- **WHEN** an entry names a folder, uses `**` or a bare `*` file name, has a pattern of fewer than 8 characters, or has no reason
- **THEN** it is never applied and the report names it as refused

#### Scenario: An edit that is not committed
- **WHEN** the working tree holds an exception that the committed file does not
- **THEN** it is not applied

#### Scenario: A marker
- **WHEN** a temporary marker is flagged on a listed line
- **THEN** it is still refused

#### Scenario: The gate
- **WHEN** the validation gate scans a diff with a listed finding
- **THEN** the scan passes and its detail says the exception was applied

### Requirement: Unrecoverable problems end in qa-failed
Any problem `go` cannot recover from SHALL end in the `qa-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential, a temporary marker, a protected path in the diff or an issue that changed after `ready`, or when the branch already exists, which `go` never touches. When the reason is that QA rejected the work after the retries or that tasks were left unfinished, `go` SHALL first commit the work in progress, through the same safe commit as a successful build and with a message that says it is not approved, so that the push keeps it; if that commit is refused, `go` SHALL push nothing. It SHALL NOT open a pull request or advance the state.

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

#### Scenario: QA rejects after the retries
- **WHEN** QA still rejects the work after the retries and the safe commit accepts it
- **THEN** the branch is pushed with a commit `wip: rejected by QA (#<n>)` that holds the work, the issue is `qa-failed`, no pull request is opened, and the comment says the branch holds work that QA did not approve

#### Scenario: QA could not run the checks
- **WHEN** QA rejected only because the analysis and the tests could not run
- **THEN** the work is kept in the same way and the comment says what QA could not check

#### Scenario: Tasks left unfinished
- **WHEN** the developer finished with tasks still open
- **THEN** the work done is committed and pushed as work in progress, and the comment says how many tasks are done

#### Scenario: The safe commit refuses the work
- **WHEN** the work in progress contains a protected path, a file outside the platform, a temporary marker or a possible credential
- **THEN** nothing is committed or pushed, and the comment says the branch was not pushed and why

### Requirement: Successful hand-off
On `QA PASSED`, `go` SHALL push the branch, label the issue `built`, and post the hand-off message to the assignee. When the issue was started by skipping the capacity gate because of a valid `urgent` label, the message SHALL say so and SHALL state how many issues the assignee has in `built`.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the issue is `built`, the branch is pushed and the assignee is mentioned once

#### Scenario: Built after an urgent start
- **WHEN** QA passes for an issue that started over the assignee's capacity because of `urgent`
- **THEN** the message tells the assignee that the issue skipped the queue and how many issues are now waiting for their review

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

### Requirement: A finished build starts the queue
When a cloud build run ends, whatever its outcome, the `go` workflow SHALL start a queue evaluation (`relevo-queue`) after the labels of the outcome are set, because labels changed with the workflow token start no workflow by themselves. It SHALL also do so when the light job fails after claiming the issue.

#### Scenario: A build ends with `built`
- **WHEN** a build finishes and the issue is `built` while other issues are `queued`
- **THEN** the queue is evaluated right away and the oldest eligible `queued` issue starts, without waiting for the schedule

#### Scenario: A build fails or is cut
- **WHEN** a build ends as `qa-failed`, `needs-spec`, cancelled or timed out
- **THEN** the queue is evaluated right away

#### Scenario: The light job fails after the claim
- **WHEN** the gates claim the issue as `building` and the light job then fails, leaving it `qa-failed`
- **THEN** the queue is evaluated right away

#### Scenario: No build ran
- **WHEN** the decision is `needs-spec`, `blocked`, `queued`, `denied`, no milestone or no assignee, and the light job succeeds
- **THEN** no queue evaluation is started, because no slot was freed

#### Scenario: The queue workflow is missing
- **WHEN** the repository has no `relevo-queue` workflow
- **THEN** the start fails without failing the run or changing any label

### Requirement: Starting the queue does not widen the agent's token
The permission to start workflows SHALL be held only by a job that runs no agent and no project code. The job that runs the agent SHALL NOT have it.

#### Scenario: Permissions of the jobs
- **WHEN** the workflow template is read
- **THEN** only the job that starts the queue has `actions: write`, and the `decide` and `build` jobs do not

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
On a retry, each lens SHALL audit the files in the developer's report and every finding of its own previous report, and the gate SHALL still run the static analysis and the full test suite.

#### Scenario: Retry scope
- **WHEN** QA runs again after the developer fixed the findings of the first run
- **THEN** the gate runs analysis and all tests again, and each lens checks each earlier finding of its own first, then reviews the diff of the reported files

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
`go` SHALL resolve the profile of the platform of the issue with the resolution command and give it to `relevo:dev` and to each lens agent, each lens with the sections it reads, together with the paths of the role skills. The agents SHALL NOT contain commands, file patterns or hygiene rules of one stack. The commands that verify the code and the generated files left out of the diff under review SHALL come from the profile.

#### Scenario: Flutter repository
- **WHEN** `go` builds an issue in a repository whose platform has stack `flutter`
- **THEN** the developer and the lenses receive the Flutter profile, the gate runs its `analyze` and `test` commands, and the diff leaves out the profile's generated files

#### Scenario: Profile cannot be resolved
- **WHEN** the resolution command fails
- **THEN** `go` takes the failure path with the reason `profile not resolved` and builds nothing

### Requirement: The agents leave configuration alone
`relevo:dev` SHALL NOT edit `relevo.yml`, anything under `.relevo/` or `skills-lock.json`, and the `spec` lens SHALL reject a diff that touches them, as it already does for `GLOSSARY.md` and `docs/adr/`.

#### Scenario: Developer edits the configuration
- **WHEN** the diff touches `relevo.yml`
- **THEN** the `spec` lens rejects it citing the file, and the commit script would refuse it anyway

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
`go` SHALL resolve the profile and the role skills for the platform of the decision and tell `relevo:dev` and the lenses the folder of the platform, and run the commands of the profile from it in the gate.

#### Scenario: Monorepo
- **WHEN** `go` builds an issue for `api` at `apps/api`
- **THEN** the agents receive the profile of the stack of `api` and the folder `apps/api`

### Requirement: The workflow output names the platform
`go-plan.mjs` SHALL write `platform`, `stack` and `path` to the workflow output next to the action, so that the build job installs only the toolchain of that stack.

#### Scenario: Output for a start
- **WHEN** the decision is `start` for a Vue platform
- **THEN** the output has `stack=vue`, and a setup step guarded by that value runs while the Flutter one does not

### Requirement: The go workflow template installs the Supabase CLI
The `go` workflow template SHALL include a build-job step, guarded by the stack `supabase`, that installs the Supabase CLI. The step SHALL be active, not a comment, and SHALL be skipped for any other stack. Docker is not installed by the template: the hosted runner already has it.

#### Scenario: Issue for a Supabase platform
- **WHEN** the decision is `start` for a platform with stack `supabase`
- **THEN** the build job installs the Supabase CLI before the toolchain check, and the check does not report `supabase` as missing

#### Scenario: Issue for another platform
- **WHEN** the decision is `start` for a platform with stack `flutter`
- **THEN** the Supabase step is skipped and costs nothing

#### Scenario: Repository with a Flutter and a Supabase platform
- **WHEN** one issue says `Platform: app` (Flutter) and another says `Platform: backend` (Supabase)
- **THEN** each build installs only the toolchain of the stack of its own platform

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

### Requirement: The references of the issue reach the builder
`go` SHALL run a fetcher that reads the references from the issue itself, downloads the attachments and the files of linked repositories into a local folder that git ignores, and gives the builder the list. The references are the bullets of `Design reference` and the bullets of `Code pointers` that name a file of a linked repository. It SHALL copy the sections into `design.md` and add one scenario per design reference, "Matches the reference <name>", so the review checklist has a line for it. A linked code pointer SHALL get no scenario.

#### Scenario: Reference in the repository
- **WHEN** the issue has a reference to a file of the repository
- **THEN** `design.md` has the section and the specification has a scenario for it

#### Scenario: Attachment
- **WHEN** the issue has a pasted attachment and `design.images` is on
- **THEN** the image is downloaded to the local folder and the builder reads it from there

#### Scenario: Image of a linked repository
- **WHEN** the issue has a design reference `acme/design:screens/home.webp`, `acme/design` is in `links`, and the file is a WebP image under 5 MB
- **THEN** the image is downloaded to the local folder whether `design.images` is on or off, the builder reads it from there, and the specification has a scenario for it

#### Scenario: Linked code pointer
- **WHEN** the issue lists `acme/api:src/billing/charge.ts` under `Code pointers` and `acme/api` is in `links`
- **THEN** the file is downloaded to the local folder, the builder reads it from there, and the specification has no "Matches the reference" scenario for it

### Requirement: A reference that cannot be fetched is a defect in the specification
When a reference cannot be fetched (not found, not allowed, over the limits, or `design.images` off for an attachment), `go` SHALL NOT build: the issue goes to `needs-spec`, naming the reference and the reason. The reason SHALL reach the issue exactly as the fetcher wrote it, without being reworded or translated.

#### Scenario: Images turned off
- **WHEN** the issue has an attachment and `design.images` is off
- **THEN** the issue goes to `needs-spec` saying that the attachment needs `design.images` or a file in the repository

#### Scenario: Reason word for word
- **WHEN** the fetcher refuses `acme/design:home.webp` with a reason that names the secret `RELEVO_LINKS_TOKEN`
- **THEN** the `needs-spec` comment carries that same reason, in English, naming the secret

### Requirement: The fetcher stays inside fixed limits
The fetcher SHALL take its references only from the issue, download only from the GitHub attachment domains and the linked repositories, follow redirects only to those domains, send the token only to GitHub, accept only PNG, JPEG, GIF and WebP images up to 5 MB and text files up to 200 KB from either source, recognize an image by its bytes and never by its name, and stop at five files across both sections.

#### Scenario: Address outside the domains
- **WHEN** a link points to another domain
- **THEN** nothing is downloaded and the reference is reported as refused

#### Scenario: Redirect to another host
- **WHEN** an attachment redirects to a host that is not on the list
- **THEN** the download stops and the reference is reported as refused

#### Scenario: Too large
- **WHEN** an image is larger than the limit
- **THEN** it is not kept and the reference is reported

#### Scenario: Linked file over the limit
- **WHEN** a linked file is larger than 5 MB
- **THEN** it is refused without its contents being downloaded

#### Scenario: Linked binary that is not an image
- **WHEN** a linked file is neither a recognized image nor UTF-8 text
- **THEN** it is refused, whatever its extension says

### Requirement: The builder reproduces the reference without inventing
`dev` SHALL read the images, reuse the theme tokens and components of the project, invent no asset, and report what it could not match. `qa` SHALL compare the code with example code, and check that the code plausibly respects an image, citing the reference.

#### Scenario: Asset not available
- **WHEN** the design needs an icon the project does not have
- **THEN** `dev` reports it instead of inventing one

### Requirement: The build checks the toolchain before the agent starts
The build job of the go workflow SHALL check, before the agent step, that every tool listed by the profile of the platform of the issue is on the path of the runner, and when one is missing SHALL stop without running the agent, move the issue to `qa-failed` and post one comment that names the missing tools, says that nothing was built and what to do. It SHALL check nothing for a stack whose profile lists no tools, and SHALL run the check from a copy of the package outside the workspace.

#### Scenario: A runner without the Flutter SDK
- **WHEN** the platform is Flutter and `flutter` is not on the path of the runner
- **THEN** the agent does not run, the issue is `qa-failed`, and the comment says `flutter` is missing, that no model turns were spent and that the toolchain step of `relevo-go.yml` must be enabled

#### Scenario: A complete toolchain
- **WHEN** every tool of the profile answers `--version`
- **THEN** the check passes silently and the agent runs

#### Scenario: A stack with no tools listed
- **WHEN** the profile lists no tools
- **THEN** nothing is checked and the agent runs

#### Scenario: A clean working tree
- **WHEN** the check runs
- **THEN** it leaves nothing inside the workspace, so the agent's own preflight still finds a clean tree

### Requirement: Without OpenSpec go does not continue from memory
When the environment check finds that the OpenSpec command line does not run, `go` SHALL stop, show the command that installs it, and say that the change files must not be written by hand. It SHALL NOT create anything under `openspec/changes/`, and SHALL NOT go on by reading the code and recalling the format.

#### Scenario: OpenSpec is missing
- **WHEN** `go` runs and `openspec` does not run
- **THEN** it stops before claiming work or creating a branch
- **AND** the message gives the install command and says that nothing is written under `openspec/changes/` by hand

#### Scenario: The agent is tempted to continue
- **WHEN** the check has failed for OpenSpec
- **THEN** the text of the skill forbids going on, and the structure test of the plugin fails if it does not

### Requirement: A build leaves nothing behind on the runner
A Relevo workflow SHALL NOT assume that its runner is a new machine. It SHALL install the tools it needs in the temporary folder of the job at a pinned version, not globally and not in the home folder of the runner's user, and SHALL end each job with a step that always runs and removes from the workspace what the job added. On a GitHub-hosted runner this SHALL change nothing a person can observe.

#### Scenario: OpenSpec is installed per job
- **WHEN** a build job needs OpenSpec
- **THEN** it installs the pinned version under the temporary folder of the job and puts it on the path of that job only

#### Scenario: A failed job still cleans up
- **WHEN** the agent step fails or the job is cancelled
- **THEN** the final step still removes the files the job added to the workspace

#### Scenario: Two jobs on the same machine
- **WHEN** two Relevo jobs run one after the other on the same self-hosted runner
- **THEN** the second finds no tool, setting or credential file that the first one wrote outside the workspace and the temporary folder

### Requirement: The workflows name the tools they assume
A Relevo workflow SHALL list the tools it needs on the runner beyond what it installs (`git`, `gh`, `jq` and Node), and the toolchain check of the build job SHALL fail before the agent starts, without a model turn, when one is not on the path of the runner.

#### Scenario: A runner without jq
- **WHEN** the runner has no `jq` on its path
- **THEN** the build job stops before the agent, the issue becomes `relevo:qa-failed` and the comment names `jq` and says nothing was built

### Requirement: The agent's settings do not outlive the job
When the agent is configured through a user-level settings file written by the workflow, that file SHALL be written under the temporary folder of the job, or removed by the final step, so that a later job on the same runner does not run with it.

#### Scenario: Antigravity settings
- **WHEN** the Antigravity build step writes its settings file
- **THEN** the file is gone once the job ends, whether it succeeded or not

### Requirement: The urgent label requires the permission of ready
The `urgent` label SHALL be valid only when the person who last applied it has the permission that `ready` requires: write or maintain access, and maintain access only when `trust` is `public`. When the label is not valid, `go` SHALL remove it, post one comment that says why and names who applied it, and evaluate the issue as a normal one.

#### Scenario: Applied by someone with write access
- **WHEN** a collaborator with write access applies `urgent` and `trust` is `private-team`
- **THEN** the label is valid

#### Scenario: Applied without permission
- **WHEN** a user without write access applies `urgent` to a `queued` issue
- **THEN** the label is removed, one comment says that `urgent` needs the permission of `ready`, and the issue stays `queued` in its normal position

#### Scenario: Public repository
- **WHEN** `trust` is `public` and a collaborator with write but not maintain access applies `urgent`
- **THEN** the label is removed and the comment says that only a maintainer may apply it

#### Scenario: Applied by a bot
- **WHEN** an application or bot applies `urgent`
- **THEN** the label is not valid and is removed, as for a person without permission

### Requirement: A cloud build shows its progress in one comment
While a cloud build runs, `go` SHALL keep one progress comment on the issue, found by a hidden marker and edited in place. It SHALL NOT add a comment for each step or each check. The comment SHALL show the state now and SHALL NOT accumulate history: the phase of the build, the tasks done out of the total and how long the run has lasted, in whole minutes.

#### Scenario: First report
- **WHEN** the build job starts the agent
- **THEN** one progress comment with the marker is created on the issue

#### Scenario: A step finishes
- **WHEN** the number of tasks done or the phase changes
- **THEN** the existing progress comment is edited and no new comment is posted

#### Scenario: Marker already present
- **WHEN** a progress comment with the marker already exists for the issue
- **THEN** it is edited and no second one is created

### Requirement: The phase of the build is announced and checked
At the start of each step of a build, `go` SHALL announce the phase it enters: planning, specification, development, QA, the new attempt of development or QA with its number out of the allowed retries, and delivery. The announcement SHALL be kept outside the working tree of the repository so that it never appears in the diff of the change. When no announcement has been made, the phase SHALL be deduced from what exists in the working tree, and the progress comment SHALL still be kept.

#### Scenario: QA starts
- **WHEN** the agent starts the validation gate for the first time
- **THEN** the progress comment shows the QA phase

#### Scenario: Retry after a rejection
- **WHEN** QA rejects the work and development starts again
- **THEN** the progress comment shows development with its attempt number out of the allowed retries

#### Scenario: No announcement
- **WHEN** the agent has announced no phase
- **THEN** the progress comment shows the phase deduced from the working tree, and the elapsed time keeps growing

#### Scenario: The announcement stays out of the diff
- **WHEN** the phase has been announced and the work is committed
- **THEN** the announcement is not among the files of the commit and the working tree has no file added for it

### Requirement: The workflow signals that the run is alive
Every 30 seconds the workflow SHALL read the announced phase and the tasks done, without depending on the agent, and SHALL edit the progress comment only when the text it would show differs from the text it shows. A run that stops advancing SHALL be recognisable because its elapsed time grows while its tasks and phase do not.

#### Scenario: The agent is silent
- **WHEN** the agent announces nothing and completes no task for several minutes
- **THEN** the elapsed time keeps growing in the progress comment while the tasks and the phase stay as they were

#### Scenario: Nothing changed
- **WHEN** a check finds the same phase, the same tasks and the same minute as the comment already shows
- **THEN** no write is made

#### Scenario: The check stops with the job
- **WHEN** the build job ends, whatever its outcome
- **THEN** no further check is made

### Requirement: The progress comment is closed when the run ends
When the run ends, whether it succeeded, failed or was stopped, the progress comment SHALL be replaced by a single line that points to the result, and no progress detail SHALL remain on the issue.

#### Scenario: Run ends with a result
- **WHEN** the build finishes and the result comment is posted
- **THEN** the progress comment is edited to one line that points to the result

#### Scenario: Run ends without an outcome
- **WHEN** the job ends and the issue is still `building`
- **THEN** the progress comment is closed with a line that says the run ended without an outcome, next to the existing failure report

### Requirement: A closed progress comment is not edited again
Once the progress comment has been closed, no check of the run SHALL edit it, so that a late check cannot replace the closing line with a progress text. The comment SHALL say that it is closed in a way the checks can read before they write.

#### Scenario: A check runs after the closing
- **WHEN** a check finds that the progress comment is closed
- **THEN** it makes no write and the closing line stays as it was

#### Scenario: Closing while a check is running
- **WHEN** the run ends while a check is about to write
- **THEN** the progress comment ends closed, whichever of the two writes came last

### Requirement: Reporting progress never fails the run
Announcing the phase, checking the progress and editing the progress comment SHALL NOT fail the job and SHALL NOT change the outcome of the run. When the progress cannot be read or written, the run SHALL continue and nothing SHALL be reported as failed because of it.

#### Scenario: GitHub refuses the edit
- **WHEN** an edit of the progress comment fails
- **THEN** the build continues and its result is unchanged

#### Scenario: The announcement cannot be written
- **WHEN** the agent cannot write the announcement of a phase
- **THEN** the build continues and the phase is deduced from the working tree

### Requirement: The cloud fetches the references before the agent
In the cloud, a step of the build SHALL run the fetcher before the agent starts, and only that step SHALL have the token for linked repositories. The agent SHALL use what that step fetched and SHALL NOT fetch again. A local run SHALL run the fetcher itself, with the person's own access.

#### Scenario: Private linked repository in the cloud
- **WHEN** `acme/design` is private and in `links`, the secret `RELEVO_LINKS_TOKEN` can read its contents, and the issue has a design reference `acme/design:screens/home.webp`
- **THEN** the reference is fetched, the check passes, the file is not copied into the repository, and the agent's environment never holds the token

#### Scenario: Refused reference in the cloud
- **WHEN** the fetch step refuses a reference
- **THEN** the step itself does not fail, and the agent takes the `needs-spec` path with the refused reference and its reason

#### Scenario: Local run
- **WHEN** `/relevo:go` runs on the person's machine
- **THEN** the fetcher runs with the person's `gh` login and no token for linked repositories is needed

### Requirement: The reason for an unreadable linked file names what to fix
When GitHub answers 404 or 403 for a file of a linked repository, the reason SHALL depend on how it was read: with the token, that the secret `RELEVO_LINKS_TOKEN` cannot read that repository and needs read access to its contents; in the cloud without it, that a private repository needs that secret with read access to its contents; locally, that the person's `gh` login cannot read it. Every reason SHALL name the repository and GitHub's status code.

#### Scenario: Token without access
- **WHEN** the secret is set, and GitHub answers 404 for `acme/design:home.webp`
- **THEN** the reason says that `RELEVO_LINKS_TOKEN` cannot read `acme/design`, gives the 404, and says to give it read access to the contents

#### Scenario: No token in the cloud
- **WHEN** the secret is empty, and GitHub answers 404 for `acme/design:home.webp`
- **THEN** the reason says that `acme/design` could not be read without a token and to store one with read access to its contents as `RELEVO_LINKS_TOKEN`

#### Scenario: Local run without access
- **WHEN** a local run gets 404 for `acme/design:home.webp`
- **THEN** the reason says that the person's `gh` login cannot read `acme/design`

### Requirement: The failure comment does not offer fix when nothing was pushed
When `go` ends in `qa-failed` with the branch not pushed (`unsafe` or `not_pushed`) and gives no explicit recovery, the comment SHALL show the next step of the `rebuild` variant and SHALL NOT suggest `/relevo:fix <n>`. A comment for a pushed branch, for kept work and for an existing branch SHALL keep its current next step.

#### Scenario: Commit refused by the scanner
- **WHEN** QA rejected the build, the safe commit of the work in progress was refused because of a possible credential, and `branch_state` is `unsafe`
- **THEN** the comment says the branch was not pushed, ends with the rebuild step, and does not contain `/relevo:fix`

#### Scenario: Not pushed for another reason
- **WHEN** the issue changed after `ready` and `branch_state` is `not_pushed`
- **THEN** the comment ends with the rebuild step and does not contain `/relevo:fix`

#### Scenario: Pushed branch unchanged
- **WHEN** `branch_state` is `pushed`
- **THEN** the next step is still `/relevo:fix <n>`

### Requirement: A qa-failed issue without a branch can be retried
When the planner is asked to retry an issue (`--retry`, together with `--only <n>`), it SHALL treat that issue, when it is `qa-failed`, as if it were `ready`: the same gates apply and the claim SHALL move it from `qa-failed` to `building`. It SHALL NOT add or require the `ready` label, and the claim SHALL post no comment of its own. In place of the person who applied `ready` it SHALL use the person who runs the retry: only write access, or a maintainer when `trust` is `public`, may retry.

#### Scenario: Retry of a qa-failed issue without a branch
- **WHEN** issue 67 is `qa-failed`, has no remote branch, and a person with write access runs the planner with `--only 67 --retry --apply --claim`
- **THEN** the decision is `start`, the issue loses `qa-failed` and gains `building`, no `ready` label is added and no comment is posted

#### Scenario: The person may not start work
- **WHEN** the person who runs the retry has only read access, or `trust` is `public` and the person is not a maintainer
- **THEN** the decision is `denied` and nothing is claimed

#### Scenario: Gates still apply
- **WHEN** the retried issue has no assignee, no milestone or an incomplete specification
- **THEN** the same decision as for a `ready` issue is returned, and nothing is built

#### Scenario: Without the flag
- **WHEN** the planner runs without `--retry`
- **THEN** a `qa-failed` issue is still ignored

### Requirement: A retry is refused when there is something to fix instead
The planner SHALL refuse a retry, changing nothing, when the issue is not `qa-failed` or when a branch `feature/<n>-*` exists on the remote. The message SHALL send the person to `/relevo:fix <n>` or to delete the branch.

#### Scenario: A branch exists
- **WHEN** `origin/feature/67-...` exists and the retry is requested
- **THEN** nothing changes and the message says to run `/relevo:fix 67` or to delete the branch

#### Scenario: The issue is not qa-failed
- **WHEN** the retry is requested for an issue that is `built`
- **THEN** nothing changes and the message says that only a `qa-failed` issue can be retried

### Requirement: A literal assigned to a secret name is a possible credential
When the scan of a diff, an issue body or a configuration value finds a name such as `api_key`, `secret`, `token`, `password` or `passwd` assigned with `:` or `=`, it SHALL report a possible credential when the value is quoted and has 16 or more characters, or when the value is unquoted and looks like a literal secret: it mixes letters and digits, or contains `/`, `+` or `=`, and it is not followed by `(`, `.` or `[`.

#### Scenario: Quoted literal
- **WHEN** an added line is `api_key = "abcdefghijklmnopqrstuvwx"`
- **THEN** the scan reports a possible credential of the kind `assigned-secret`

#### Scenario: Unquoted literal with the look of a secret
- **WHEN** an added line is `password: hunter2hunter2hunter2`
- **THEN** the scan reports a possible credential of the kind `assigned-secret`

### Requirement: Code that only names a secret is not a possible credential
The scan SHALL NOT report an unquoted value that is a plain identifier, a call or a member access. The provider patterns and the opaque-token check of configuration values SHALL NOT change, and a finding SHALL name the kind and the place, never the value.

#### Scenario: Reference to a variable
- **WHEN** an added line is `token: someLongVariableName`
- **THEN** the scan reports nothing

#### Scenario: Call
- **WHEN** an added line is `password = readPasswordFromVault(options)`
- **THEN** the scan reports nothing

#### Scenario: Member access
- **WHEN** an added line is `secret = config.clientSecretValue`
- **THEN** the scan reports nothing

#### Scenario: Provider key
- **WHEN** an added line contains `ghp_` followed by 36 letters and digits, even assigned to a variable with another name
- **THEN** the scan reports the provider kind, as before

### Requirement: No agent starts after a limit of the run
After each agent that `go` launches finishes, `go` SHALL record its tool calls and time, read from the usage block that ends its report. Before launching another agent, `go` SHALL ask the budget guard, and SHALL NOT launch it when the turns of the subagents together reached `limits.run_max_turns` or the time of the run reached `limits.run_max_minutes`. It SHALL take the failure path with the reason `run limit reached`, naming the agents that did not run.

#### Scenario: The turns of the subagents reach the limit between two lenses
- **WHEN** the developer and two QA lenses finished and their turns together reach `limits.run_max_turns`
- **THEN** `go` launches no further lens, takes the failure path with the reason `run limit reached`, and the comment names the lenses that did not run

#### Scenario: The time of the run reaches its limit before a retry
- **WHEN** QA rejected the work and `limits.run_max_minutes` have passed since the run entered `planning`
- **THEN** the developer is not launched again and the failure path is taken with the reason `run limit reached`

#### Scenario: The run is within its limits
- **WHEN** the turns of the subagents and the minutes of the run are below their limits
- **THEN** the next agent is launched as before

### Requirement: The budget guard stops a run only on what it can read
The guard SHALL record only whole numbers, and SHALL say that it does not know, and let the run go on, when it cannot read its inputs. An error of the guard SHALL NOT fail or stop a run.

#### Scenario: The guard cannot read its inputs
- **WHEN** the ledger or the phase log is missing or unreadable, or the run has no progress directory
- **THEN** the guard says that it does not know, exits as within limits and no agent is stopped

#### Scenario: Only numbers are recorded
- **WHEN** the figures passed to the guard are not whole numbers
- **THEN** nothing is recorded and the run goes on

### Requirement: The work is kept when go stops at a limit
When `go` stops because of a limit, it SHALL commit the work in progress with the subject `wip: stopped by limit (#N)` through the same script and with the same refusals as any commit, and push it to the branch of the issue without opening a pull request. The comment SHALL say whether the work was kept.

#### Scenario: `go` stops at a limit
- **WHEN** the budget guard says a limit was reached and the developer's work is in the working tree
- **THEN** the work is committed as `wip: stopped by limit (#N)`, pushed to the branch of the issue, the issue goes to `qa-failed` with the reason `run limit reached`, and the comment says the work was kept

#### Scenario: `fix` continues from the kept work
- **WHEN** the last commit of the branch is `wip: stopped by limit (#N)`
- **THEN** `fix` treats it as work in progress, the same as the work that QA rejected

### Requirement: The work is kept when the runner cuts the run
When the agent step is cut by the runner or the job is cancelled or times out, and the issue is still `building` or `ready`, a step that always runs SHALL commit and push the working tree the same way, before the report of the run and before the cleanup. It SHALL NOT push when a commit is refused, SHALL NOT force-push and SHALL NOT overwrite a remote branch: it pushes only a fast-forward of what the remote has.

#### Scenario: The job is cut and the run recorded no outcome
- **WHEN** the agent step is cancelled or ends without an outcome and the working tree holds changes
- **THEN** the changes are committed and pushed to the branch of the issue, and the comment says the work was kept and that `/relevo:fix` continues from it

#### Scenario: The scans refuse the rescue commit
- **WHEN** the changes include a protected path, a restricted file, a temporary marker or a possible credential
- **THEN** nothing is pushed and the comment names the file and why

#### Scenario: Nothing changed
- **WHEN** the working tree has no change to keep
- **THEN** no commit is made, nothing is pushed and the comment says nothing was built

#### Scenario: The remote branch has commits this run does not have
- **WHEN** `origin/<branch>` has a commit that the working branch lacks
- **THEN** it is not touched and the comment says so

#### Scenario: The run never left the base branch
- **WHEN** the working tree holds changes and the run is on the base branch or a detached head, not on the branch of the issue
- **THEN** the changes are carried to a new branch of the issue and kept there, and the base branch receives no commit

#### Scenario: The run is on some other branch
- **WHEN** the run is on a branch that is neither the base nor the branch of the issue
- **THEN** the changes are kept on a separate `rescue/<branch>` branch from where the run stands, nothing is pushed to the base branch, and the comment says the work is not on the branch that `/relevo:fix` reads

#### Scenario: The install step rewrote a lockfile
- **WHEN** a file already differed from the commit before the agent started (the install step rewrote a lockfile) and the agent has not changed it since
- **THEN** the rescue and the checkpoints leave it out, so that the refusal of a dependency file the issue did not list does not take the work of the agent with it

#### Scenario: The agent changed that file again
- **WHEN** the agent changed a file that was in the state recorded before it started
- **THEN** it is judged like any change, and a dependency file the issue did not list still refuses the commit

#### Scenario: The agent already took the failure path
- **WHEN** the issue is no longer `building` or `ready` because the run recorded its outcome
- **THEN** the always-running step does nothing

### Requirement: The clean-tree check ignores what the install step left
The `clean-tree` check that `go` makes before it claims work SHALL NOT count a file that the install step of the cloud job rewrote before the agent started and that still has the content recorded then. A file changed after that, and every change of a run without a record (a local run), SHALL still stop the run.

#### Scenario: The install step rewrote a lockfile and a configuration file
- **WHEN** `flutter pub get` rewrote `pubspec.lock` and `analysis_options.yaml` before the agent started, and nothing else changed
- **THEN** the check passes and the run goes on

#### Scenario: Another file changed
- **WHEN** a file that is not in the record, or that changed after it was recorded, differs from the commit
- **THEN** the check fails and lists only that file

#### Scenario: A local run
- **WHEN** there is no record of the state before the agent
- **THEN** every change counts, as before

### Requirement: The QA lenses leave out what the install step left
Before the first lens of a round, `go` SHALL list the files that are still as the install step of the cloud job left them, and SHALL give that list to every lens, which SHALL leave those files out of the diff it reads and SHALL report no finding about them. A file changed after the install SHALL NOT be in the list.

#### Scenario: A lockfile rewritten by the install
- **WHEN** the install step rewrote `pubspec.lock` and `analysis_options.yaml` and the developer did not touch them
- **THEN** no lens reports them, and the rejection of the work never rests on them

#### Scenario: The developer changed a file of the list
- **WHEN** the developer changed `pubspec.lock` after the install
- **THEN** the file is not in the list and the lenses review it like any change

#### Scenario: A local run
- **WHEN** there is no record of the state before the agent
- **THEN** the list is empty and the lenses review the whole diff, as before

### Requirement: A run that stopped at a limit is a class of its own
The outcome of a run that stopped at a limit or was cut SHALL be recorded with the class `limit`, apart from the classes of QA, inputs, policy and conflict.

#### Scenario: The class is recorded
- **WHEN** a run takes the failure path with the reason `run limit reached`
- **THEN** its usage record carries the class `limit`

#### Scenario: The runner or the job cut the run
- **WHEN** the run ended with no outcome and the log says the runner cut the agent at its turn or cost limit, or the agent step failed, was cancelled or timed out
- **THEN** its usage record carries the class `limit`

#### Scenario: The agent ended by itself with no result
- **WHEN** the run ended with no outcome, the runner did not cut it and the agent step succeeded
- **THEN** its usage record carries the class `other`, not `limit`

### Requirement: The developer builds one section of tasks at a time
`go` SHALL split the pending tasks of the change into groups, one per section of `tasks.md` in file order, and one group when three tasks or fewer are pending. It SHALL launch the developer once per group with only that group's tasks.

#### Scenario: A change with three sections
- **WHEN** `tasks.md` has sections 1, 2 and 3 with pending tasks in each
- **THEN** the developer is launched three times, each time with the tasks of one section

#### Scenario: A small change
- **WHEN** three tasks or fewer are pending
- **THEN** the developer is launched once with all of them

### Requirement: A checkpoint is committed and pushed after each group
After each group `go` SHALL commit the files that changed as `wip: checkpoint <k>/<n> (#N)`, with the hash of the issue text as a trailer, through the same safe commit as every commit, and push the branch of the issue without force.

#### Scenario: A group finishes
- **WHEN** the developer finishes the tasks of a group
- **THEN** its files are committed as a checkpoint and the branch is pushed

#### Scenario: The scans refuse a checkpoint
- **WHEN** a protected path, a restricted file, a marker or a credential is found
- **THEN** nothing is pushed and the build takes the failure path with that reason

#### Scenario: A cut after a checkpoint
- **WHEN** the runner cuts the run during the second group
- **THEN** the first group is on the remote branch and the rescue keeps what the second one had done

### Requirement: A later run resumes from the checkpoints
When the branch of the issue exists on the remote, `go` SHALL continue from it and build only the pending tasks if every commit over the base is a specification, checkpoint or limit commit of this issue, its tip is a checkpoint or limit commit that carries the hash of the issue text, and the text has not changed. Otherwise it SHALL stop with the reason `branch already exists`.

#### Scenario: A run resumes
- **WHEN** a run was cut after two of three groups and the issue is made `ready` again with the same text
- **THEN** the new run continues from the branch and builds the third group only

#### Scenario: A person committed on the branch
- **WHEN** one commit over the base is not one of Relevo's
- **THEN** the run stops with `branch already exists`

#### Scenario: The issue text changed
- **WHEN** the hash on the tip differs from the hash of the issue
- **THEN** the run stops with `branch already exists`

#### Scenario: The work was rejected by QA
- **WHEN** the tip is `wip: rejected by QA`
- **THEN** the run stops with `branch already exists` and the recovery is `/relevo:fix`

### Requirement: A branch created by the run is not an existing branch
The rescue and the failure path SHALL push the branch of the issue when the remote tip is an ancestor of the local branch, and SHALL NOT push when the remote has commits that the local branch lacks.

#### Scenario: The remote holds the checkpoints of this run
- **WHEN** the rescue runs and the remote tip is an ancestor of the working branch
- **THEN** the work is committed and pushed as a fast-forward

#### Scenario: The remote holds other commits
- **WHEN** the remote branch has a commit that the working branch lacks
- **THEN** nothing is pushed and the comment says the branch was not touched

### Requirement: The model plan is made by a script before the first launch
Before it launches the developer, `go` SHALL run the model plan, a script that prints for each role the model, the effort, the source of the choice (`config`, `auto` or `issue`) and the reason. `go` SHALL launch every agent with the model and the effort of the plan, and SHALL NOT choose a model itself. The plan SHALL be the same for the same inputs.

#### Scenario: A small issue with the developer on auto
- **WHEN** `agents.dev.model` is `auto`, the change has 3 tasks and 5 scenarios, and nothing in the issue is sensitive
- **THEN** the plan gives the developer the floor of its range and says the issue is small

#### Scenario: A large issue
- **WHEN** the change has 20 tasks and scenarios together
- **THEN** the plan gives the developer the ceiling of its range

#### Scenario: A role that is not on auto
- **WHEN** `agents.qa.code.model` is `sonnet`
- **THEN** the plan gives the code lens `sonnet` with the source `config`, whatever the issue says

### Requirement: The plan fails open
When the model plan cannot be made, `go` SHALL launch every agent with the model and the effort of the configuration and SHALL say so in its report. An error of the plan SHALL NOT stop or fail a build.

#### Scenario: The plan cannot be made
- **WHEN** the script fails or prints something that is not a plan
- **THEN** `go` launches every agent with the model and the effort of the configuration and says so in its report

### Requirement: The plan scores the size of the change and two raises
For a role on `auto`, the plan SHALL place the model in the range of the role by the size of the change (tasks plus scenarios: up to 6 takes the floor, up to 14 the middle rounded up, more the ceiling). It SHALL raise the pick one step, up to the ceiling, when the issue lists a dependency file in `Allow-paths:` or names a security-sensitive area, and the security lens SHALL go to the ceiling in both cases. With nothing to score, it SHALL use the default model of the role and SAY so.

#### Scenario: A security-sensitive issue
- **WHEN** the issue mentions an authentication or a credential and the security lens is on `auto`
- **THEN** the security lens runs on its ceiling

#### Scenario: Too few signals
- **WHEN** the change has no tasks and no scenarios
- **THEN** every role on `auto` uses the default model of the role and the reason says there was nothing to score

### Requirement: What the issue asks for is clamped
The issue MAY carry `Model:` for the developer and `QA-model:` for the lenses. For a role on `auto`, the plan SHALL use the value, SHALL NOT go above the ceiling of the role, and MAY go below its floor. It SHALL ignore the value, and say why in the plan, when `trust` is `public` or the name is not in the ladder.

#### Scenario: The issue asks for a lower model
- **WHEN** the issue says `Model: haiku` and the developer is on `auto` with the ceiling `sonnet`
- **THEN** the developer runs on `haiku` with the source `issue`

#### Scenario: The issue asks for a model above the ceiling
- **WHEN** the issue says `Model: opus` and the ceiling of the developer is `sonnet`
- **THEN** the developer runs on `sonnet` and the plan says the value was clamped to the ceiling

#### Scenario: Public trust
- **WHEN** `trust` is `public` and the issue carries `Model: haiku`
- **THEN** the line is ignored and the plan says why

#### Scenario: A name the ladder does not have
- **WHEN** the issue says `Model: gpt-5`
- **THEN** the line is ignored and the plan names the value and the ladder

### Requirement: The plan never raises the cost limit
The model plan SHALL NOT change `limits.run_max_cost`, `limits.run_max_turns` or `limits.run_max_minutes`, and no value of the issue SHALL bypass them.

#### Scenario: A cheaper plan
- **WHEN** the plan lowers the models of a small issue
- **THEN** the limits of the run are the ones in `relevo.yml`

#### Scenario: A line in the issue
- **WHEN** the issue says `Model: opus` and the ceiling allows it
- **THEN** the run is still stopped by `limits.run_max_cost`

### Requirement: A retry of the developer runs one level up
Before each launch of the developer in fix mode after a red gate or a rejection, `go` SHALL ask `scripts/model-plan.mjs escalate` for its model. For a developer on `auto` the script SHALL give the next name of `agents.ladder` after the model of the failed attempt, never past the `ceiling` of the role. In every other case it SHALL give the same model back. The lenses SHALL keep the model of the plan, and no limit of the run SHALL change.

#### Scenario: QA rejects and the developer is on auto
- **WHEN** the attempt 1 ran on `haiku`, QA rejected it and the ceiling of the developer is `opus`
- **THEN** the retry runs on `sonnet`, and a second retry would run on `opus`

#### Scenario: The developer is at its ceiling
- **WHEN** the developer already runs on its ceiling and QA rejects the attempt
- **THEN** the retry runs on the same model

#### Scenario: The model of the developer is set in the configuration
- **WHEN** `agents.dev.model` is a name and not `auto`
- **THEN** the retry runs on that name

#### Scenario: The red gate
- **WHEN** the gate is red on an attempt that is not the last one
- **THEN** the retry runs one name up, as after a rejection

#### Scenario: The step cannot be made
- **WHEN** the configuration cannot be read or the model is not in the ladder
- **THEN** the retry runs on the model of the failed attempt and the run goes on

### Requirement: The QA lenses run together
When the gate receipt is valid, `go` SHALL launch every active lens in the same turn, each in the foreground and with the model and effort of the plan, and SHALL wait for all the reports before it aggregates. The lens plan SHALL list the launch batches: all the active lenses in one batch, or batches of at most the concurrency limit of the runtime when one is given. A run that cannot launch the lenses together SHALL launch them in those batches, one batch after another.

#### Scenario: Several active lenses
- **WHEN** the receipt is valid and the plan lists `spec`, `security`, `code` and `interface` as active
- **THEN** the four are launched together and the build waits for the four reports

#### Scenario: A concurrency limit
- **WHEN** the runtime allows only two subagents at a time and four lenses are active
- **THEN** the plan lists two batches of two and the second batch starts after the first has reported

#### Scenario: An inactive lens
- **WHEN** the plan records `interface` as `SKIPPED`
- **THEN** no agent is launched for it and it is in no batch

### Requirement: No lens starts without a valid receipt, in parallel as in sequence
The receipt SHALL be checked immediately before each launch of lenses (each batch), and no lens SHALL start when that check fails: the gate runs again first. All the lenses of a batch SHALL be launched in the same turn, with no step between them that can change the diff.

#### Scenario: The diff changed since the gate
- **WHEN** the receipt check fails before a batch
- **THEN** no lens of the batch starts and the gate runs again

#### Scenario: A second batch
- **WHEN** the lenses are launched in two batches
- **THEN** the receipt is checked again before the second batch

### Requirement: One failed lens does not stop the others
When a lens ends with no report, the other lenses SHALL finish and keep their reports. `go` SHALL ask that lens again once, alone, after the receipt check, and when it still gives no report SHALL take the failure path with the reason `lens report invalid`, naming the lens and not retrying the developer.

#### Scenario: One lens ends with no report
- **WHEN** `code` fails and `spec` and `security` report
- **THEN** their reports are kept, `code` is asked again once, and if it fails again the comment names `code`

### Requirement: The seconds of each lens are right when lenses overlap
The record of a lens SHALL have its own start and its own end. The seconds of a lens SHALL be the time between them; a lens that has no end SHALL last until the next phase is announced or the run ends, never until another lens begins.

#### Scenario: Two lenses overlap
- **WHEN** `spec` runs from 0 to 200 seconds and `security` from 1 to 30 seconds
- **THEN** the usage record has 200 seconds for `spec` and 29 for `security`

#### Scenario: A lens has no end
- **WHEN** a lens was started and never ended, and the next phase begins at 90 seconds
- **THEN** its seconds are counted to that phase

### Requirement: An agent is given the path of the Relevo scripts it runs
When an agent has to run a script of Relevo, `go` SHALL give it the resolved path of that script (from `CLAUDE_PLUGIN_ROOT`), and the instructions of the agent SHALL NOT make it search the filesystem for one.

#### Scenario: The spec lens checks the decisions of the issue
- **WHEN** `go` launches the `spec` lens
- **THEN** it gives the lens the path of `issue-sections.mjs`, and the lens runs that path with no search

### Requirement: The configured OpenSpec guidance reaches the developer
When the repository's `openspec/config.yaml` sets a `context`, `rules` for `tasks`, or apply guidance, `go` SHALL give them to the developer agent explicitly, read from the output of `openspec instructions apply` and `openspec instructions tasks`. It SHALL NOT rely on the developer finding the file, and SHALL NOT copy them into the change's files.

#### Scenario: Config with a context
- **WHEN** `openspec/config.yaml` sets a `context` or rules for `tasks`
- **THEN** each developer launch is given that text as the project guidance, word for word

#### Scenario: Config with apply guidance
- **WHEN** the apply instructions carry operation guidance
- **THEN** the developer is given it along with the context and the rules

#### Scenario: No config
- **WHEN** the repository has no `openspec/config.yaml`, or it sets none of them
- **THEN** the developer is given no project guidance, only its default cost guide, and the report says so

#### Scenario: Retries get it too
- **WHEN** the developer is launched again in fix or integrate mode
- **THEN** it is given the same project guidance

### Requirement: Inputs that the issue declares are checked before the agent starts
Before the agent starts, the build job SHALL check each input listed in the `External inputs` section of the issue that a script can verify, and SHALL NOT start the agent when one is missing. It SHALL send the issue to `needs-spec` with the reason `inputs` and a comment that names each missing input.

#### Scenario: A declared file does not exist
- **WHEN** the issue lists a file of this repository as an input and the file does not exist on the base branch
- **THEN** the agent does not start, the issue goes to `needs-spec` with the reason `inputs`, and the comment names the file

#### Scenario: An issue without the section
- **WHEN** the issue has no `External inputs` section
- **THEN** this check passes and the build goes on

#### Scenario: An input that a person confirms
- **WHEN** the issue lists an input of the kind `manual`, or of a kind that the job cannot verify
- **THEN** the build is not blocked and the hand-off lists the input for a person to confirm

#### Scenario: A secret is never shown
- **WHEN** the check looks at an input that is a secret or a variable
- **THEN** it learns only whether it is present, and neither the value nor part of it appears in a comment, a log or a file

### Requirement: A refused reference ends the run before the agent starts
When the fetcher refuses a reference of the issue, the cloud build SHALL end without starting the agent. It SHALL send the issue to `needs-spec` with the reason and the text of the refusal, and SHALL NOT spend a model turn. A workflow that lacks this step SHALL keep working as it did.

#### Scenario: A reference cannot be read
- **WHEN** the fetch step refuses a reference because the file is not found or access is denied
- **THEN** the agent step is skipped and the `needs-spec` comment names the reference and gives the reason of the refusal

#### Scenario: An older workflow
- **WHEN** a repository still has a workflow without the step
- **THEN** `go` takes the `needs-spec` path itself, as before

### Requirement: Installed dependencies are checked before the agent starts
When the profile of the platform lists paths that must exist once its dependencies are installed, the build job SHALL check them right after the check of the tools. When one is missing, the run SHALL end as a missing tool does: no model turn, the issue `qa-failed`, and a comment that names the missing path and the step to enable.

#### Scenario: Dependencies were not installed
- **WHEN** a listed path does not exist after the install step
- **THEN** the agent does not start, the issue becomes `qa-failed` and the comment names the path and says to enable the install step

#### Scenario: A profile that lists no paths
- **WHEN** the profile of the platform lists none
- **THEN** no check is made

### Requirement: The specification is checked before the developer agent runs
After the specification is complete and before the developer agent runs, `go` SHALL check the task lines of `tasks.md` for a protected path and for a dependency manifest that the issue does not allow with `Allow-paths:`. When it finds one it SHALL end in `needs-spec` with the reason `policy` and SHALL name the task and the path.

#### Scenario: A task edits a protected file
- **WHEN** a task line says to change a file that no unattended run may change
- **THEN** the developer agent does not run, the issue goes to `needs-spec` with the reason `policy`, and the comment quotes the task and names the path

#### Scenario: A dependency the issue allowed
- **WHEN** a task adds a dependency and the issue lists the manifest in `Allow-paths:`
- **THEN** the check passes

#### Scenario: A path only mentioned
- **WHEN** a protected path appears in the design or in the description of a task but no task line changes it
- **THEN** the check does not block the build

### Requirement: The checks that need no model are never a security control
Every rule that these checks apply SHALL be applied again by the guard that already enforces it, so that a defect in a check can cost a build or a late rejection and SHALL NOT let a protected change through.

#### Scenario: The check misses a protected path
- **WHEN** a task changes a protected path and the check does not detect it
- **THEN** QA and the guards of the commit still refuse the change

#### Scenario: The checks are absent
- **WHEN** a workflow or a plugin version does not run these checks
- **THEN** every guard behaves exactly as it did before

### Requirement: Each QA finding carries a class
Each numbered finding of a QA report SHALL carry a class: `fixable` when the developer agent can correct it, or `input`, `spec` or `policy` when it needs something that the issue, the project or a person must supply. A finding without a valid class SHALL count as `fixable`.

#### Scenario: A finding of a missing input
- **WHEN** QA rejects because a key or a file the issue depends on does not exist
- **THEN** the finding has the class `input`

#### Scenario: A report without classes
- **WHEN** a QA report has no class on its findings
- **THEN** every finding counts as `fixable` and the retries run as before

### Requirement: Retries are skipped when no finding can be fixed by the developer agent
When QA rejects and no finding is `fixable`, `go` SHALL skip the retries and end in the usual failure exit with the work kept as it is kept today. The comment SHALL state the class and the next step. When the findings are mixed, `go` SHALL retry as before and, if QA still rejects, SHALL name the class of the first finding that is not `fixable`.

#### Scenario: Nothing the developer can fix
- **WHEN** every finding of the report has the class `input`, `spec` or `policy`
- **THEN** no second developer or QA cycle runs, the issue ends in the usual failure exit, and the comment says the class and what to supply

#### Scenario: A mixed report
- **WHEN** a report has a `fixable` finding and an `input` finding
- **THEN** the developer agent is retried as before, and if QA still rejects the comment names the `input` class

### Requirement: The usage record carries the phases and the class of the outcome
The machine-readable usage comment of a run SHALL carry, besides its present figures, the seconds that each phase took with its attempt number and the class of the outcome: `built`, `inputs`, `policy`, `qa-non-fixable`, `qa-fixable-after-retries`, `conflict` or `other`. A reader that does not know these keys SHALL ignore them, and the visible progress comment SHALL NOT change.

#### Scenario: A run that built the issue
- **WHEN** a run ends with the issue built after one QA retry
- **THEN** the record lists the phases in order with the attempt of each and the class `built`

#### Scenario: An older reader
- **WHEN** a reader that predates these keys reads the record
- **THEN** it reads the figures it knows and ignores the rest

#### Scenario: A comment from an older run
- **WHEN** a usage comment has no phases or class
- **THEN** it is read as it was, without an error

### Requirement: The developer agent and QA receive the interface rules that the change touches
After the specification is complete and before the developer agent runs, `go` SHALL select the interface rules for the stack and the text of the tasks and the design, and SHALL give the developer agent their "build it like this" lines and QA their "check this" lines, within the budget of the selection, with the number of rules left out.

#### Scenario: A change that touches a form
- **WHEN** the tasks mention a form on a stack with an interface
- **THEN** the developer agent receives the core rules and the form rules, and QA receives the same rules in their "check this" form

#### Scenario: A stack with no interface
- **WHEN** the profile of the platform has no interface
- **THEN** no interface rule is selected and the run goes on as before

#### Scenario: Over the budget
- **WHEN** more rules match than the budget holds
- **THEN** the output says how many were left out and no blocking core rule is among them

### Requirement: QA rejects on a blocking rule only with evidence
QA SHALL treat a blocking interface rule as a reason to reject only with the evidence that every finding needs, and SHALL list the advisory rules and the rules that only a person can check under "left for on-device review" instead of rejecting for them.

#### Scenario: A blocking rule broken
- **WHEN** the diff shows an icon-only button with no accessible name on a stack where that rule is blocking
- **THEN** QA rejects with the file and line and the rule

#### Scenario: A rule only a person can check
- **WHEN** a rule can be checked only by looking at the screen
- **THEN** QA lists it for the on-device review and does not reject

### Requirement: QA treats a mobile sketch like an image reference
When a `Design reference` holds a sketch for a mobile stack, QA SHALL check that the code plausibly respects the layout, the states and the roles of the colours, and SHALL NOT compare the markup of the sketch with the widget tree of the code.

#### Scenario: A sketch as a reference
- **WHEN** the reference is a mobile sketch and the code shows the same states in the same order with the colours in the same roles
- **THEN** QA does not reject for a difference in markup

### Requirement: QA is the gate followed by the lenses
After the developer agent finishes, `go` SHALL run the validation gate, and SHALL run the lenses only when the gate is green and its receipt is valid. It SHALL then aggregate the reports with a script, and SHALL end the run or hand the findings to the developer agent as the result says.

#### Scenario: A green gate
- **WHEN** the gate is green and its receipt matches the diff
- **THEN** the active lenses run one after another and their reports are aggregated

#### Scenario: A receipt that does not match
- **WHEN** the diff changed after the receipt was written
- **THEN** the gate runs again before any lens

### Requirement: The limits of a run count every subagent
The limits on the turns and the cost of a run, and the limit on its tokens with an agent that has no cost limit, SHALL include the turns, cost and tokens of the lens agents. Where the runtime does not count a subagent, Relevo SHALL count it from the log of the run.

#### Scenario: Lenses use turns
- **WHEN** the lenses of a run use turns
- **THEN** those turns count towards `limits.run_max_turns`

#### Scenario: A runtime that does not count subagents
- **WHEN** the runtime leaves the turns of a subagent out of its count
- **THEN** Relevo adds them from the log and applies the limit to the total

### Requirement: A contradiction is found before any agent turn
Before the agent starts, `build-preflight.mjs --stage issue` SHALL run the same comparison as the check of a draft, against the files of `qa.rules_from`, and SHALL report each conflict as a finding of the kind `conflict`. With a finding the decision is `needs-spec`, the reason is `conflict`, and `missing` quotes both lines of each pair. No model turn is spent. A scenario that the words say needs an excluded line is listed in `notes` and never changes the decision. Without a rules file or without `relevo.yml` only that comparison with the scenarios runs. This stage is an optimisation: QA still reads the rules.

#### Scenario: Conflict found at the preflight
- **WHEN** the issue excludes in `Out of scope` something that a hard rule of `CLAUDE.md` requires
- **THEN** the preflight exits 1 with the reason `conflict` and the agent does not start

#### Scenario: Notes reach the hand-off
- **WHEN** the preflight decides `ok` and has notes (a scenario clash, a rules file that could not be read)
- **THEN** the workflow adds each as `check: <note>` on one line to the "Inputs to confirm" line of the hand-off, and the build goes on

#### Scenario: Override recorded
- **WHEN** the issue has a decision with `Overrides: CLAUDE.md:12` for that rule
- **THEN** the preflight does not report it

### Requirement: A violation of a hard rule blocks
A QA finding that cites a rule as `Rule: <file>:<line> "<quoted text>"` SHALL be blocking when the quoted text is found on that line of a file of `qa.rules_from` and the rule is not marked `[advice]`. It blocks whichever lens wrote it and on every attempt, including the `interface` lens on its last attempt, and a report whose first line is `QA PASSED` that contains such a citation SHALL make the result `QA REJECTED`. A citation that does not match the file is not trusted: the finding is treated as it was before and the output lists it as `unverified`. A rule marked `[advice]` blocks nothing, and a finding that cites it is an advisory note. A rule is marked by `[advice]` on its line, or on a heading that holds it.

#### Scenario: Interface lens on the last attempt cites a hard rule
- **WHEN** the `interface` lens, on the last attempt, reports a finding with `Rule: CLAUDE.md:30 "..."` that matches the file
- **THEN** the result is `QA REJECTED` and the finding is in `findings`, not in `advisory`

#### Scenario: A pass that carries a citation
- **WHEN** a report starts with `QA PASSED` and contains a verified `Rule:` citation of a hard rule
- **THEN** the result is `QA REJECTED`

#### Scenario: The quote is not on that line
- **WHEN** a citation names a line whose text does not contain the quote
- **THEN** it is listed as unverified and does not change the result by itself

#### Scenario: Advice
- **WHEN** the cited rule line is marked `[advice]`
- **THEN** the finding is an advisory note and does not block

### Requirement: The spec check lists assumptions that nothing in the repository settles
`build-preflight.mjs --stage spec` SHALL read the assumptions of `design.md` (the ones the specification wrote and the ones copied from the issue), pick those that name something outside the repository, look for each name in the repository outside `openspec/`, drop the ones it finds, and print the rest as `assumptions` and as a line `assumed` for the hand-off. It SHALL NOT change the decision: an assumption never stops the build, because a lexical match is not reliable enough to stop one. A person who wants the build to wait turns the assumption into an open question of the issue, which sends it back before the build.

#### Scenario: A permission name is not in the repository
- **WHEN** `design.md` assumes the permission `orders.export` and no file of the repository holds it
- **THEN** the output lists it, the `assumed` line names it, and the decision is still `ok`

#### Scenario: The repository settles it
- **WHEN** the name is found in a file outside `openspec/`
- **THEN** it is not listed

#### Scenario: No assumptions
- **WHEN** `design.md` has no assumptions
- **THEN** `assumptions` is empty and `assumed` is empty

### Requirement: A script lists the shared code a build touched
`scripts/shared-code.mjs` SHALL list, from the diff of the branch against the base, the added and modified source files that are shared: a file that lives in a shared folder (a path rule) or that is imported by more than one other file of the repository that is not a test. The import graph SHALL be read from the files of the repository, with relative, alias and package imports of the languages of the stacks of Relevo; the model SHALL NOT decide what is shared. Each entry SHALL say whether the file was added or modified and why it counts. `go` SHALL put the line of the output in the hand-off as `shared_code`. Nothing SHALL be blocked and the script SHALL fail open: when it cannot read the diff it prints that it could not and exits 0.

#### Scenario: A modified component used by two screens
- **WHEN** the diff modifies `src/components/Table.vue` and two other files import it
- **THEN** it is listed as modified, used by two files

#### Scenario: A new component in a shared folder
- **WHEN** the diff adds `src/components/Badge.vue`
- **THEN** it is listed as added, with the path rule as the reason, even before anything imports it

#### Scenario: A new component of one screen
- **WHEN** the diff adds `src/views/orders/Row.vue` and only `src/views/orders/List.vue` imports it
- **THEN** it is not listed

#### Scenario: Tests and documents
- **WHEN** the diff changes a test, a document or a file of `openspec/`
- **THEN** it is not listed

#### Scenario: The diff cannot be read
- **WHEN** the base branch cannot be resolved
- **THEN** the script says so in `notes`, lists nothing and exits 0

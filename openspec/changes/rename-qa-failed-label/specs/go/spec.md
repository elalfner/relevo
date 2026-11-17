# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Unrecoverable problems end in qa-failed`
- TO: `### Requirement: Unrecoverable problems end in build-failed`

- FROM: `### Requirement: A qa-failed issue without a branch can be retried`
- TO: `### Requirement: A build-failed issue without a branch can be retried`

## MODIFIED Requirements

### Requirement: Concurrency and cost limits
`go` SHALL run at most one agent per issue and at most `limits.concurrent_agents` agents overall. A run that exceeds `limits.run_max_turns` or `limits.run_max_cost` SHALL be stopped by the runner: the agent cannot see its own counters and does not try to stop itself.

#### Scenario: Duplicate trigger
- **WHEN** the label event fires twice for the same issue
- **THEN** only one run executes

#### Scenario: Run exceeds its budget
- **WHEN** a run reaches its turn or cost limit
- **THEN** the runner stops it, the agent pushes nothing, and the final step of the workflow labels the issue `build-failed` and comments with the job status and a link to the run

#### Scenario: Retry after a budget cut
- **WHEN** the person applies `ready` again after a run was cut by its limits
- **THEN** the issue is evaluated like any other, because the cut run pushed no branch

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
- **THEN** the issue is labelled `build-failed` and a comment links the run

### Requirement: A run that ends without an outcome is reported
The workflow that runs `go` SHALL end with a step that always runs. When the issue is still `ready` or `building` after the agent step, that step SHALL replace the label with `build-failed` and SHALL comment, mentioning the assignee, with the job status and a link to the run, so no failure before or during the agent is silent. When the issue carries any other state, the step SHALL NOT change it.

#### Scenario: The plugin cannot be installed
- **WHEN** the run fails before `go` starts and the issue is still `ready`
- **THEN** the issue is labelled `build-failed` and a comment links the run

#### Scenario: The agent ends its session early
- **WHEN** the job succeeds but the issue is still `building`
- **THEN** the issue is labelled `build-failed` and a comment links the run

#### Scenario: A dispatched run fails before claiming the issue
- **WHEN** the job fails and the issue is still `queued`
- **THEN** the issue is labelled `build-failed` and a comment links the run, so the queue does not dispatch it again every evaluation

#### Scenario: A run ends normally with the issue queued
- **WHEN** the job succeeds and the issue is `queued` because there was no capacity
- **THEN** the final step changes nothing

#### Scenario: The run recorded its outcome
- **WHEN** the issue is `built`, `queued`, `blocked`, `needs-spec` or `build-failed` when the job ends
- **THEN** the final step changes nothing

### Requirement: Adversarial QA with one retry
QA SHALL compare the diff against the issue's scenarios and the project rules in `qa.rules_from` through its lenses, after the validation gate has run the platform's static analysis and tests once, and return `QA PASSED` or `QA REJECTED` with file, line and reason. On rejection, by the gate or by a lens, the developer agent SHALL get exactly `qa.retries` attempts to fix, then QA SHALL run again.

#### Scenario: QA passes after a retry
- **WHEN** the first QA run rejects and the second passes
- **THEN** the build proceeds as passed

#### Scenario: QA still rejects
- **WHEN** QA rejects after the allowed retries
- **THEN** the branch is pushed, the issue is labelled `build-failed`, the assignee is mentioned with the QA report, no pull request is opened and the state does not advance

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
- **THEN** nothing is pushed, the issue is labelled `build-failed` with that reason, and the comment states that the branch was not pushed

#### Scenario: Protected path staged
- **WHEN** the staged diff touches a protected path the issue does not allow
- **THEN** nothing is committed or pushed and the issue is labelled `build-failed` with the reason "protected path in the diff"

### Requirement: Unrecoverable problems end in build-failed
Any problem `go` cannot recover from SHALL end in the `build-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential, a temporary marker, a protected path in the diff or an issue that changed after `ready`, or when the branch already exists, which `go` never touches. When the reason is that QA rejected the work after the retries or that tasks were left unfinished, `go` SHALL first commit the work in progress, through the same safe commit as a successful build and with a message that says it is not approved, so that the push keeps it; if that commit is refused, `go` SHALL push nothing. It SHALL NOT open a pull request or advance the state.

#### Scenario: Branch already exists
- **WHEN** the feature branch already exists on the remote
- **THEN** `go` leaves it untouched and ends in `build-failed` with the reason "branch already exists"

#### Scenario: Branch already exists with implementation commits
- **WHEN** the feature branch already exists on the remote and holds commits other than the specification commit
- **THEN** `go` leaves it untouched, ends in `build-failed` with the reason "branch already exists", and the comment says to run `/relevo:fix <n>`

#### Scenario: Branch already exists with only the specification
- **WHEN** the feature branch already exists on the remote and holds only the specification commit
- **THEN** `go` leaves it untouched, ends in `build-failed` with the reason "branch already exists", and the comment says to delete the remote branch and apply `ready` again

#### Scenario: Specification invalid
- **WHEN** the generated change specification still fails validation after two corrections
- **THEN** `go` ends in `build-failed` with the reason "specification invalid"

#### Scenario: Ambiguity that changes behaviour
- **WHEN** the issue is ambiguous in a way that changes observable behaviour
- **THEN** `go` does not guess: the issue is labelled `needs-spec`, assigned to the spec writer, and nothing is pushed

#### Scenario: QA rejects after the retries
- **WHEN** QA still rejects the work after the retries and the safe commit accepts it
- **THEN** the branch is pushed with a commit `wip: rejected by QA (#<n>)` that holds the work, the issue is `build-failed`, no pull request is opened, and the comment says the branch holds work that QA did not approve

#### Scenario: QA could not run the checks
- **WHEN** QA rejected only because the analysis and the tests could not run
- **THEN** the work is kept in the same way and the comment says what QA could not check

#### Scenario: Tasks left unfinished
- **WHEN** the developer finished with tasks still open
- **THEN** the work done is committed and pushed as work in progress, and the comment says how many tasks are done

#### Scenario: The safe commit refuses the work
- **WHEN** the work in progress contains a protected path, a file outside the platform, a temporary marker or a possible credential
- **THEN** nothing is committed or pushed, and the comment says the branch was not pushed and why

### Requirement: A finished build starts the queue
When a cloud build run ends, whatever its outcome, the `go` workflow SHALL start a queue evaluation (`relevo-queue`) after the labels of the outcome are set, because labels changed with the workflow token start no workflow by themselves. It SHALL also do so when the light job fails after claiming the issue.

#### Scenario: A build ends with `built`
- **WHEN** a build finishes and the issue is `built` while other issues are `queued`
- **THEN** the queue is evaluated right away and the oldest eligible `queued` issue starts, without waiting for the schedule

#### Scenario: A build fails or is cut
- **WHEN** a build ends as `build-failed`, `needs-spec`, cancelled or timed out
- **THEN** the queue is evaluated right away

#### Scenario: The light job fails after the claim
- **WHEN** the gates claim the issue as `building` and the light job then fails, leaving it `build-failed`
- **THEN** the queue is evaluated right away

#### Scenario: No build ran
- **WHEN** the decision is `needs-spec`, `blocked`, `queued`, `denied`, no milestone or no assignee, and the light job succeeds
- **THEN** no queue evaluation is started, because no slot was freed

#### Scenario: The queue workflow is missing
- **WHEN** the repository has no `relevo-queue` workflow
- **THEN** the start fails without failing the run or changing any label

### Requirement: The specification is complete before it is validated
After writing the last artifact, `go` SHALL confirm with OpenSpec that every artifact of the change is done. It SHALL NOT validate or build while one is missing.

#### Scenario: All artifacts done
- **WHEN** OpenSpec reports every artifact of the change as done
- **THEN** `go` validates the specification and continues

#### Scenario: An artifact is missing
- **WHEN** OpenSpec reports an artifact that is not done
- **THEN** `go` writes it and checks again; if it is still missing, the run ends in `build-failed` with the reason "specification incomplete"

### Requirement: The developer starts from the OpenSpec apply instructions
Before the developer agent runs, `go` SHALL obtain the apply instructions of the change from OpenSpec and give the developer its context files and pending tasks. Whether tasks remain SHALL be read from OpenSpec's progress, not counted by hand.

#### Scenario: Pending tasks handed over
- **WHEN** the apply instructions list pending tasks
- **THEN** the developer receives those tasks and the files to read, and does not scan the change for them

#### Scenario: Tasks left after the build
- **WHEN** OpenSpec reports tasks remaining after the developer finished
- **THEN** the run ends in `build-failed` with the reason "tasks left unfinished"

#### Scenario: Apply is blocked
- **WHEN** the apply instructions report that the change cannot be applied yet
- **THEN** the run ends in `build-failed` with the reason "specification incomplete"

### Requirement: An issue changes only its platform
A commit of an unattended run SHALL touch only files inside the folder of the platform of the issue, the change's own specification folder, `GLOSSARY.md` and `docs/adr/`. Any other path SHALL end the run in `build-failed` with the reason "outside the platform", and nothing is pushed, unless the issue lists the path in an `Allow-paths:` line. A platform whose folder is `.` is not restricted.

#### Scenario: Front issue touches the back
- **WHEN** the diff of an issue for `web` (`apps/web`) touches `apps/api/app/User.php`
- **THEN** the commit is refused as outside the platform

#### Scenario: Shared package authorized
- **WHEN** the issue says `Allow-paths: packages/shared/**` and the diff touches `packages/shared/a.ts`
- **THEN** the commit is accepted

#### Scenario: Whole repository platform
- **WHEN** the platform folder is `.`
- **THEN** no path is refused for being outside it

### Requirement: The build checks the toolchain before the agent starts
The build job of the go workflow SHALL check, before the agent step, that every tool listed by the profile of the platform of the issue is on the path of the runner, and when one is missing SHALL stop without running the agent, move the issue to `build-failed` and post one comment that names the missing tools, says that nothing was built and what to do. It SHALL check nothing for a stack whose profile lists no tools, and SHALL run the check from a copy of the package outside the workspace.

#### Scenario: A runner without the Flutter SDK
- **WHEN** the platform is Flutter and `flutter` is not on the path of the runner
- **THEN** the agent does not run, the issue is `build-failed`, and the comment says `flutter` is missing, that no model turns were spent and that the toolchain step of `relevo-go.yml` must be enabled

#### Scenario: A complete toolchain
- **WHEN** every tool of the profile answers `--version`
- **THEN** the check passes silently and the agent runs

#### Scenario: A stack with no tools listed
- **WHEN** the profile lists no tools
- **THEN** nothing is checked and the agent runs

#### Scenario: A clean working tree
- **WHEN** the check runs
- **THEN** it leaves nothing inside the workspace, so the agent's own preflight still finds a clean tree

### Requirement: The workflows name the tools they assume
A Relevo workflow SHALL list the tools it needs on the runner beyond what it installs (`git`, `gh`, `jq` and Node), and the toolchain check of the build job SHALL fail before the agent starts, without a model turn, when one is not on the path of the runner.

#### Scenario: A runner without jq
- **WHEN** the runner has no `jq` on its path
- **THEN** the build job stops before the agent, the issue becomes `relevo:build-failed` and the comment names `jq` and says nothing was built

### Requirement: The failure comment does not offer fix when nothing was pushed
When `go` ends in `build-failed` with the branch not pushed (`unsafe` or `not_pushed`) and gives no explicit recovery, the comment SHALL show the next step of the `rebuild` variant and SHALL NOT suggest `/relevo:fix <n>`. A comment for a pushed branch, for kept work and for an existing branch SHALL keep its current next step.

#### Scenario: Commit refused by the scanner
- **WHEN** QA rejected the build, the safe commit of the work in progress was refused because of a possible credential, and `branch_state` is `unsafe`
- **THEN** the comment says the branch was not pushed, ends with the rebuild step, and does not contain `/relevo:fix`

#### Scenario: Not pushed for another reason
- **WHEN** the issue changed after `ready` and `branch_state` is `not_pushed`
- **THEN** the comment ends with the rebuild step and does not contain `/relevo:fix`

#### Scenario: Pushed branch unchanged
- **WHEN** `branch_state` is `pushed`
- **THEN** the next step is still `/relevo:fix <n>`

### Requirement: A build-failed issue without a branch can be retried
When the planner is asked to retry an issue (`--retry`, together with `--only <n>`), it SHALL treat that issue, when it is `build-failed`, as if it were `ready`: the same gates apply and the claim SHALL move it from `build-failed` to `building`. It SHALL NOT add or require the `ready` label, and the claim SHALL post no comment of its own. In place of the person who applied `ready` it SHALL use the person who runs the retry: only write access, or a maintainer when `trust` is `public`, may retry.

#### Scenario: Retry of a qa-failed issue without a branch
- **WHEN** issue 67 is `build-failed`, has no remote branch, and a person with write access runs the planner with `--only 67 --retry --apply --claim`
- **THEN** the decision is `start`, the issue loses `build-failed` and gains `building`, no `ready` label is added and no comment is posted

#### Scenario: The person may not start work
- **WHEN** the person who runs the retry has only read access, or `trust` is `public` and the person is not a maintainer
- **THEN** the decision is `denied` and nothing is claimed

#### Scenario: Gates still apply
- **WHEN** the retried issue has no assignee, no milestone or an incomplete specification
- **THEN** the same decision as for a `ready` issue is returned, and nothing is built

#### Scenario: Without the flag
- **WHEN** the planner runs without `--retry`
- **THEN** a `build-failed` issue is still ignored

### Requirement: A retry is refused when there is something to fix instead
The planner SHALL refuse a retry, changing nothing, when the issue is not `build-failed` or when a branch `feature/<n>-*` exists on the remote. The message SHALL send the person to `/relevo:fix <n>` or to delete the branch.

#### Scenario: A branch exists
- **WHEN** `origin/feature/67-...` exists and the retry is requested
- **THEN** nothing changes and the message says to run `/relevo:fix 67` or to delete the branch

#### Scenario: The issue is not qa-failed
- **WHEN** the retry is requested for an issue that is `built`
- **THEN** nothing changes and the message says that only a `build-failed` issue can be retried

### Requirement: The work is kept when go stops at a limit
When `go` stops because of a limit, it SHALL commit the work in progress with the subject `wip: stopped by limit (#N)` through the same script and with the same refusals as any commit, and push it to the branch of the issue without opening a pull request. The comment SHALL say whether the work was kept.

#### Scenario: `go` stops at a limit
- **WHEN** the budget guard says a limit was reached and the developer's work is in the working tree
- **THEN** the work is committed as `wip: stopped by limit (#N)`, pushed to the branch of the issue, the issue goes to `build-failed` with the reason `run limit reached`, and the comment says the work was kept

#### Scenario: `fix` continues from the kept work
- **WHEN** the last commit of the branch is `wip: stopped by limit (#N)`
- **THEN** `fix` treats it as work in progress, the same as the work that QA rejected

### Requirement: Installed dependencies are checked before the agent starts
When the profile of the platform lists paths that must exist once its dependencies are installed, the build job SHALL check them right after the check of the tools. When one is missing, the run SHALL end as a missing tool does: no model turn, the issue `build-failed`, and a comment that names the missing path and the step to enable.

#### Scenario: Dependencies were not installed
- **WHEN** a listed path does not exist after the install step
- **THEN** the agent does not start, the issue becomes `build-failed` and the comment names the path and says to enable the install step

#### Scenario: A profile that lists no paths
- **WHEN** the profile of the platform lists none
- **THEN** no check is made

### Requirement: A run that ends abnormally leaves a trimmed transcript
When a run ends cancelled, timed out or without an outcome, and `trust` is not `public`, the workflow SHALL write the last part of what the agent did to the summary of the run, with a step that uses no action, and SHALL say where it is in the comment that reports the run. The transcript SHALL hold the commands of the agent, redacted. When the full output is on, it SHALL also hold the first part of each result, redacted. When the full output is off, no result SHALL be kept. A run that ends with an outcome SHALL NOT save a transcript.

#### Scenario: Run cancelled at the time limit
- **WHEN** the job reaches its timeout with the output off
- **THEN** the summary of the run holds the last commands of the agent, redacted and with no results, and the comment on the issue says so

#### Scenario: Output on
- **WHEN** a run ends without an outcome and the full output is on
- **THEN** the summary also holds a short, redacted excerpt of each result

#### Scenario: Run with an outcome
- **WHEN** the run ends with `built` or `build-failed` through the skill's own exit
- **THEN** no transcript is saved

#### Scenario: The log is missing
- **WHEN** the execution log does not exist or has no entries the reader understands
- **THEN** no transcript is written, the comment does not mention one, and the step does not fail the job

### Requirement: The base branch is integrated before the hand-off
After QA passes and before it pushes the branch, `go` SHALL check whether the base branch moved. When it did and the merge has no conflict, `go` SHALL merge the base branch, run the gate again and hand off only if it passes. A conflict in a generated file SHALL be resolved by running the command in `integration.regenerate`; a conflict in any other file ends in the `conflict` outcome with the files named.

#### Scenario: The base moved without a conflict
- **WHEN** QA passes and the base branch has new commits that merge cleanly
- **THEN** the base is merged, the gate runs again, and the issue is `built` with the merged branch pushed

#### Scenario: The merged branch fails the gate
- **WHEN** the gate fails after the merge
- **THEN** the run takes the failure path of a rejected build, and the message says the failure came after merging the base

#### Scenario: A generated file conflicts
- **WHEN** the merge conflicts only in files that `integration.generated` lists
- **THEN** `integration.regenerate` runs, the regenerated files are added, the merge is completed and the gate runs again

#### Scenario: Another file conflicts
- **WHEN** the merge conflicts in a file that is not generated
- **THEN** the branch is pushed without the merge, the issue goes to `build-failed` with the outcome `conflict`, and the message lists the conflicted files

#### Scenario: The merge cannot be probed
- **WHEN** the installed git cannot probe the merge
- **THEN** the result is treated as unknown, not as clean, and the merge is attempted in the working tree with the same outcomes

#### Scenario: The base did not move
- **WHEN** the base branch has no new commits since the build started
- **THEN** nothing is merged and the hand-off is the usual one

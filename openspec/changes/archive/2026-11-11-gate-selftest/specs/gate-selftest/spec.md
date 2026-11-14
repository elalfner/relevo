## ADDED Requirements

### Requirement: One command exercises the gate on seeded cases
`scripts/gate-selftest.mjs` SHALL seed three cases (a failing unit test, a failing browser story, a docs-only change) in a scratch worktree, run the validation gate on each, and report for each case what the gate returned, what the case expects, and whether they agree.

#### Scenario: A run on a Relevo repository
- **WHEN** a person runs the command in a repository with a `relevo.yml` whose platform has a `test` check
- **THEN** the report lists the three cases, with the gate status of each and `ok` or `unexpected` beside it, and the command exits 0 when every case that ran agreed with its expectation and 1 otherwise

#### Scenario: The failing unit test
- **WHEN** the unit case is seeded and the gate runs
- **THEN** the gate is expected to return `red` and the report names the command that failed

#### Scenario: The docs-only change
- **WHEN** the docs case is seeded and the gate runs
- **THEN** the gate is expected to return `green`, and the report says that a CI that skips tests for a docs-only change is checked by the recipe it prints

#### Scenario: A seeded failure the checks do not see
- **WHEN** a failing case is seeded and the gate returns `green`
- **THEN** the report marks the case `unexpected` and says that the check does not run what was seeded

### Requirement: It never touches the base branch and leaves no branch behind
The command SHALL work only in a detached worktree created from the base ref, SHALL remove the worktree at the end, even after a failure, and SHALL NOT create or change any branch, write to the working tree of the repository or push.

#### Scenario: After a run
- **WHEN** the command ends
- **THEN** the list of branches, the base ref and the files of the repository are as they were and no scratch worktree remains

#### Scenario: A run that fails half way
- **WHEN** the gate cannot run for one case
- **THEN** the scratch worktree is still removed and the case is reported `could-not-run`

### Requirement: A case that cannot be seeded is skipped and said
When the stack has no way to seed a case that its checks would run, the command SHALL skip the case and say why, and SHALL NOT count it as a failure.

#### Scenario: A browser story in a stack whose test command runs no browser
- **WHEN** the `test` check of the platform does not run Playwright
- **THEN** the story case is reported `skipped` with the reason, and the other cases run

### Requirement: A repository whose CI is not Relevo's gets instructions
When there is no `relevo.yml`, the platform does not resolve, or the platform has no `test` check, the command SHALL run nothing and SHALL print the three cases as instructions a person can follow, and exit 0.

#### Scenario: No relevo.yml
- **WHEN** the command runs in a repository without `relevo.yml`
- **THEN** it prints each case with the file to add and the result to expect, creates no worktree and exits 0

### Requirement: The report shows how to see the remote CI aggregate
The report SHALL end with the commands to push one scratch branch per case, to read the result of the CI and to delete the branch, and SHALL NOT run them.

#### Scenario: The footer
- **WHEN** the report is printed
- **THEN** it includes, for each case, the branch name `relevo-selftest/<case>` and the command that deletes it from the remote

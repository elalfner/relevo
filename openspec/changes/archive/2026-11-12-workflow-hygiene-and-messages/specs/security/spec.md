## ADDED Requirements

### Requirement: A cache written by a build is saved before the agent starts
A step of a workflow SHALL NOT save a cache after the agent step has run. Caches of downloaded tools SHALL be restored first and saved by their own step immediately after the install and before the agent starts, so nothing the agent does can reach a cache that a later run restores. A tool restored from a cache SHALL be checked against its pinned version before the agent uses it. An action that saves a cache by itself when the job ends (the automatic npm cache of `actions/setup-node`) SHALL be switched off in the templates.

#### Scenario: The agent changes a binary
- **WHEN** the agent overwrites the Bun or OpenSpec files of the job
- **THEN** the cache already holds the copy saved before the agent started, and no step after the agent saves it again

#### Scenario: A template saves a cache late
- **WHEN** a template has a step that saves a cache, or an action that saves one in its post step, after the agent step
- **THEN** a test fails

### Requirement: The light job only reads the runs
The `decide` job MAY have `actions: read` to read the duration of recent builds. It SHALL NOT hold `actions: write`, which only the jobs that start the queue hold (`requeue`, the queue workflow and the ship workflow), and SHALL run no agent and no project code.

#### Scenario: Permissions of the jobs
- **WHEN** the templates are read
- **THEN** `actions: read` appears in `decide` only, and `actions: write` only in the `requeue` job, the queue workflow and the ship workflow, which already start the queue

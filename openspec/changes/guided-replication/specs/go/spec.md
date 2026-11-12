## ADDED Requirements

### Requirement: The recipe of a replicated build is declared in tasks.md
A task of `tasks.md` marked `[replica]` SHALL be a replica of a template, and no agent SHALL decide that a task is a replica. The `## Replication recipe` section SHALL name the template as `group K`, `pattern` or backticked paths. Each replica task SHALL have a `Rename:` line (`old -> new` pairs) and a `Differences:` line (or `none`).

### Requirement: A script checks the recipe before the build
`scripts/replica-plan.mjs check` SHALL validate the recipe with no model, and the specification stage of the build preflight SHALL send the issue back with the reason `missing` when it fails. `group K` SHALL be a group that is not a replica and comes before the replicas; `pattern` SHALL need a `Pattern:` line in the issue.

#### Scenario: A complete recipe
- **WHEN** the recipe names `group 1` and every replica task has a rename map and differences
- **THEN** the check passes and lists the replica tasks

#### Scenario: The differences are not listed
- **WHEN** a replica task has no `Differences:` line
- **THEN** the check names the task and the issue goes back with the reason `missing`

#### Scenario: The template cannot exist
- **WHEN** the recipe names `pattern` and the issue has no `Pattern:`, or names a group that is itself a replica or comes after the replicas
- **THEN** the check names the problem

### Requirement: A replica task is built by its own cheaper launch
`task-groups.mjs` SHALL make every replica task a group of its own, flagged `replica`, and the rule that joins the groups of a change of three tasks or fewer SHALL NOT join them. `go` SHALL launch one `relevo:dev` agent per replica group, in **replica** mode, giving it only the template, the rename map and the differences of that target, the project rules, the profile and the guidance; it SHALL make the checkpoint of the group as for every group.

#### Scenario: Three replicas
- **WHEN** a change has one normal task and three replica tasks
- **THEN** there are four groups, the last three flagged `replica`, and each is launched alone

### Requirement: The model of a replica comes from the ladder and the model plan
`scripts/replica-plan.mjs model` SHALL give a replica the name one below the planned model of the developer in `agents.ladder`, never below `agents.dev.floor`, and the planned model of the developer once the same target failed twice. A developer not on `auto` SHALL keep its configured model for every launch. No configuration key SHALL be added, and no limit SHALL change.

#### Scenario: The first launch
- **WHEN** the developer is planned on `sonnet`, the ladder is `haiku, sonnet, opus` and the floor is `haiku`
- **THEN** the replica runs on `haiku`

#### Scenario: Two failures
- **WHEN** the same replica failed twice
- **THEN** it is built on `sonnet`; a later retry goes up through `model-plan.mjs escalate`

#### Scenario: Already at the floor
- **WHEN** the planned model is the floor
- **THEN** the replica runs on it and the reason says that nothing is saved

#### Scenario: The developer is set in the configuration
- **WHEN** `agents.dev.model` is a name
- **THEN** every replica runs on that name

### Requirement: The template passes the gate and QA before it is replicated
Before the first replica launches, `go` SHALL run the gate and the QA lenses on the work built so far, with the same retries as step 5. A template that does not pass SHALL end the run through the failure path and SHALL NOT be replicated.

#### Scenario: The template passes
- **WHEN** group 1 built the template and the gate and QA pass
- **THEN** the replicas start

#### Scenario: The template is rejected
- **WHEN** QA still rejects it after the retries
- **THEN** no replica is launched and the run fails with the normal reason

### Requirement: Replicated work meets every guard of any other work
Each replica SHALL be checkpointed through `checkpoint.mjs`, SHALL be checked by the gate before the next launch, and SHALL be reviewed by the QA lenses at the end with the rest of the work. The budget check SHALL run before each replica launch.

#### Scenario: A replica touches a protected path
- **WHEN** a replica changes a protected path
- **THEN** its checkpoint is refused and the run takes the failure path

#### Scenario: The cost limit
- **WHEN** the run reaches `run_max_cost` or the budget guard between two replicas
- **THEN** no other replica starts and the work done is kept

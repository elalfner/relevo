## MODIFIED Requirements

### Requirement: A checkpoint is committed and pushed after each group
After each group `go` SHALL commit the files that changed as `wip: checkpoint <k>/<n> (#N)`, with the hash of the issue text and the numbers of the tasks of the group (`Relevo-Tasks:`) as trailers, through the same safe commit as every commit, and push the branch of the issue without force.

#### Scenario: A group finishes
- **WHEN** the developer finishes the tasks of a group
- **THEN** its files are committed as a checkpoint that names the tasks of the group, and the branch is pushed

#### Scenario: The scans refuse a checkpoint
- **WHEN** a protected path, a restricted file, a marker or a credential is found
- **THEN** nothing is pushed and the build takes the failure path with that reason

#### Scenario: A cut after a checkpoint
- **WHEN** the runner cuts the run during the second group
- **THEN** the first group is on the remote branch and the rescue keeps what the second one had done

#### Scenario: A task list that is not task numbers
- **WHEN** the tasks given to the checkpoint are not numbers like `1.1`
- **THEN** the checkpoint is made without the trailer, and no other behaviour changes

### Requirement: A replica task is built by its own cheaper launch
`task-groups.mjs` SHALL make every replica task a group of its own, flagged `replica`, and the rule that joins the groups of a change of three tasks or fewer SHALL NOT join them. `go` SHALL launch one `relevo:dev` agent per replica group, in **replica** mode, giving it only the template, the rename map and the differences of that target, the project rules, the profile and the guidance; it SHALL make the checkpoint of the group as for every group. `replica-plan.mjs template --section K` SHALL find the template of `section K` by the tasks that each checkpoint names, never by the number of a group, so that a resumed run, which numbers its groups again, finds it.

#### Scenario: Three replicas
- **WHEN** a change has one normal task and three replica tasks
- **THEN** there are four groups, the last three flagged `replica`, and each is launched alone

#### Scenario: A resumed build finds the template
- **WHEN** a run built section 1 as group 1 of 4, was cut, and the resumed run lists only the two replica groups
- **THEN** `replica-plan.mjs template --section 1` prints the files of the checkpoint that covered the tasks of section 1

#### Scenario: A checkpoint with no marker
- **WHEN** no checkpoint names a task of the section (made before the marker existed, or a group that changed no file)
- **THEN** the command exits 1 and says so, and `go` has the developer read the checkpoints with `git log`

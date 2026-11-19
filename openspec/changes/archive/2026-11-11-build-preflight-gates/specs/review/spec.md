## MODIFIED Requirements

### Requirement: Synchronise with the base branch first
`review` SHALL bring in the remote copy of the feature branch with a fast-forward pull, then merge the current base branch into it before the person tests, and SHALL re-run QA if either brought anything. When the merge conflicts and every conflicted file is inside the folder of the platform or the change folder, `review` SHALL hand the conflict to the developer agent and run QA before the person tests.

#### Scenario: Base moved
- **WHEN** the base branch has new commits since the build
- **THEN** it is merged into the feature branch, QA re-runs, and a conflict that cannot be resolved cleanly is handled as the scenarios below say

#### Scenario: Branch pushed from another machine
- **WHEN** the remote branch has commits the local one does not
- **THEN** they are brought in before the base is merged, so the person tests the current code

#### Scenario: The agent resolves a conflict
- **WHEN** the merge conflicts in files inside the folder of the platform
- **THEN** the developer agent receives the conflicted files and the scenarios of the issue, keeps the behaviour of both sides and adds a test that fails if either side is lost where the platform allows, QA runs, and the review goes on

#### Scenario: The conflict cannot be resolved
- **WHEN** the developer agent cannot resolve the conflict, or QA still rejects after the retries
- **THEN** `review` aborts the merge, leaves the branch as it was and stops with a clear message that names the conflicted files

#### Scenario: A conflict outside the folder of the platform
- **WHEN** a conflicted file is outside the folder of the platform and the change folder
- **THEN** `review` does not hand it to the developer agent, aborts the merge and stops with a clear message

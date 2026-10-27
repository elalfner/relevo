## MODIFIED Requirements

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

### Requirement: Successful hand-off
On `QA PASSED`, `go` SHALL push the branch, label the issue `built`, and post the hand-off message to the assignee. When the issue was started by skipping the capacity gate because of a valid `urgent` label, the message SHALL say so and SHALL state how many issues the assignee has in `built`.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the issue is `built`, the branch is pushed and the assignee is mentioned once

#### Scenario: Built after an urgent start
- **WHEN** QA passes for an issue that started over the assignee's capacity because of `urgent`
- **THEN** the message tells the assignee that the issue skipped the queue and how many issues are now waiting for their review

## ADDED Requirements

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

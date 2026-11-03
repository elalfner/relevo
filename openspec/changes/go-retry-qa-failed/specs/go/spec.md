## ADDED Requirements

### Requirement: A qa-failed issue without a branch can be retried
When the planner is asked to retry an issue (`--retry`, together with `--only <n>`), it SHALL treat that issue, when it is `qa-failed`, as if it were `ready`: the same gates apply and the claim SHALL move it from `qa-failed` to `building`. It SHALL NOT add or require the `ready` label. In place of the person who applied `ready` it SHALL use the person who runs the retry: only write access, or a maintainer when `trust` is `public`, may retry. It SHALL refuse the retry, changing nothing, when the issue is not `qa-failed` or when a branch `feature/<n>-*` exists on the remote, and the message SHALL send the person to `/relevo:fix <n>` or to delete the branch. The claim SHALL post no comment of its own.

#### Scenario: Retry of a qa-failed issue without a branch
- **WHEN** issue 67 is `qa-failed`, has no remote branch, and a person with write access runs the planner with `--only 67 --retry --apply --claim`
- **THEN** the decision is `start`, the issue loses `qa-failed` and gains `building`, no `ready` label is added and no comment is posted

#### Scenario: A branch exists
- **WHEN** `origin/feature/67-...` exists and the retry is requested
- **THEN** nothing changes and the message says to run `/relevo:fix 67` or to delete the branch

#### Scenario: The issue is not qa-failed
- **WHEN** the retry is requested for an issue that is `built`
- **THEN** nothing changes and the message says that only a `qa-failed` issue can be retried

#### Scenario: The person may not start work
- **WHEN** the person who runs the retry has only read access, or `trust` is `public` and the person is not a maintainer
- **THEN** the decision is `denied` and nothing is claimed

#### Scenario: Gates still apply
- **WHEN** the retried issue has no assignee, no milestone or an incomplete specification
- **THEN** the same decision as for a `ready` issue is returned, and nothing is built

#### Scenario: Without the flag
- **WHEN** the planner runs without `--retry`
- **THEN** a `qa-failed` issue is still ignored

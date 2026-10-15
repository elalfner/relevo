## ADDED Requirements

### Requirement: Issue has two modes chosen by its argument
`issue` SHALL create new issues when its argument is not an issue number, and SHALL update the description of an existing issue when its argument is an issue number (`42` or `#42`). The command `create` SHALL no longer exist.

#### Scenario: Idea given
- **WHEN** the person runs `/relevo:issue add a reset button to the counter`
- **THEN** `issue` follows the creation flow

#### Scenario: Number given
- **WHEN** the person runs `/relevo:issue 42`
- **THEN** `issue` reads issue 42 and follows the update flow

#### Scenario: Old name
- **WHEN** the person runs `/relevo:create`
- **THEN** the command is not found, and `README.md` and `think` name `/relevo:issue` instead

### Requirement: Only an issue Relevo has not committed to a build may be edited
Update mode SHALL read the issue and SHALL proceed only when the issue is open and carries no lifecycle label, or carries only `needs-spec`. For an issue closed, or labelled `ready`, `queued`, `blocked`, `building`, `built`, `in-review`, `pr-open`, `qa-failed`, `changes-requested` or `needs-reviewer`, it SHALL change nothing, name the label found, explain that what is written is what `go` builds, and say how to proceed: remove `ready` by hand, edit, and apply `ready` again. It SHALL NOT apply, remove or replace any label.

#### Scenario: Issue ready
- **WHEN** the person runs `/relevo:issue 42` and issue 42 is labelled `relevo:ready`
- **THEN** `issue` refuses, says the text is what `go` builds, tells the person to remove `ready` by hand, edit and apply it again, and edits nothing

#### Scenario: Build in progress
- **WHEN** issue 42 is labelled `relevo:building`
- **THEN** `issue` refuses, says the build must finish or fail first, and edits nothing

#### Scenario: Waiting to start
- **WHEN** issue 42 is labelled `relevo:blocked` or `relevo:queued`
- **THEN** `issue` refuses because `go` starts it without anyone rereading the text

#### Scenario: Already built
- **WHEN** issue 42 is labelled `relevo:built`, `in-review` or `pr-open`
- **THEN** `issue` refuses and edits nothing

#### Scenario: Returned to the spec writer
- **WHEN** issue 42 is labelled `relevo:needs-spec`
- **THEN** `issue` proceeds with the update flow and leaves the label as it is

#### Scenario: Not started
- **WHEN** issue 42 is open and has no lifecycle label
- **THEN** `issue` proceeds with the update flow

#### Scenario: Closed issue
- **WHEN** issue 42 is closed
- **THEN** `issue` refuses and edits nothing

#### Scenario: Issue does not exist
- **WHEN** `gh issue view` reports that issue 99 does not exist
- **THEN** `issue` says so and edits nothing

### Requirement: Updating starts from the current text and asks only what changes
In update mode `issue` SHALL start from the current body, SHALL ask only what the person wants to change, SHALL keep every part they did not mention, and SHALL NOT invent scenarios or edge cases.

#### Scenario: One scenario changes
- **WHEN** the person says one `THEN` is wrong
- **THEN** only that scenario is rewritten and the rest of the body is unchanged

### Requirement: An updated issue passes the same check and needs explicit approval
Before applying anything, `issue` SHALL run `check-issue.mjs` on the new body and SHALL show the person the new text next to the current one. It SHALL apply the new body with `gh issue edit --body-file` only after an explicit approval, SHALL read the issue's labels again immediately before applying, and SHALL change nothing if they no longer allow the edit.

#### Scenario: Update fails the check
- **WHEN** the edited body has no edge case
- **THEN** `issue` says what is missing, asks for it and edits nothing

#### Scenario: Not approved
- **WHEN** the person asks for further changes
- **THEN** `issue` revises the draft, checks it, shows it again and edits nothing

#### Scenario: Approved
- **WHEN** the person approves a draft that passes the check
- **THEN** `issue` replaces the body of the issue, leaves its title, labels, milestone and assignee as they were, and prints its link

#### Scenario: Labels changed meanwhile
- **WHEN** issue 42 gained `relevo:ready` after the person started editing
- **THEN** `issue` applies nothing and explains the refusal as above

### Requirement: Dependencies are rechecked on update
On update `issue` SHALL verify that every `Depends-on: #N` in the new body names an existing issue other than the one being edited.

#### Scenario: Dependency does not exist
- **WHEN** the new body contains `Depends-on: #999` and issue 999 does not exist
- **THEN** the dependency check fails, `issue` says which line, and edits nothing

#### Scenario: Depends on itself
- **WHEN** the body of issue 42 contains `Depends-on: #42`
- **THEN** the dependency check fails and nothing is edited

# issue Specification

## Purpose
The skill that writes the issues Relevo builds and updates the description of an existing one while Relevo has not committed to building it.

## Requirements

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

### Requirement: Issue turns an idea into an issue Relevo can build
`issue` SHALL help a person turn an idea, a conversation or an OpenSpec exploration into one or more issues that satisfy the issue format, so that `go` never has to ask a question or guess.

#### Scenario: Starting from a `think` agreement
- **WHEN** the person runs `issue` after `think`, in the same conversation or with the path of a saved agreement
- **THEN** `issue` takes the decided scenarios, edge cases, dependencies and splits as answered and asks only about the open questions

#### Scenario: Starting from earlier context
- **WHEN** the person runs `issue` after discussing the feature, or while a change exploration exists in the repository
- **THEN** `issue` summarises in a few lines what it already knows and asks only about what is still missing

### Requirement: Questions are asked only for what is missing
`issue` SHALL ask about scenarios, edge cases, dependencies on other work, screens and behaviour when the feature has a visible part, and data contracts when it reads or writes data, and SHALL NOT ask what the earlier context already answers. It SHALL NOT invent scenarios or edge cases the person did not give.

#### Scenario: Behaviour is unclear
- **WHEN** the person's answer leaves the visible behaviour ambiguous
- **THEN** `issue` asks a follow-up question instead of writing an assumption into the scenarios

### Requirement: Dependencies are explicit
When the feature needs work that does not exist yet in this repository or elsewhere, `issue` SHALL ask whether an issue already covers it. If one does, it SHALL record `Depends-on: #N`. If none does, it SHALL offer to draft that work as a separate issue and link the two.

#### Scenario: Work in another issue
- **WHEN** the person says the data comes from work tracked in issue 12
- **THEN** the new issue contains `Depends-on: #12`

#### Scenario: Work nobody has written yet
- **WHEN** the feature needs a piece of work with no issue
- **THEN** `issue` offers to write that piece as its own issue first and links the second to it

### Requirement: One issue, one buildable unit
`issue` SHALL propose splitting a feature that cannot be reviewed on one device pass, and SHALL give every resulting issue its own scenarios and edge cases, with the order expressed through `Depends-on`.

#### Scenario: Large feature
- **WHEN** the feature spans work that can be built and verified separately
- **THEN** `issue` proposes several issues and the person decides how many to create

### Requirement: Issues are checked before they are created
Before creating anything, `issue` SHALL check each draft with the same rules `go` applies: at least one complete scenario, at least one edge case, no leftover template text, no emoji in the title, a title of at most 72 characters, and nothing that looks like a credential.

#### Scenario: Missing edge cases
- **WHEN** a draft has no edge case
- **THEN** the check fails, `issue` says what is missing and does not create the issue

#### Scenario: Credential in the text
- **WHEN** a draft contains something that looks like a credential
- **THEN** the check fails and the issue is not created

### Requirement: Approval before creation
`issue` SHALL show every draft in full together with its milestone, assignee and order, and SHALL create issues only after the person approves them explicitly.

#### Scenario: Not approved
- **WHEN** the person asks for changes
- **THEN** `issue` revises the drafts and shows them again, and nothing is created

### Requirement: Milestone and assignee
`issue` SHALL ask which milestone each issue belongs to and who will develop it, offering the open milestones and the members from `relevo.yml`, and SHALL create a milestone only when the person asks.

#### Scenario: Milestone does not exist
- **WHEN** the person names a milestone that does not exist
- **THEN** `issue` asks whether to create it and does so only on a yes

### Requirement: Issue never starts a build
`issue` SHALL NOT apply the `ready` label. Applying it is the writer's explicit decision that the specification is finished, and it is what starts `go`.

#### Scenario: Issues created
- **WHEN** the issues have been created
- **THEN** `issue` lists their links, reminds the person that `go` starts when `ready` is applied, and applies no lifecycle label

### Requirement: Issue respects the language setting
`issue` SHALL write the issues in the language set by `language` in `relevo.yml`, unless the person asks for another, and SHALL keep the `WHEN`, `THEN` and `Depends-on` keywords in English because `go` reads them.

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the issue text is in Spanish and the keywords `WHEN` and `THEN` stay in English

### Requirement: The issue carries the documentation the agreement settled
When the agreement hands over terms or decision records, `issue` SHALL add an optional `## Documentation` section to the issue with the exact text of each: glossary entries to add to `GLOSSARY.md`, and decision records to add to `docs/adr/`. The section SHALL name only those two targets. When nothing is handed over, the section SHALL NOT be written.

#### Scenario: Terms handed over
- **WHEN** the agreement lists two settled terms
- **THEN** the issue has a `Documentation` section that tells the builder to add them to `GLOSSARY.md`, after the existing entries, and shows each entry with its name, definition and words to avoid exactly as agreed

#### Scenario: A decision record handed over
- **WHEN** the agreement lists a decision record
- **THEN** the section shows its title and text, says it goes to `docs/adr/`, and gives no number, because it is numbered when it is written

#### Scenario: Nothing to document
- **WHEN** the agreement says "To document: nothing"
- **THEN** the issue has no `Documentation` section

#### Scenario: A request to document something else
- **WHEN** the person asks the issue to update another file, for example the README
- **THEN** `issue` does not put that in the `Documentation` section, and tells the person that the section only carries the glossary and decision records

### Requirement: The documentation section is shown whole at approval
The `Documentation` section SHALL be part of the draft that the person approves, shown in full like the rest, and SHALL pass the same check as any other issue. The check SHALL accept an issue with or without the section and SHALL NOT count the section as a scenario or an edge case.

#### Scenario: Issue with the section
- **WHEN** a draft has scenarios, edge cases and a `Documentation` section
- **THEN** the check passes and counts only the scenarios and edge cases

#### Scenario: Approval
- **WHEN** the draft has a `Documentation` section
- **THEN** the person sees its full text before approving, and nothing is created without a clear yes

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

### Requirement: Updating keeps the documentation section and its limits
In update mode `issue` SHALL keep an existing `## Documentation` section as it is unless the person asks to change it, SHALL show it whole next to the current text, and SHALL accept in it only glossary entries and decision records, as in creation. The section is part of what `go` builds, so it is covered by the same refusal rules as the rest of the body.

#### Scenario: Section not mentioned
- **WHEN** the person changes one scenario of an issue that has a `Documentation` section
- **THEN** the section is unchanged in the new body and shown whole at approval

#### Scenario: A term changes
- **WHEN** the person says a glossary entry in the section has the wrong definition
- **THEN** only that entry is rewritten and the rest of the section is unchanged

#### Scenario: Another file requested
- **WHEN** the person asks the update to add a README change to the `Documentation` section
- **THEN** `issue` does not add it and says the section only carries the glossary and decision records

### Requirement: The issue names its platform when the repository has several
When `relevo.yml` has more than one platform, `issue` SHALL put a `Platform: <name>` line in every issue it writes. It SHALL deduce the platform from the paths the idea mentions and ask only when it cannot decide. When the repository has one platform it SHALL leave the line out. An idea that needs two platforms SHALL be split into two issues with `Depends-on:`.

#### Scenario: Path decides
- **WHEN** the idea mentions `apps/web/src/Header.vue` and `web` lives at `apps/web`
- **THEN** the issue says `Platform: web` without asking

#### Scenario: Ambiguous idea
- **WHEN** the idea mentions no path and the repository has two platforms
- **THEN** `issue` asks which platform it is for, once

#### Scenario: Idea for two platforms
- **WHEN** the idea needs a change in `web` and one in `api`
- **THEN** `issue` proposes two issues, each with its `Platform:` line, the front depending on the back

### Requirement: A draft without a needed platform fails the check
The check of an issue SHALL fail a draft that needs the `Platform:` line and lacks it, that names an unknown platform, or that names two. It SHALL pass an issue for a one-platform repository without the line.

#### Scenario: Missing line
- **WHEN** the repository has two platforms and the draft has no `Platform:` line
- **THEN** the check fails and lists the platforms

#### Scenario: Unknown platform
- **WHEN** the draft says `Platform: mobile`
- **THEN** the check fails, names `mobile` and lists the platforms that exist

#### Scenario: One platform
- **WHEN** the repository has one platform and the draft has no line
- **THEN** the check passes

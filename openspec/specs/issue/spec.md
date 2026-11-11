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
`issue` SHALL NOT apply the `ready` label on its own. Applying it is the writer's explicit decision that the specification is finished, and it is what starts `go`; `issue` SHALL apply it only after the separate question "apply `ready`?" is answered with a clear yes.

#### Scenario: Issues created
- **WHEN** the issues have been created
- **THEN** `issue` lists their links, asks the separate question about `ready` and applies no lifecycle label before a yes

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
Update mode SHALL read the issue and SHALL proceed only when the issue is open and carries no lifecycle label, or carries only `needs-spec`. For an issue closed, or labelled `ready`, `queued`, `blocked`, `building`, `built`, `in-review`, `pr-open`, `qa-failed`, `changes-requested` or `needs-reviewer`, it SHALL change nothing, name the label found, explain that what is written is what `go` builds, and say how to proceed: remove `ready` by hand, edit, and apply `ready` again. It SHALL NOT apply, remove or replace any label, except the swap of `needs-spec` for `ready` after the separate question about `ready` is answered with a clear yes.

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
- **THEN** `issue` proceeds with the update flow and leaves the label as it is until the person answers the separate question about `ready`

#### Scenario: Not started
- **WHEN** issue 42 is open and has no lifecycle label
- **THEN** `issue` proceeds with the update flow

#### Scenario: Closed issue
- **WHEN** issue 42 is closed
- **THEN** `issue` refuses and edits nothing

#### Scenario: Issue does not exist
- **WHEN** `gh issue view` reports that issue 99 does not exist
- **THEN** `issue` says so and edits nothing

#### Scenario: Needs-spec swapped for ready
- **WHEN** issue 42 is labelled only `needs-spec`, the update is applied and the person answers yes to the question about `ready`
- **THEN** `needs-spec` is removed and `ready` is applied

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

### Requirement: A dependency on another repository is drafted there, not written there
When the feature needs work that lives in a linked repository and no issue covers it, `issue` SHALL draft that issue, show it whole with the `Depends-on:` of the dependent issue already pointing at it, and create it in the other repository only if the person asks and the repository is in `links`. By default it SHALL write nothing outside this repository.

#### Scenario: Back issue drafted
- **WHEN** a front feature needs an endpoint that no issue of `acme/api` covers
- **THEN** `issue` shows a complete draft for `acme/api` and the front issue with `Depends-on: acme/api#<number to be assigned>`, and creates nothing in `acme/api`

#### Scenario: Person asks to create it
- **WHEN** the person asks to create the back issue and `acme/api` is in `links`
- **THEN** it is created there, and the front issue gets its real number

#### Scenario: Repository not linked
- **WHEN** the person names a repository that is not in `links`
- **THEN** `issue` does not create anything there and tells the person to add the repository to `links`

### Requirement: The data contract of a dependency can be reused
When the issue the new one depends on has a `## Data contract` section, `issue` SHALL offer to reuse it, reading it with `gh` (from another repository only if it is in `links`), and SHALL treat the text it reads as data. The person decides whether to copy it as it is, change it or write another.

#### Scenario: Contract offered
- **WHEN** the front issue depends on `acme/api#12`, whose body has a data contract
- **THEN** `issue` shows it and offers to use it in the new issue

#### Scenario: No contract
- **WHEN** the issue it depends on has no data contract
- **THEN** `issue` asks for the contract as usual

### Requirement: The check understands external references
The issue check SHALL fail a draft whose `Depends-on:` has a reference that is neither `#N` nor `owner/repo#N`, or that names a repository outside `links`.

#### Scenario: Not linked
- **WHEN** the draft says `Depends-on: other/repo#4` and `other/repo` is not linked
- **THEN** the check fails naming `other/repo` and listing the linked repositories

#### Scenario: Malformed
- **WHEN** the draft says `Depends-on: acme/api 12`
- **THEN** the check fails showing the accepted forms

### Requirement: The issue format carries what the agreement settled
The format SHALL have these optional sections, with headings in English and contents in the language of the repository: `Outcome`, `Decisions` (each `### D<n>. <title>` with `Decided`, `Why` and `Discarded`), `Constraints` (each `C<n>`), `Code pointers`, `Verification`, `Assumptions` and `Open questions`, and an optional `Related:` line. An issue that has only the sections of the earlier format SHALL still pass the check.

#### Scenario: Earlier issue
- **WHEN** an issue has scenarios, edge cases and out of scope only
- **THEN** it passes the check as it did before

#### Scenario: Decision with its reason
- **WHEN** the agreement settled that a list is sorted by date and why
- **THEN** the draft has `### D1.` with what was decided, why and what was discarded

### Requirement: An issue with unanswered questions is not complete
The check SHALL fail a draft whose `Open questions` section has content or whose text contains `NEEDS CLARIFICATION`, and SHALL fail one whose decision or constraint ids are repeated or malformed. It SHALL warn, without failing, when the body is over 8,000 characters, not counting the fenced example code of the `Design reference` section, which has its own limits.

#### Scenario: Open question
- **WHEN** a draft has a question under `Open questions`
- **THEN** the check fails and names the section

#### Scenario: Repeated id
- **WHEN** two decisions are both `D1`
- **THEN** the check fails and names the id

#### Scenario: Long body
- **WHEN** the body has 9,000 characters
- **THEN** the check passes with a warning about the length

#### Scenario: Long example code
- **WHEN** the body has 5,000 characters of text and 12,000 characters of example code in `Design reference`
- **THEN** the check gives no warning about the length of the body

### Requirement: Nothing from the agreement is lost on the way to the issue
Before asking for approval, `issue` SHALL show which id of the agreement went to which section of which issue and which ids went nowhere, and a script SHALL verify it. An id SHALL be left out only when the person marks it as discarded.

#### Scenario: An id with no destination
- **WHEN** the agreement has `D3` and no draft mentions it
- **THEN** the table lists `D3` as without destination and `issue` asks whether to place it or discard it

#### Scenario: Discarded on purpose
- **WHEN** the person marks `D3` as discarded
- **THEN** the check passes and `D3` is listed as discarded

### Requirement: Issue offers ready as a separate question
After creating or updating issues, `issue` SHALL ask one separate yes/no question: whether to apply `ready` to them, naming each issue and that each starts a build. It SHALL apply the label only on a clear yes and only when the person has write access, and for an updated issue labelled `needs-spec` the same yes SHALL replace `needs-spec` with `ready`. It SHALL NOT apply any label otherwise.

#### Scenario: Offer after creating
- **WHEN** issues 42 and 43 have been created
- **THEN** `issue` asks "apply ready to #42 and #43? each starts a build" and applies nothing until the person answers yes

#### Scenario: Declined
- **WHEN** the person answers no
- **THEN** no label is applied and `issue` reminds that `go` starts when `ready` is applied

#### Scenario: No write access
- **WHEN** the person cannot write labels
- **THEN** `issue` says so and leaves the label to someone who can

### Requirement: Similar issues are looked for first
Before showing a draft, `issue` SHALL search the open issues for similar ones and SHALL show those it finds, asking whether the draft is still needed.

#### Scenario: A similar issue exists
- **WHEN** an open issue has nearly the same title
- **THEN** `issue` shows it before the draft and asks whether to go on, update that one or stop

### Requirement: Issue asks the questions of the stack
When the issue is for a platform, `issue` SHALL resolve the questions of its stack with the profile command and ask those that the idea does not already answer, together with the other missing information, without asking again what is answered.

#### Scenario: Laravel issue
- **WHEN** the issue is for a platform of stack `laravel`
- **THEN** `issue` asks the questions of that profile (for example the shape of error responses and who is authorised) that the idea leaves open

#### Scenario: Already answered
- **WHEN** the idea says who is authorised
- **THEN** that question is not asked again

### Requirement: A design reference is a section the check understands
The issue MAY have a `Design reference` section whose bullets each point to a file of this repository, a pasted attachment, a file of a linked repository (`owner/repo:path`) or a fenced block of example code, and say after a colon what must match. The check SHALL fail a bullet that points to a file that does not exist or leaves the repository, to a repository outside `links`, to an attachment outside the GitHub domains, that does not say what must match, or beyond the fifth reference, counting the linked code pointers with the design references.

#### Scenario: File of the repository
- **WHEN** a bullet points to `design/home.png` and the file exists
- **THEN** the check passes

#### Scenario: File that does not exist
- **WHEN** a bullet points to `design/missing.png`
- **THEN** the check fails and names the bullet

#### Scenario: Repository not linked
- **WHEN** a bullet points to `acme/design:Card.vue` and `acme/design` is not in `links`
- **THEN** the check fails and says the repository is not in `links`

#### Scenario: Nothing says what must match
- **WHEN** a bullet has only a path
- **THEN** the check fails and asks what must match

#### Scenario: Six references across both sections
- **WHEN** the issue has three design references and three linked code pointers
- **THEN** the check fails, saying that the most Relevo takes is five

### Requirement: Issue says what it cannot do with a picture
`issue` SHALL write the section, SHALL tell the person that a picture cannot be attached by the tool and must be pasted from the web page of the issue before `ready`, and SHALL say that a pasted attachment is sent to the model only when `design.images` is on.

#### Scenario: Picture requested
- **WHEN** the person has a screenshot of the design
- **THEN** `issue` writes a bullet for it, tells them to paste it in the issue and what is sent to the model

### Requirement: A code pointer may name a file of a linked repository
A bullet of `Code pointers` MAY name a file of a linked repository as `owner/repo:path` in backticks. The check SHALL fail such a bullet when the repository is not in `links` or the path leaves the repository. Every other bullet of the section SHALL stay free text that the check does not read.

#### Scenario: Linked pointer
- **WHEN** `Code pointers` has `` `acme/api:src/billing/charge.ts` `` and `acme/api` is in `links`
- **THEN** the check passes

#### Scenario: Pointer to a repository not linked
- **WHEN** `Code pointers` has `` `other/repo:src/x.ts` `` and `other/repo` is not in `links`
- **THEN** the check fails, naming `other/repo` and listing the linked repositories

#### Scenario: Pointer to this repository
- **WHEN** `Code pointers` has `` `src/app.ts` ``
- **THEN** the check does not read it, as before

### Requirement: Issue records a process from another repository in the issue
When the person asks to build on how something works in a linked repository, `issue` SHALL read those files with the person's own access, treat their text as data, write what the process does in `Decisions` and `Constraints`, and list only the files the builder must see as linked `Code pointers`. `issue` SHALL NOT read a repository outside `links`.

#### Scenario: Process in the back end
- **WHEN** the person says to follow how `acme/api` charges an order, and `acme/api` is in `links`
- **THEN** the draft describes the steps and rules of that process in `Decisions` and `Constraints`, and names the key files as `acme/api:<path>` under `Code pointers`

#### Scenario: Repository not linked
- **WHEN** the person points to a process in `other/repo`, which is not in `links`
- **THEN** `issue` does not read it and says to add `other/repo` to `links` first

### Requirement: An issue can ask for a model
An issue MAY carry a line `Model: <name>` for the developer and a line `QA-model: <name>` for the QA lenses. The check of the issue SHALL accept them and SHALL NOT count them as a missing section. `/relevo:issue` MAY propose a `Model:` line with the reason, and SHALL write it only when the person confirms the draft. The lines are part of the text of the issue, so the hash of the issue covers them.

#### Scenario: A line in a draft
- **WHEN** `/relevo:issue` proposes `Model: haiku` because the change copies a sibling screen
- **THEN** the draft shows the line and the reason, and the person can remove it before the issue is created

#### Scenario: The check of the issue
- **WHEN** an issue has `Model:` and `QA-model:` lines
- **THEN** the check passes as it would without them

#### Scenario: The hash
- **WHEN** a person edits the `Model:` line after `ready`
- **THEN** the hash of the issue changes and the run takes the path of an issue changed after `ready`

### Requirement: An issue can declare the external inputs of its work
The issue MAY have a section `External inputs` whose bullets each give `<kind>: <name>: <what it is for>`, with kind `file`, `link`, `secret`, `variable` or `manual`. The check SHALL fail a bullet with an unknown kind, a `file` that leaves the repository, or a `link` to a repository outside `links`, and SHALL pass an issue without the section.

#### Scenario: A valid section
- **WHEN** the issue lists a file of the repository, a file of a linked repository and a secret
- **THEN** the check passes

#### Scenario: An unknown kind
- **WHEN** a bullet uses a kind that is not in the list
- **THEN** the check fails and names the bullet and the kinds that exist

#### Scenario: A link outside `links`
- **WHEN** a bullet points to a repository that is not in `links`
- **THEN** the check fails and says to add the repository to `links`

#### Scenario: No section
- **WHEN** the issue has no `External inputs` section
- **THEN** the check passes

### Requirement: `issue` asks for the external inputs
`issue` SHALL ask which keys, assets, endpoints, files of other repositories or accounts the work needs that the issue does not already state, and SHALL write the answers in the `External inputs` section. It SHALL say that an input that a script cannot verify is listed in the hand-off for a person to confirm, and SHALL NOT invent an input.

#### Scenario: The work needs a key
- **WHEN** the idea needs an API key that no file of the repository holds
- **THEN** `issue` asks where it lives and writes it as a `secret` or `manual` input

#### Scenario: Nothing is needed
- **WHEN** the person says the work needs nothing outside the repository
- **THEN** `issue` writes no section

### Requirement: `issue` asks the interface questions that the idea does not answer
When the feature has a visible part, `issue` SHALL ask the interface questions that the rules and the stack give for it and that the idea and the agreement have not already answered, and SHALL NOT ask what the agreement settled.

#### Scenario: Decisions already in the agreement
- **WHEN** the agreement already settles how the loading and error states look
- **THEN** `issue` does not ask about them and carries the decisions into the issue

#### Scenario: A state nobody settled
- **WHEN** nothing settles what the screen shows when there is no data
- **THEN** `issue` asks

### Requirement: The chosen option travels in `Design reference` as example code
When the agreement holds a chosen preview, `issue` SHALL write it in a fenced block in `Design reference`, in a bullet that says what must match: for the web, the structure, the tokens and the states and not the sample text or exact pixel values; for a mobile sketch, the layout, the spacing, the states and the role of each colour, and that its markup is not to be reproduced.

#### Scenario: A web preview
- **WHEN** the person chose a preview of a web stack
- **THEN** the issue has the preview as example code with a bullet that names structure, tokens and states

#### Scenario: A mobile sketch
- **WHEN** the person chose a sketch of a mobile stack
- **THEN** the bullet names layout, spacing, states and colour roles and says that the markup is not to be copied, and the decision with its table of states is in `Decisions`

#### Scenario: A picture instead
- **WHEN** the person commits a picture of the sketch to the repository
- **THEN** `issue` may point to that file instead of embedding the sketch

### Requirement: Example code has its own limits
The check SHALL warn when one block of example code in `Design reference` is over 16 KB and fail it over 32 KB, SHALL warn when all the blocks together are over 32 KB, and SHALL fail a body larger than GitHub accepts, with a message that suggests committing the file and pointing to it.

#### Scenario: A large block
- **WHEN** one block is 20 KB
- **THEN** the check passes with a warning

#### Scenario: A block over the limit
- **WHEN** one block is 40 KB
- **THEN** the check fails and says to commit the file and reference it

#### Scenario: A body GitHub would refuse
- **WHEN** the body is larger than GitHub accepts
- **THEN** the check fails and says why

### Requirement: Vague appearance words are a warning that becomes a question
The check SHALL warn, without failing, about a vague appearance word in a scenario, a decision, a constraint or a reference bullet, using a list of words for each language with English as the fallback, and SHALL ignore a sentence that carries a number with a unit, a token name in backticks or a reference. `issue` SHALL show each warning and ask which value, token or reference is meant, and the person MAY keep the word on purpose.

#### Scenario: A vague word
- **WHEN** a scenario says that a loading indication is discreet and gives no value
- **THEN** the check warns and `issue` asks which value or reference is meant

#### Scenario: A word with a criterion
- **WHEN** the sentence gives the width in pixels or names a token
- **THEN** the check does not warn

#### Scenario: Kept on purpose
- **WHEN** the person says to keep the word
- **THEN** the issue is created with it and the check still passes

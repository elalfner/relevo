# Writing an issue Relevo can build

English · [Español](issue-format.es.md)

Relevo builds an issue without asking anyone questions, so the issue must already say what "done" means. `/relevo:go` checks three things before it starts, and sends the issue back to its writer if one fails.

## What the issue must contain

### 1. Scenarios, as WHEN / THEN pairs

Each scenario is one `WHEN` line (the situation) and one `THEN` line (the observable result). `GIVEN` also works for the situation. Bold markers and list bullets are optional.

```markdown
## Scenarios

- **WHEN** the user opens the summary and there are 3 clients with birthdays today
- **THEN** the list shows the 3 names, each with a send button

- **WHEN** nobody has a birthday today
- **THEN** the screen says "Nobody has a birthday today"
```

A `WHEN` with no `THEN` does not count.

### 2. Edge cases, as a list under an "Edge cases" heading

```markdown
## Edge cases

- a client without a phone number: the send button is disabled and says "no phone"
- 29 February in a year that is not a leap year: shown on 28 February
- no network: the last saved list is still shown
```

The heading may be written `Edge cases`, `Edge case`, or `Casos borde` / `Casos límite`. Only the list items directly under that heading are counted.

### 3. Dependencies (optional)

```markdown
Depends-on: #12, #13
```

An issue of another repository is written `owner/repo#12`, and the repository must be listed in `links` of `relevo.yml` (a repository outside the list sends the issue back to the spec writer). A private repository is read with the read-only secret `RELEVO_LINKS_TOKEN`; a public one needs none. The issue waits until the other one is closed as completed, and notices on the queue's schedule, because events do not cross repositories.

```markdown
Depends-on: #3, acme/api#12
```

The issue is not started until every listed issue is closed as completed (its pull request merged). Until then it is labelled blocked and starts by itself afterwards.

### 4. Documentation (optional)

When the spec writer settled terms or decisions that must be recorded, the issue carries them in a `## Documentation` section, with the exact text. `go` has the developer write that text and the files arrive in the same pull request as the feature, so nobody has to commit documentation by hand.

```markdown
## Documentation

- Add these entries to `GLOSSARY.md`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**Build number**:
The number after the `+` in the `version` of `pubspec.yaml`, shown in the app bar subtitle as "Build N".
_Avoid_: Build label, build, build version
```

A glossary entry is a name, a definition of one or two sentences and the words to avoid. A decision record is a title and a text, without a number: it is numbered when it is written (the highest number in `docs/adr/` plus one). The section names only `GLOSSARY.md` and `docs/adr/`. It is not a scenario or an edge case, and an issue is valid with or without it.

### 5. Dependency files the change may touch (optional)

An unattended run never changes workflows (`.github/`), `relevo.yml`, `.relevo/`, the folders of skills or the project rules file, and it does not change dependency manifests or lock files (`pubspec.yaml`, `pubspec.lock`, `package.json`, `composer.json` and their lock files) unless the issue says so. When the change needs a new dependency, list the files it may touch:

```markdown
Allow-paths: pubspec.yaml, pubspec.lock
```

Each entry is a path or a pattern (`*` stays inside a folder, `**` crosses folders; a name without a slash matches at any depth). The first group can never be allowed: listing `.github/workflows/ci.yml` or `**` makes the issue fail its check. Without the line, a run that touches a dependency file ends in `qa-failed` with the reason "protected path in the diff".

### 6. Platform (when the repository has several)

When `relevo.yml` declares more than one platform (a front and a back in one repository, say), the issue says which one it is for:

```markdown
Platform: web
```

The name is one of the keys of `platforms` in `relevo.yml`. With one platform the line is optional. An issue belongs to one platform; a feature that needs two is two issues, the front depending on the back with `Depends-on:`. Without the line, or with a name that does not exist, the issue goes back to the spec writer with the list of platforms. An unattended run changes only files inside the folder of the platform (plus the change's own specification, `GLOSSARY.md` and `docs/adr/`); to let it touch a shared folder, list it in `Allow-paths:`.

### 7. What the agreement settled (optional sections)

These sections carry what `/relevo:think` decided beyond the scenarios. `go` copies them word for word into the change's `design.md` under "From the issue: <Section>", and QA rejects a build that breaks a decision or a constraint, citing its id. Headings are always in English; the contents are in the language of the repository.

```markdown
## Outcome
The list shows today's birthdays and nothing else.

## Decisions

### D1. Sort by name
Decided: the list is sorted by name.
Why: people look for a person, not a date.
Discarded: sort by date (nobody asked for it).

## Constraints

- C1: the list loads in under one second with 500 clients.

## Code pointers

- `lib/clients/repository.dart`: where the clients are read.

## Verification

- On a device with the test account "demo", the list scrolls without jumps.

## Assumptions

- Birthdays are read from the clients table.

## Open questions
```

- A decision is `### D<number>. <title>`, a constraint is `- C<number>: <limit>`. Ids are not repeated.
- A code pointer to a file of another repository is written `owner/repo:path` in backticks, and the repository must be in `links` of `relevo.yml`. `go` fetches it for the builder, who reads it as a hint to check, like any pointer. It counts towards the five references of the next section. Write the process it follows in `Decisions` and `Constraints`; the pointer only names the files the builder must see.
- **`Open questions` blocks the build.** An issue that has a question there, or the text `NEEDS CLARIFICATION` anywhere, fails the check and goes back to its writer as ambiguous. Answer the question and delete the section.
- `Related: #14, #15` lists issues of the same idea. It only informs; `Depends-on:` is what blocks.
- A body of more than about 8,000 characters passes with a warning: shorter, well delimited issues build better.

### 8. Design reference (optional)

When the screen has to look like something, point to it. One bullet per reference, at most five together with the code pointers of other repositories, each saying after the colon what must match (structure, spacing, typography, colour, states):

```markdown
## Design reference

- `design/home.png`: structure, spacing and colour of the list
- https://github.com/user-attachments/assets/0a1b2c3d-1111-2222-3333-444455556666: the empty state
- `acme/design:components/Card.vue`: the card to reuse; keep its states
```

- A file of this repository is written in backticks and must exist; it is always available to the builder.
- A file of another repository is written `owner/repo:path`, and the repository must be in `links` of `relevo.yml`. It may be text up to 200 KB or a PNG, JPEG, GIF or WebP image up to 5 MB, and it does not depend on `design.images`: it was committed on purpose. A private repository is read in the cloud with the secret `RELEVO_LINKS_TOKEN`, which needs read access to its contents.
- A picture is pasted into the issue from its web page (GitHub has no way to attach one from a tool) and GitHub writes the link. It is downloaded and shown to the model only when `design.images` is `true` in `relevo.yml`, because a screenshot can show customer data. Otherwise commit the picture to the repository and point to the file.
- Example code goes in a fenced block in the same section.
- `go` copies the section to the design, adds a scenario "Matches the reference <name>" for each bullet, and QA checks the code against it. In the review that scenario is a line you confirm by looking at your screen. If a reference cannot be fetched, the issue goes back to its writer saying which one.

**A preview chosen in `think`.** When you chose one of the HTML previews that `think` drew, `issue` writes it here as example code, in a bullet that says what must match. For the web: the structure, the tokens and the states, not the sample text or exact pixel values. For a mobile sketch: the layout, the spacing, the states and the role of each colour, and that its markup is not to be reproduced (the sketch is approximate, not a render of the app); the decision with its table of states goes in `Decisions`.

````markdown
## Design reference

- Preview A (approved in `think`): the structure, the tokens `--app-primary` and `--app-surface`, and the five states; not the sample names

```html
<!-- Proposal: option A. Tokens: --app-primary (lib/theme/colors.dart:3) -->
<main>…</main>
```
````

Limits of example code, which has its own: it is not counted for the 8,000-character warning of the text. One block over 16 KB gets a warning and over 32 KB fails, all the blocks together over 32 KB get a warning, and a body over 65,536 characters (what GitHub accepts) fails. For a larger file, commit it and point to it with a bullet, or commit a picture of the sketch and point to that.

**Vague appearance words.** The check warns, and never fails, when a scenario, decision, constraint or reference bullet says how something should look without saying what to build (for example "discreet", "modern", "clean"). `issue` shows each warning and asks which value, token or reference is meant. A sentence that gives a number with a unit, a token in backticks or a reference is not flagged. If you mean the word, say so and it stays. The lists exist for English and Spanish; any other language uses the English list.
### 9. External inputs (optional)

When the work needs something that is not in the repository (a key, a file, an endpoint, another repository), say so. A script checks what it can before the build starts, so that the issue does not spend a build and a retry on something that cannot succeed:

```markdown
## External inputs

- file: `design/logo.svg`: the logo of the login screen
- link: `acme/api:schema/schema.graphqls`: the schema that the types are generated from
- secret: `RECAPTCHA_SITE_KEY`: the key of the login screen
- variable: `API_URL`: the address of the backend
- manual: the terms of use: the client sends the text
```

- One bullet per input, `<kind>: <name>: <what it is for>`. The kinds are `file` (a path of this repository), `link` (`owner/repo:path` of a linked repository), `secret` and `variable` (the name of a secret or a variable of the repository) and `manual` (anything a person has to confirm).
- `file` must exist on the base branch when the build starts, and a `link` names a repository that is in `links` of `relevo.yml`. Write a path, an `owner/repo:path` and the name of a secret or a variable in backticks.
- Write the **name** of a secret or a variable, never its value. Only its presence is checked, and the value is never read, printed or stored. A name that is not in backticks is refused, because a long name looks like a value to the credential scan.
- `manual` never blocks the build: the hand-off lists it for a person to confirm. An input of a kind that the build job cannot check (a secret that the job cannot see, for example) is treated the same way.
- A missing input sends the issue back to `needs-spec` with the reason `inputs`, before the agent starts and without spending a model turn. The comment names each missing input.
- The section is optional. `/relevo:issue` asks for the inputs of the work and writes it.

### 10. Contradictions with the project rules (checked, nothing to write)

Before the issue is created, and again before a build spends a model turn, a script compares each line of `## Out of scope` with the project rules (`qa.rules_from`) and with the issue's own scenarios. When an `Out of scope` line excludes something that a rule requires, or limits something that a scenario needs, the issue goes back to its writer with both lines quoted (the file and line of the rule, the scenario and the limit). The script never decides which one wins: you do.

- To change the issue, edit the line or the scenario.
- To override the rule on purpose, record it in a decision: add the line `Overrides: CLAUDE.md:12` (the file and line of the rule) inside a `### D<n>.` block under `## Decisions`. The check then skips that rule, and QA follows the decision.
- A rule is a requirement unless the rules file marks it as advice: write `[advice]` on its line, or on a heading to mark everything under it. A rule marked `[advice]` never blocks, and a finding that is only about it (its text repeats the words of the line) is a note; a finding of the `spec`, `security` or `code` reviewer that describes another problem still blocks even when it cites an advice line.

A rule that the issue does not override still blocks in QA: a lens that finds a change breaking one cites it as `Rule: <file>:<line> "<its words>"`, and the build fails even when the finding comes from the `interface` lens on the last attempt.

### 11. Protected paths and unconfirmed names (warned, nothing to write)

While you write the issue, a script warns about two things and never fails the check: a path that an unattended run does not change (the rules file, a workflow, `relevo.yml`, a skill folder, or a dependency manifest that no `Allow-paths:` line covers) that a line asks to change or, for the hard ones, only names; and an assumption under `## Assumptions` about something outside the repository (a permission, endpoint, field or claim, written in backticks) that no file of the repository holds. The lines of `Out of scope`, `Code pointers`, `Design reference`, `External inputs`, fenced code and lines that say "do not change" are not read.

- For a protected path: a person makes that edit and the issue leaves it out, or the task is rewritten so that nothing needs it; for a dependency manifest, also list it in `Allow-paths:`. A hard path cannot be listed there, and the check says why. If the build gets that far, the specification check and the commit guard still stop the change, and the comment names the policy ("an unattended run cannot edit this file").
- For an unconfirmed name: confirm it and write it in `Data contract`, `Decisions` or `Constraints`; or keep it as a `manual` input in `External inputs`, so the build goes on and the hand-off lists it under "Assumed, not confirmed"; or write it under `## Open questions`, so the build waits until a person answers.

The hand-off also lists, under "Shared code touched", the files of the build that more than one file imports or that live in a shared folder (`components/`, `shared/`, `common/`...). It is information for the reviewer; nothing is blocked.

## What `go` also needs from the issue

- **A milestone.** The milestone is the batch the issue belongs to.
- **An assignee.** That person receives the built work and reviews it on a device.
- **The ready label**, applied by someone with write access to the repository, once the spec is finished.

If any of these is missing, nothing is built and a comment says which one.

## What `go` never does

It never invents scenarios or edge cases. If they are missing, the issue goes back to the spec writer with a list of what is missing.

Anything in the issue that is ambiguous in a way that changes the visible behaviour is treated as a spec defect, not guessed. Small ambiguities are resolved with a reasonable assumption that is written down in the change's `design.md`.

### 9. The model for this issue (optional)

When a role of `agents` in `relevo.yml` is `auto`, the issue may ask for a model with one line each, outside any fenced block:

```markdown
Model: haiku
QA-model: sonnet
```

`Model:` is for the developer and `QA-model:` for every QA lens. The value is a single model name of `agents.ladder`. It can lower the model freely and can raise it only up to the ceiling of the role; a name that is not in the ladder is ignored, and with `trust: public` the lines are ignored. A role that is not `auto` keeps the model written in `relevo.yml`. The check of the issue accepts the lines and only warns about one that cannot be read. They are part of the text, so editing one after `ready` changes the hash of the issue. See [Choosing the model for each issue](configuration.md#choosing-the-model-for-each-issue-auto).

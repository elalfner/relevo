# Writing an issue Relevo can build

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

The issue is not started until every listed issue is closed as completed (its pull request merged). Until then it is labelled blocked and starts by itself afterwards.

## What `go` also needs from the issue

- **A milestone.** The milestone is the batch the issue belongs to.
- **An assignee.** That person receives the built work and reviews it on a device.
- **The ready label**, applied by someone with write access to the repository, once the spec is finished.

If any of these is missing, nothing is built and a comment says which one.

## What `go` never does

It never invents scenarios or edge cases. If they are missing, the issue goes back to the spec writer with a list of what is missing.

Anything in the issue that is ambiguous in a way that changes the visible behaviour is treated as a spec defect, not guessed. Small ambiguities are resolved with a reasonable assumption that is written down in the change's `design.md`.

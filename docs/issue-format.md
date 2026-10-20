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

### 4. Documentation (optional)

When the spec writer settled terms or decisions that must be recorded, the issue carries them in a `## Documentation` section, with the exact text. `go` has the developer write that text and the files arrive in the same pull request as the feature, so nobody has to commit documentation by hand.

```markdown
## Documentation

- Add these entries to `GLOSSARY.md`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**Build number**:
The number after the `+` in the `version` of `pubspec.yaml`, shown in the app bar subtitle as "Build N".
_Avoid_: Build label, build, build version
```

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

A glossary entry is a name, a definition of one or two sentences and the words to avoid. A decision record is a title and a text, without a number: it is numbered when it is written (the highest number in `docs/adr/` plus one). The section names only `GLOSSARY.md` and `docs/adr/`. It is not a scenario or an edge case, and an issue is valid with or without it.

## What `go` also needs from the issue

- **A milestone.** The milestone is the batch the issue belongs to.
- **An assignee.** That person receives the built work and reviews it on a device.
- **The ready label**, applied by someone with write access to the repository, once the spec is finished.

If any of these is missing, nothing is built and a comment says which one.

## What `go` never does

It never invents scenarios or edge cases. If they are missing, the issue goes back to the spec writer with a list of what is missing.

Anything in the issue that is ambiguous in a way that changes the visible behaviour is treated as a spec defect, not guessed. Small ambiguities are resolved with a reasonable assumption that is written down in the change's `design.md`.

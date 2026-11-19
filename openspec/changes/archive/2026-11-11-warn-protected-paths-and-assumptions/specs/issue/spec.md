## ADDED Requirements

### Requirement: The check warns about protected paths that the text names
The check of a draft SHALL warn, and SHALL NOT fail, when the text of the issue names a path that an unattended run does not change: the project rules file, a workflow, `relevo.yml`, a skill folder or another hard-protected path, and a dependency manifest that no `Allow-paths:` line covers. It SHALL tell a line that asks for the path to be changed (a verb that changes something before the path) from a path that is only named. A dependency manifest is reported only when a line asks to change it. The sections that only point or exclude (`Out of scope`, `Code pointers`, `Design reference`, `External inputs`), fenced code and a line that says the opposite ("do not change", "never edit") SHALL NOT be read. The decision of what is protected SHALL come from the same code that refuses the path at commit time, not from a model. Each warning SHALL name the path and the line, say why an unattended run cannot change it, and offer the ways out: a person makes the edit and the issue leaves it out, or the task is rewritten so that nothing needs it; for a dependency manifest also an `Allow-paths:` line. `issue` SHALL show every such warning and ask how to proceed before the issue is created.

#### Scenario: A task edits the rules file
- **WHEN** a scenario says the build updates `CLAUDE.md` and `qa.rules_from` is `CLAUDE.md`
- **THEN** the check passes with a warning that names `CLAUDE.md`, that an unattended run never changes it, and the two ways out, and `issue` asks how to proceed

#### Scenario: The rules file is only named in prose
- **WHEN** a line only mentions `CLAUDE.md` with no verb that changes it
- **THEN** the check warns that the file is protected and does not fail

#### Scenario: A dependency manifest that is allowed
- **WHEN** a line asks to add a package to `package.json` and the issue has `Allow-paths: package.json`
- **THEN** the check reports nothing for it

#### Scenario: A dependency manifest that is not allowed
- **WHEN** a line asks to add a package to `package.json` and no `Allow-paths:` line covers it
- **THEN** the check warns and one of the ways out is the `Allow-paths:` line

#### Scenario: A path that can never be allowed in `Allow-paths:`
- **WHEN** `Allow-paths:` lists the rules file or `.github/workflows/ci.yml`
- **THEN** the check fails, naming the entry and saying that workflows, the Relevo configuration, skills and the project rules are not changed by an unattended run

#### Scenario: Only a pointer or an exclusion
- **WHEN** the file appears in `Code pointers`, in `Out of scope` or in a line that says it must not be changed
- **THEN** the check says nothing about it

### Requirement: The check warns about assumptions that name something outside the repository
The check of a draft SHALL read the bullets of `Assumptions`, pick those that name something that exists outside the repository (a permission, endpoint, field, claim, header, role or flag) with a name in backticks, and look for each name in the files of the repository outside `openspec/`. An assumption whose names are all found SHALL be dropped from the list; the others SHALL be a warning that quotes the assumption, lists the names that were not found, and offers three ways out: confirm the name now and write it in `Data contract`, `Decisions` or `Constraints`; keep it as a `manual` external input, so the build goes on and the hand-off lists it; or turn it into an open question, so the issue is not built until a person answers. The check SHALL NOT fail because of it. When the repository cannot be searched the assumption SHALL stay on the list.

#### Scenario: A permission name nobody confirmed
- **WHEN** `Assumptions` says the permission `orders.export` is assumed to exist in the backend and the repository has no file with that name
- **THEN** the check warns about it, names `orders.export` and offers the three ways out

#### Scenario: The schema settles it
- **WHEN** the name is found in a file of the repository outside `openspec/`
- **THEN** the check says nothing about that assumption

#### Scenario: An assumption about the repository itself
- **WHEN** an assumption names no outside thing (for example, that the list sorts by date)
- **THEN** the check says nothing

#### Scenario: Not searchable
- **WHEN** the folder is not a git repository
- **THEN** the assumption is still warned about, because the check cannot settle it

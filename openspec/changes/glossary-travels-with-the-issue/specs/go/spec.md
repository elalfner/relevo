## ADDED Requirements

### Requirement: Documentation from the issue is built
When the issue has a `Documentation` section, `go` SHALL add a task for it to the change's `tasks.md`, and the developer agent SHALL write exactly the text the issue gives: glossary entries appended to `GLOSSARY.md` after the existing ones, and each decision record as a new file in `docs/adr/` numbered with the highest existing number plus one. The files SHALL arrive in the same pull request as the rest of the build. When the issue has no such section, no documentation task SHALL be added.

#### Scenario: Glossary entries
- **WHEN** the issue gives two glossary entries
- **THEN** the change has a task for them, and `GLOSSARY.md` ends with those two entries exactly as written and is otherwise unchanged

#### Scenario: A decision record
- **WHEN** the issue gives a decision record and `docs/adr/` already holds records up to `0003`
- **THEN** a file `0004-<short-title>.md` is created with the text of the issue

#### Scenario: No documentation section
- **WHEN** the issue has no `Documentation` section
- **THEN** the change has no documentation task and `GLOSSARY.md` and `docs/adr/` are not touched

### Requirement: QA checks that the documentation is what the issue gave
When the issue has a `Documentation` section, QA SHALL compare the lines added to `GLOSSARY.md` and `docs/adr/` with the text in the issue and SHALL reject when they differ or when any other line of those files changed. When the issue has no such section, QA SHALL reject a change that touches those files.

#### Scenario: The agent rewords an entry
- **WHEN** an added glossary entry differs from the issue's text
- **THEN** QA rejects it, citing the entry and the line of the issue

#### Scenario: Other lines of the glossary change
- **WHEN** an existing entry of `GLOSSARY.md` is edited or removed
- **THEN** QA rejects it

#### Scenario: Documentation nobody asked for
- **WHEN** the issue has no `Documentation` section and the diff touches `GLOSSARY.md` or `docs/adr/`
- **THEN** QA rejects it

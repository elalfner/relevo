## ADDED Requirements

### Requirement: Every comment of the bot follows the language
Every comment that a Relevo workflow or script posts on an issue or a pull request SHALL be produced in the language of `language`, including the usage comment and the comments about a run that failed before it decided, that ended without a result, that stopped at a usage limit or that was cut and kept its work. The words SHALL come from the message catalog and be produced by `scripts/render-message.mjs` or, for the usage sentence, by a script that takes its phrases from that catalog, so tests cover them. Data that comes from elsewhere (a finding, a branch name, a detail line of a refused commit) is quoted as it is.

#### Scenario: A run ends without a result in Spanish
- **WHEN** `language` is `es` and a run ends without an outcome
- **THEN** the comment on the issue is in Spanish, with the same commands and the same labels as in English

#### Scenario: The scripts cannot be run
- **WHEN** the scripts of the package are not available at all (the install step failed) so the message cannot be rendered
- **THEN** the workflow posts the English sentence it carries as a last resort and the step still succeeds

### Requirement: A missing language key fails the build of Relevo
The renderer SHALL use the English text when a supported language lacks a message or a phrase, and a test SHALL fail when any supported language lacks a key of the English catalog, has a key English does not have, or uses different placeholders in a line.

#### Scenario: A key is added only in English
- **WHEN** a message kind is added to the English catalog and not to Spanish
- **THEN** the test fails and names the kind and the language, and a message of that kind in Spanish still renders in English

#### Scenario: A placeholder differs
- **WHEN** the Spanish text of a line uses a placeholder the English line does not have
- **THEN** the test fails and names the kind

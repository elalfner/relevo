## ADDED Requirements

### Requirement: A profile can carry sections for each lens
A profile MAY have the sections `Security for the developer` and `Security review`, besides the sections it already has. The profile command SHALL print, for a lens, only the sections that lens reads: `code` the verification, the architecture and what the auditor looks for in the diff, `security` the security review, `interface` the interface rules, and `spec` none. The developer agent SHALL receive the sections for the developer, including the security ones.

#### Scenario: The security lens
- **WHEN** the profile is resolved for the `security` lens
- **THEN** the output holds the `Security review` section and no section for the developer

#### Scenario: The spec lens
- **WHEN** the profile is resolved for the `spec` lens
- **THEN** no section of the stack is printed

#### Scenario: A stack without the new sections
- **WHEN** a profile has no security sections
- **THEN** the lenses use the generic content of their agents and nothing fails

### Requirement: The plugin's profiles have security sections with their sources
Each profile of the plugin for a stack with code that handles users or data SHALL have `Security for the developer` and `Security review` sections whose items each cite a source and the date it was read.

#### Scenario: A plugin profile
- **WHEN** the profile of a plugin stack is read
- **THEN** its security sections list items with a source and a date

#### Scenario: A repository adds to the section
- **WHEN** `.relevo/stacks/<stack>.md` adds to a security section
- **THEN** the resolved profile has the plugin's items followed by the repository's, and none is removed

## ADDED Requirements

### Requirement: A profile can list the paths that exist once its dependencies are installed
A stack profile MAY list paths, relative to the folder of the platform, that must exist after its dependencies are installed. The profiles of the plugin for the stacks that install dependencies SHALL list them. A profile of the repository SHALL be able to add paths and SHALL NOT remove one of the plugin's. Without the list no check is made.

#### Scenario: A plugin stack that installs dependencies
- **WHEN** the profile of the `vue` stack is resolved
- **THEN** it lists the folder where its package manager installs dependencies

#### Scenario: A repository adds a path
- **WHEN** `.relevo/stacks/<stack>.md` lists another path
- **THEN** the resolved profile has the plugin's paths and the added one

#### Scenario: A repository cannot remove a path
- **WHEN** `.relevo/stacks/<stack>.md` tries to remove a path of the plugin's profile
- **THEN** the path stays in the resolved profile

#### Scenario: A stack with no installed dependencies
- **WHEN** the profile of a stack lists no paths
- **THEN** the build job makes no check for it

## ADDED Requirements

### Requirement: A profile says whether its stack has an interface
A stack profile SHALL say which interface kinds its stack has: `web`, `mobile` or both, or `none`. The profiles of the plugin SHALL give `mobile` for Flutter, `web` for Vue and for Laravel, and `none` for Supabase. A stack of the repository SHALL declare its own, and a stack that declares none SHALL be treated as having no interface.

#### Scenario: The plugin profiles
- **WHEN** the profiles of the plugin are resolved
- **THEN** each has the interface kinds of this requirement

#### Scenario: A repository's own stack
- **WHEN** `.relevo/stacks/<stack>.md` declares `web`
- **THEN** the interface rules and previews for the web apply to its platforms

#### Scenario: A stack that declares nothing
- **WHEN** a stack of the repository has no interface key
- **THEN** it is treated as having none and no interface rule or preview is offered for it

### Requirement: A mobile stack with a web target also gets the rules for the web
When the platform of a `mobile` stack lists `web` among its targets, the interface rules for `web` SHALL apply to it as well as those for `mobile`.

#### Scenario: A web target
- **WHEN** a platform of the Flutter stack has the target `web`
- **THEN** the rules for `web` are selected for it too

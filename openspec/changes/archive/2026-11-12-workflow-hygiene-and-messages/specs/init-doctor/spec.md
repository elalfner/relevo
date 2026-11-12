## ADDED Requirements

### Requirement: Doctor reports an old pin of an action in a workflow
`doctor` SHALL warn for each installed Relevo workflow that uses `actions/checkout`, `actions/setup-node` or `actions/create-github-app-token` at a release older than the ones the current templates pin, or `supabase/setup-cli` at v1 or v2, naming the file, the action, the line and the reason (it runs on Node.js 20). It SHALL NOT change any file, and SHALL say that `/relevo:init` merges the new templates and keeps the repository's own changes. A pin that the templates do not use (another action) SHALL NOT be reported.

#### Scenario: An older workflow
- **WHEN** `relevo-go.yml` uses `actions/checkout@v4`
- **THEN** `doctor` warns with the file, the action and the reason, and the file is unchanged

#### Scenario: Current pins
- **WHEN** every pin is the one of the current templates, or newer
- **THEN** `doctor` reports a passed check

#### Scenario: A pin chosen on purpose
- **WHEN** a repository pins an older action deliberately
- **THEN** `doctor` warns once per run and never edits it

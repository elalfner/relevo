## MODIFIED Requirements

### Requirement: Required external tools
Relevo SHALL declare its external dependencies: the OpenSpec command-line tool (Node.js 20.19 or newer), `git`, the platform toolchain, and for `review` the device bridge. It SHALL also declare the skills that `think` invokes: `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling`. `doctor` SHALL detect each one and show the exact install command for what is missing. For each skill found as a folder, `doctor` SHALL also read its frontmatter and, when it sets `disable-model-invocation`, report that the person must launch it by hand; this is a notice, not a failure.

#### Scenario: Skill missing
- **WHEN** a skill that `think` invokes, such as `domain-modeling`, is not installed
- **THEN** `doctor` fails that check and shows the install command

#### Scenario: Skill reserved for the person
- **WHEN** `grill-with-docs` is installed and its frontmatter sets `disable-model-invocation`
- **THEN** `doctor` passes that check with a notice that `/grill-with-docs` must be run by hand, and does not fail

#### Scenario: OpenSpec missing
- **WHEN** the OpenSpec tool is not installed
- **THEN** `doctor` fails that check and shows the install command and the Node.js requirement

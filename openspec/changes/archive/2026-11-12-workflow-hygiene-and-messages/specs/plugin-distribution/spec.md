## ADDED Requirements

### Requirement: The workflow templates pin the actions that run on a current Node.js, by commit
The workflow templates SHALL NOT use an action whose `action.yml` declares a Node.js runtime that GitHub has deprecated. An action that the templates use for a step that handles a token, a package or the checkout SHALL be pinned to a full commit SHA with the release it is, in a comment on the same line (`uses: owner/name@<40 hex> # vX.Y.Z`), and the SHA SHALL be the commit of that release in the action's own repository. The agent step (`anthropics/claude-code-action`) is not changed by this requirement.

#### Scenario: A template renders
- **WHEN** `init` copies a workflow template
- **THEN** each of `actions/checkout`, `actions/setup-node`, `actions/create-github-app-token`, `actions/cache` and `oven-sh/setup-bun` is pinned to a full commit SHA followed by its version, and none runs on Node.js 20

#### Scenario: A floating tag is introduced
- **WHEN** a template uses one of those actions with a tag or a branch
- **THEN** a test fails and names the template and the action

#### Scenario: A repository pinned older actions on purpose
- **WHEN** `init` finds a workflow whose pin of one of those actions differs from the template
- **THEN** it reports the difference like any other and keeps the repository's line unless the person accepts the merge

### Requirement: The downloads of a build are cached by the version that is pinned
The build job of `relevo-go.yml` SHALL install Bun at the exact version in `BUN_VERSION`, hand it to the agent action through `path_to_bun_executable`, and cache Bun and the OpenSpec package under a key that contains the pinned version, the runner OS and the architecture. The cache SHALL be saved by a step that runs immediately after the install and before the agent starts, and a restored Bun SHALL be checked against `BUN_VERSION` before it is used.

#### Scenario: Second run with the same pins
- **WHEN** a build runs with the same `BUN_VERSION` and `OPENSPEC_VERSION` as an earlier one
- **THEN** both are restored from the cache and no download of Bun is made

#### Scenario: A pin is raised
- **WHEN** `BUN_VERSION` or `OPENSPEC_VERSION` changes
- **THEN** the key changes, nothing of the old version is restored, and the new one is installed and cached

#### Scenario: A restored Bun reports another version
- **WHEN** the restored binary does not report `BUN_VERSION`
- **THEN** the step fails before the agent starts, with the two versions in the message

#### Scenario: The cache is unavailable
- **WHEN** the cache service cannot be reached
- **THEN** the build installs both tools as it did before and continues

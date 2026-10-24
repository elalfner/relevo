## MODIFIED Requirements

### Requirement: A browser review checks its tools and the app before driving
Before the first run, a browser review SHALL check that the project's dependencies are installed and match its lock file, that the browser library and its browser resolve from the project, and that the address under review and the module scripts its page loads from the same origin answer with a status below 400. The browser library is a dependency of the project: the review SHALL NOT install it, and SHALL point the person to `init` when it is missing. The browser itself MAY be installed only with the person's permission.

#### Scenario: Dependencies missing
- **WHEN** the project has no installed dependencies
- **THEN** the review does not drive, and offers the frozen install of the project's lock file as the requirement "A browser review offers a frozen install of the project's dependencies" describes

#### Scenario: Dependencies stale
- **WHEN** dependencies are installed, but the lock file names a package version that is not the one installed (for example after the merge with the base branch changed the lock file)
- **THEN** the review does not drive, says the installed dependencies do not match the lock file, and offers the frozen install

#### Scenario: Browser library missing
- **WHEN** the browser library does not resolve from the project
- **THEN** the review installs nothing, says the library is missing from the project's development dependencies, names `/relevo:init` and the exact install command, and stops without driving

#### Scenario: Browser missing
- **WHEN** the browser library resolves but its browser is not installed
- **THEN** the review asks the person for permission, installs the browser only on a yes, and checks again

#### Scenario: App not answering
- **WHEN** the address under review, or a module script of its page, does not answer or answers with a status of 400 or more
- **THEN** the review tells the person the exact command to start the app, with the names of the environment variables it needs, and waits

## ADDED Requirements

### Requirement: A browser review offers a frozen install of the project's dependencies
When dependencies are missing or stale, the review SHALL show the frozen install command for the project's lock file, which runs no package scripts, and SHALL run it only after the person confirms. It SHALL NOT run package scripts, change the manifest or the lock file, or retry another way after a failure. With no lock file it SHALL install nothing.

#### Scenario: npm lock file, person accepts
- **WHEN** dependencies are missing, the platform folder has `package-lock.json`, and the person says yes to `npm ci --ignore-scripts`
- **THEN** the review runs that command in the platform folder, checks the tools again, and continues only when the check passes

#### Scenario: Other package managers
- **WHEN** the platform folder has `pnpm-lock.yaml` or `yarn.lock` instead
- **THEN** the offered command is `pnpm install --frozen-lockfile --ignore-scripts` or `yarn install --immutable` respectively

#### Scenario: Person declines
- **WHEN** the person says no to the install
- **THEN** nothing is installed, the review does not drive, and the issue stays in the state it had

#### Scenario: No lock file
- **WHEN** dependencies are missing and the platform folder has no lock file
- **THEN** the review installs nothing, says there is no lock file to install from, and asks the person to install the dependencies themselves

#### Scenario: Install fails
- **WHEN** the confirmed install exits with an error
- **THEN** the review shows the error, does not retry with package scripts or another command, does not drive, and leaves the manifest and the lock file unchanged

#### Scenario: A running dev server
- **WHEN** the install replaces the dependencies while the person's dev server is running
- **THEN** the review tells the person to restart their dev server before it checks the address, and never restarts it itself

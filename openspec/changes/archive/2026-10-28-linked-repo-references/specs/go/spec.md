## MODIFIED Requirements

### Requirement: The references of the issue reach the builder
`go` SHALL run a fetcher that reads the references from the issue itself, downloads the attachments and the files of linked repositories into a local folder that git ignores, and gives the builder the list. The references are the bullets of `Design reference` and the bullets of `Code pointers` that name a file of a linked repository. It SHALL copy the sections into `design.md` and add one scenario per design reference, "Matches the reference <name>", so the review checklist has a line for it. A linked code pointer SHALL get no scenario.

#### Scenario: Reference in the repository
- **WHEN** the issue has a reference to a file of the repository
- **THEN** `design.md` has the section and the specification has a scenario for it

#### Scenario: Attachment
- **WHEN** the issue has a pasted attachment and `design.images` is on
- **THEN** the image is downloaded to the local folder and the builder reads it from there

#### Scenario: Image of a linked repository
- **WHEN** the issue has a design reference `acme/design:screens/home.webp`, `acme/design` is in `links`, and the file is a WebP image under 5 MB
- **THEN** the image is downloaded to the local folder whether `design.images` is on or off, the builder reads it from there, and the specification has a scenario for it

#### Scenario: Linked code pointer
- **WHEN** the issue lists `acme/api:src/billing/charge.ts` under `Code pointers` and `acme/api` is in `links`
- **THEN** the file is downloaded to the local folder, the builder reads it from there, and the specification has no "Matches the reference" scenario for it

### Requirement: A reference that cannot be fetched is a defect in the specification
When a reference cannot be fetched (not found, not allowed, over the limits, or `design.images` off for an attachment), `go` SHALL NOT build: the issue goes to `needs-spec`, naming the reference and the reason. The reason SHALL reach the issue exactly as the fetcher wrote it, without being reworded or translated.

#### Scenario: Images turned off
- **WHEN** the issue has an attachment and `design.images` is off
- **THEN** the issue goes to `needs-spec` saying that the attachment needs `design.images` or a file in the repository

#### Scenario: Reason word for word
- **WHEN** the fetcher refuses `acme/design:home.webp` with a reason that names the secret `RELEVO_LINKS_TOKEN`
- **THEN** the `needs-spec` comment carries that same reason, in English, naming the secret

### Requirement: The fetcher stays inside fixed limits
The fetcher SHALL take its references only from the issue, download only from the GitHub attachment domains and the linked repositories, follow redirects only to those domains, send the token only to GitHub, accept only PNG, JPEG, GIF and WebP images up to 5 MB and text files up to 200 KB from either source, recognize an image by its bytes and never by its name, and stop at five files across both sections.

#### Scenario: Address outside the domains
- **WHEN** a link points to another domain
- **THEN** nothing is downloaded and the reference is reported as refused

#### Scenario: Redirect to another host
- **WHEN** an attachment redirects to a host that is not on the list
- **THEN** the download stops and the reference is reported as refused

#### Scenario: Too large
- **WHEN** an image is larger than the limit
- **THEN** it is not kept and the reference is reported

#### Scenario: Linked file over the limit
- **WHEN** a linked file is larger than 5 MB
- **THEN** it is refused without its contents being downloaded

#### Scenario: Linked binary that is not an image
- **WHEN** a linked file is neither a recognized image nor UTF-8 text
- **THEN** it is refused, whatever its extension says

## ADDED Requirements

### Requirement: The cloud fetches the references before the agent
In the cloud, a step of the build SHALL run the fetcher before the agent starts, and only that step SHALL have the token for linked repositories. The agent SHALL use what that step fetched and SHALL NOT fetch again. A local run SHALL run the fetcher itself, with the person's own access.

#### Scenario: Private linked repository in the cloud
- **WHEN** `acme/design` is private and in `links`, the secret `RELEVO_LINKS_TOKEN` can read its contents, and the issue has a design reference `acme/design:screens/home.webp`
- **THEN** the reference is fetched, the check passes, the file is not copied into the repository, and the agent's environment never holds the token

#### Scenario: Refused reference in the cloud
- **WHEN** the fetch step refuses a reference
- **THEN** the step itself does not fail, and the agent takes the `needs-spec` path with the refused reference and its reason

#### Scenario: Local run
- **WHEN** `/relevo:go` runs on the person's machine
- **THEN** the fetcher runs with the person's `gh` login and no token for linked repositories is needed

### Requirement: The reason for an unreadable linked file names what to fix
When GitHub answers 404 or 403 for a file of a linked repository, the reason SHALL depend on how it was read: with the token, that the secret `RELEVO_LINKS_TOKEN` cannot read that repository and needs read access to its contents; in the cloud without it, that a private repository needs that secret with read access to its contents; locally, that the person's `gh` login cannot read it. Every reason SHALL name the repository and GitHub's status code.

#### Scenario: Token without access
- **WHEN** the secret is set, and GitHub answers 404 for `acme/design:home.webp`
- **THEN** the reason says that `RELEVO_LINKS_TOKEN` cannot read `acme/design`, gives the 404, and says to give it read access to the contents

#### Scenario: No token in the cloud
- **WHEN** the secret is empty, and GitHub answers 404 for `acme/design:home.webp`
- **THEN** the reason says that `acme/design` could not be read without a token and to store one with read access to its contents as `RELEVO_LINKS_TOKEN`

#### Scenario: Local run without access
- **WHEN** a local run gets 404 for `acme/design:home.webp`
- **THEN** the reason says that the person's `gh` login cannot read `acme/design`

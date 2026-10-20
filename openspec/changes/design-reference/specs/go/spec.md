## ADDED Requirements

### Requirement: The references of the issue reach the builder
`go` SHALL run a fetcher that reads the references from the issue itself, downloads the attachments and the files of linked repositories into a local folder that git ignores, and gives the builder the list. It SHALL copy the section into `design.md` and add one scenario per reference, "Matches the reference <name>", so the review checklist has a line for it.

#### Scenario: Reference in the repository
- **WHEN** the issue has a reference to a file of the repository
- **THEN** `design.md` has the section and the specification has a scenario for it

#### Scenario: Attachment
- **WHEN** the issue has a pasted attachment and `design.images` is on
- **THEN** the image is downloaded to the local folder and the builder reads it from there

### Requirement: A reference that cannot be fetched is a defect in the specification
When a reference cannot be fetched (not found, not allowed, over the limits, or `design.images` off for an attachment), `go` SHALL NOT build: the issue goes to `needs-spec`, naming the reference and the reason.

#### Scenario: Images turned off
- **WHEN** the issue has an attachment and `design.images` is off
- **THEN** the issue goes to `needs-spec` saying that the attachment needs `design.images` or a file in the repository

### Requirement: The fetcher stays inside fixed limits
The fetcher SHALL take its references only from the issue, download only from the GitHub attachment domains and the linked repositories, follow redirects only to those domains, send the token only to GitHub, accept only PNG, JPEG, GIF and WebP images up to 5 MB and text files up to 200 KB, and stop at five files.

#### Scenario: Address outside the domains
- **WHEN** a link points to another domain
- **THEN** nothing is downloaded and the reference is reported as refused

#### Scenario: Redirect to another host
- **WHEN** an attachment redirects to a host that is not on the list
- **THEN** the download stops and the reference is reported as refused

#### Scenario: Too large
- **WHEN** an image is larger than the limit
- **THEN** it is not kept and the reference is reported

### Requirement: The builder reproduces the reference without inventing
`dev` SHALL read the images, reuse the theme tokens and components of the project, invent no asset, and report what it could not match. `qa` SHALL compare the code with example code, and check that the code plausibly respects an image, citing the reference.

#### Scenario: Asset not available
- **WHEN** the design needs an icon the project does not have
- **THEN** `dev` reports it instead of inventing one
